#!/usr/bin/env bash
# LMX: створення безкоштовного сервера Oracle (Always Free, ARM) і встановлення на нього Lampac.
# Запускається в Oracle Cloud Shell: curl -sL irfnekf.github.io/lampa-plugins/oci/o.sh -o o.sh; bash o.sh
set -e
C=${OCI_TENANCY:?no tenancy}
log() { echo "== $*"; }
AD=$(oci iam availability-domain list -c "$C" --query 'data[0].name' --raw-output)
[ -f ~/.ssh/lmx ] || ssh-keygen -t ed25519 -N '' -f ~/.ssh/lmx -q
nz() { [ -n "$1" ] && [ "$1" != "None" ] && [ "$1" != "null" ]; }
VCN=$(oci network vcn list -c "$C" --display-name lmx-vcn --query 'data[0].id' --raw-output 2>/dev/null || true)
nz "$VCN" || VCN=$(oci network vcn create -c "$C" --cidr-block 10.0.0.0/16 --display-name lmx-vcn --dns-label lmxvcn --wait-for-state AVAILABLE --query data.id --raw-output)
log "vcn ok"
IGW=$(oci network internet-gateway list -c "$C" --vcn-id "$VCN" --query 'data[0].id' --raw-output 2>/dev/null || true)
nz "$IGW" || IGW=$(oci network internet-gateway create -c "$C" --vcn-id "$VCN" --is-enabled true --display-name lmx-igw --wait-for-state AVAILABLE --query data.id --raw-output)
RT=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-route-table-id"' --raw-output)
oci network route-table update --rt-id "$RT" --route-rules "[{\"destination\":\"0.0.0.0/0\",\"networkEntityId\":\"$IGW\"}]" --force >/dev/null
SL=$(oci network vcn get --vcn-id "$VCN" --query 'data."default-security-list-id"' --raw-output)
oci network security-list update --security-list-id "$SL" --force --ingress-security-rules '[{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":22,"max":22}}},{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":80,"max":80}}},{"source":"0.0.0.0/0","protocol":"6","tcpOptions":{"destinationPortRange":{"min":443,"max":443}}}]' >/dev/null
SN=$(oci network subnet list -c "$C" --vcn-id "$VCN" --query 'data[0].id' --raw-output 2>/dev/null || true)
nz "$SN" || SN=$(oci network subnet create -c "$C" --vcn-id "$VCN" --cidr-block 10.0.0.0/24 --display-name lmx-sub --dns-label lmxsub --wait-for-state AVAILABLE --query data.id --raw-output)
log "network ok"
ID=$(oci compute instance list -c "$C" --display-name lmx-lampac --lifecycle-state RUNNING --query 'data[0].id' --raw-output 2>/dev/null || true)
if ! nz "$ID"; then
  IMG=$(oci compute image list -c "$C" --operating-system "Canonical Ubuntu" --operating-system-version "24.04" --shape VM.Standard.A1.Flex --sort-by TIMECREATED --query 'data[0].id' --raw-output)
  log "launching ARM 2 OCPU / 12 GB (Always Free)"
  for i in 1 2 3 4 5 6; do
    if ID=$(oci compute instance launch -c "$C" --availability-domain "$AD" --shape VM.Standard.A1.Flex --shape-config '{"ocpus":2,"memoryInGBs":12}' --image-id "$IMG" --subnet-id "$SN" --assign-public-ip true --display-name lmx-lampac --ssh-authorized-keys-file ~/.ssh/lmx.pub --boot-volume-size-in-gbs 50 --wait-for-state RUNNING --query data.id --raw-output 2>/tmp/lmx_err); then break; fi
    if grep -qi "capacity" /tmp/lmx_err; then log "Out of capacity, retry $i in 60s"; sleep 60; else cat /tmp/lmx_err; exit 1; fi
  done
  nz "$ID" || { log "NO CAPACITY: try again later"; exit 1; }
fi
IP=$(oci compute instance list-vnics --instance-id "$ID" --query 'data[0]."public-ip"' --raw-output)
log "server ip $IP"
SSH="ssh -i $HOME/.ssh/lmx -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@$IP"
for i in $(seq 1 40); do $SSH true 2>/dev/null && break; sleep 10; done
SECRET=$(cat ~/.lmx_secret 2>/dev/null || (head -c 18 /dev/urandom | od -An -tx1 | tr -d ' \n' | tee ~/.lmx_secret))
curl -sL "https://irfnekf.github.io/lampa-plugins/oci/srv.sh?$(date +%s)" -o ~/srv.sh
scp -i ~/.ssh/lmx -o StrictHostKeyChecking=no ~/srv.sh ubuntu@$IP:/tmp/srv.sh >/dev/null
$SSH "sudo LMX_SECRET=$SECRET LMX_IP=$IP bash /tmp/srv.sh" 2>&1 | tail -25
echo
echo "LMX_IP=$IP"
echo "LMX_SECRET=$SECRET"
echo "LMX_URL=https://$(echo $IP | tr . -).sslip.io"

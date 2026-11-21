#!/usr/bin/env bash
# LMX: встановлення Lampac (з Chromium для Phantom/Spectre) за Caddy з https і паролем доступу. Запускається на сервері від root.
set -e
: "${LMX_SECRET:?}" "${LMX_IP:?}"
HOSTN="$(echo "$LMX_IP" | tr . -).sslip.io"
export DEBIAN_FRONTEND=noninteractive
echo "== packages"
apt-get update -qq
apt-get install -y -qq curl jq iptables-persistent debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
# порти 80/443 у фаєрволі образу Oracle (там за замовчуванням відкрито лише 22)
for p in 80 443; do iptables -C INPUT -p tcp --dport $p -j ACCEPT 2>/dev/null || iptables -I INPUT 5 -p tcp --dport $p -j ACCEPT; done
netfilter-persistent save >/dev/null 2>&1 || true
# swap на 4 ГБ — запас для Chromium
if [ ! -f /swapfile ]; then fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab; fi
echo "== lampac"
if [ ! -d /opt/lampac ] || [ ! -f /opt/lampac/version.txt ]; then
  curl -fsSL https://raw.githubusercontent.com/lampac-nextgen/lampac/main/install.sh -o /tmp/lampac-install.sh
  bash /tmp/lampac-install.sh </dev/null
fi
CHR=$(command -v chromium || command -v google-chrome-stable || echo /usr/bin/chromium)
cat > /opt/lampac/init.conf <<CONF
{
  "listen": { "ip": "127.0.0.1", "port": 9118, "localhost": "127.0.0.1", "version": true },
  "KnownProxies": [ { "ip": "127.0.0.1", "prefixLength": 32 } ],
  "BaseModule": {
    "SkipModules": [ "Catalog", "DLNA", "JacRed", "Sync", "TimeCode", "TorrServer", "Tracks", "Transcoding", "WebLog",
      "CacheMedia", "ForkPlayerXML", "MsxNative", "Potok", "TelegramAuth", "TelegramAuthBot", "QRAuth", "SeriesNotify",
      "SISI", "OnlineENG", "OnlineGEO", "OnlinePaid" ]
  },
  "chromium": { "enable": true, "executablePath": "$CHR" },
  "accsdb": { "enable": true, "users": [ { "id": "$LMX_SECRET", "expires": "2099-12-31" } ] },
  "online": { "name": "LMX", "version": true }
}
CONF
chown -R lampac:lampac /opt/lampac 2>/dev/null || true
systemctl restart lampac
echo "== caddy"
if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -qq && apt-get install -y -qq caddy >/dev/null
fi
cat > /etc/caddy/Caddyfile <<CADDY
$HOSTN {
  encode gzip
  reverse_proxy 127.0.0.1:9118 {
    header_up xscheme https
  }
}
CADDY
systemctl restart caddy
sleep 20
echo "== check"
systemctl is-active lampac caddy
curl -s -o /dev/null -w "local:%{http_code}\n" "http://127.0.0.1:9118/lite/events?id=1&token=$LMX_SECRET" || true
curl -s -o /dev/null -w "https:%{http_code}\n" "https://$HOSTN/lite/events?id=1&token=$LMX_SECRET" || true
echo "== done $HOSTN"

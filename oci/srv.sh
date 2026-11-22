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
# Filmix Premium: токен пристрою (з filmix.my/consoles) приходить з Cloud Shell, у репозиторії його немає
FXCONF=""
if [ -n "${LMX_FILMIX:-}" ]; then FXCONF="  \"Filmix\": { \"enable\": true, \"token\": \"$LMX_FILMIX\", \"pro\": true },
  \"FilmixTV\": { \"enable\": false }, \"FilmixPartner\": { \"enable\": false },"; else FXCONF="  \"Filmix\": { \"enable\": true }, \"FilmixTV\": { \"enable\": false }, \"FilmixPartner\": { \"enable\": false },"; fi
cat > /opt/lampac/init.conf <<CONF
{
  "listen": { "ip": "127.0.0.1", "port": 9118, "localhost": "127.0.0.1", "version": true },
  "KnownProxies": [ { "ip": "127.0.0.1", "prefixLength": 32 } ],
  "BaseModule": {
    "SkipModules": [ "Catalog", "DLNA", "JacRed", "Sync", "TimeCode", "TorrServer", "Tracks", "Transcoding", "WebLog",
      "CacheMedia", "ForkPlayerXML", "MsxNative", "Potok", "TelegramAuth", "TelegramAuthBot", "QRAuth", "SeriesNotify",
      "SISI", "OnlineENG", "OnlineGEO" ]
  },
  "chromium": { "enable": true, "executablePath": "$CHR" },
  "accsdb": { "enable": true, "accounts": { "$LMX_SECRET": "2099-12-31T00:00:00" } },
  "Spectre": { "enable": true },
$FXCONF  "online": { "name": "LMX", "version": true }
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
echo "== keepalive"
# Oracle забирає Always Free сервер, якщо 7 днів процесор, мережа І пам'ять нижче 20%.
# Тримаємо ~3 ГБ пам'яті зайнятими (разом з Lampac це понад 20% від 12 ГБ) і раз на хвилину їх «торкаємось», процесор майже не навантажується.
cat > /usr/local/bin/lmx-keep.py <<'PY'
import time
b = bytearray(3 * 1024 ** 3)
step = 4096
for i in range(0, len(b), step):
    b[i] = 1
while True:
    for i in range(0, len(b), step):
        b[i] ^= 1
    time.sleep(60)
PY
cat > /etc/systemd/system/lmx-keep.service <<'UNIT'
[Unit]
Description=LMX keep Always Free instance active
After=network.target
[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/lmx-keep.py
Nice=19
Restart=always
RestartSec=30
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now lmx-keep >/dev/null 2>&1
echo "== check"
systemctl is-active lampac caddy lmx-keep
curl -s -o /dev/null -w "local:%{http_code}\n" "http://127.0.0.1:9118/lite/events?id=1&token=$LMX_SECRET" || true
curl -s -o /dev/null -w "https:%{http_code}\n" "https://$HOSTN/lite/events?id=1&token=$LMX_SECRET" || true
echo "== done $HOSTN"

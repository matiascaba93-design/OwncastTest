## Owncast "Version?2" Deployment Guide

Use these steps to set up the updated Version?2 build on a fresh Ubuntu?22.04 Linode. All commands are non-interactive and safe to copy/paste while logged in as `root` (or a sudo user).

### 1. Base Packages (non-interactive)

```bash
export DEBIAN_FRONTEND=noninteractive

apt update
apt install -y \
  curl git unzip build-essential ffmpeg wget ca-certificates xz-utils \
  libssl-dev pkg-config
```

### 2. Install Node.js?20.18.1

```bash
NODE_VERSION=20.18.1
mkdir -p /tmp/node-install && cd /tmp/node-install
curl -LO https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz
sudo mkdir -p /usr/local/lib/nodejs
sudo tar -xJf node-v$NODE_VERSION-linux-x64.tar.xz -C /usr/local/lib/nodejs
sudo ln -sf /usr/local/lib/nodejs/node-v$NODE_VERSION-linux-x64/bin/{node,npm,npx} /usr/local/bin/
node -v   # v20.18.1
npm -v    # 10.x
```

### 3. Install Go?1.25.3

```bash
mkdir -p /tmp/go-install && cd /tmp/go-install
curl -LO https://go.dev/dl/go1.25.3.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.3.linux-amd64.tar.gz
echo 'export PATH=/usr/local/go/bin:$PATH' | sudo tee /etc/profile.d/custom-go-path.sh >/dev/null
sudo chmod +x /etc/profile.d/custom-go-path.sh
source /etc/profile.d/custom-go-path.sh
go version   # go1.25.3 linux/amd64
```

### 4. Fetch Version?2 Source

```bash
sudo mkdir -p /opt/owncast-private
sudo chown $(whoami):$(whoami) /opt/owncast-private
cd /opt/owncast-private

git clone --depth 1 \
  --branch cursor/enhance-owncast-for-private-wedding-livestreams-4c9e \
  https://github.com/matiascaba93-design/OwncastTest.git \
  owncast

cd owncast
git rev-parse --abbrev-ref HEAD   # cursor/enhance-owncast-for-private-wedding-livestreams-4c9e
```

### 5. Build the Updated Web UI

Version?2 includes the recorder/player fixes. Always regenerate the static bundle before compiling Go.

```bash
cd /opt/owncast-private/owncast/web
npx prettier --write components/ui/Footer/Footer.tsx
npm install
npm run build
npx next export

cd ..
rm -rf static/web
mv web/out static/web
```

> Tip: If you already have `node_modules`, you can skip `npm install`. Always run `npx next export` after `npm run build`; there is no `npm run export` script in this project.

### 6. Build the Owncast Binary

```bash
cd /opt/owncast-private/owncast
go env -w GOTOOLCHAIN=local
go clean
go build -o owncast .
ls -lh owncast   # ~100?MB executable
```

### 7. (Optional) Open Firewall Ports

```bash
sudo ufw allow 8080/tcp    # viewer + admin UI
sudo ufw allow 1935/tcp    # RTMP ingest
sudo ufw --force enable
```

### 8. Create and Start systemd Service

```bash
sudo tee /etc/systemd/system/owncast.service >/dev/null <<'EOF'
[Unit]
Description=Owncast Private Wedding Stream
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/owncast-private/owncast
ExecStart=/opt/owncast-private/owncast/owncast
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now owncast
sudo systemctl status owncast   # active (running)
```

### 9. Verify Version?2

Open `http://SERVER_IP:8080/admin` (use an incognito window to avoid cache):

- Admin footer shows `Private owncast v?` (Version?2 identifier).
- Viewer password toggle and recording switch are under `Configuration ? Instance Details`.
- `Utilities ? Recordings` lists new MP4s once streams finish.
- Public page no longer shows ?Powered by Owncast v0.2.3?.
- Player reconnects automatically after you stop/start the mobile stream.

### 10. Future Updates

When pulling future fixes:

```bash
cd /opt/owncast-private/owncast
git pull
./build/web/bundleWeb.sh     # regenerate static assets
go build -o owncast .
sudo systemctl restart owncast
```

This guarantees the recorder improvements, player reset logic, and branding changes stay in sync with each deploy.

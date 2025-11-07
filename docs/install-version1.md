## Owncast "Version?1" Deployment Guide

These steps install the customized Owncast build ("Version?1") on a fresh Ubuntu?22.04 server. Every command is non-interactive and safe to copy/paste over SSH as `root` (or via `sudo`).

### 1. Base Packages

```bash
export DEBIAN_FRONTEND=noninteractive

apt update
apt install -y \
  curl git unzip build-essential ffmpeg wget ca-certificates xz-utils \
  libssl-dev pkg-config
```

### 2. Node.js?20.18.1

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

### 3. Go?1.25.3

```bash
mkdir -p /tmp/go-install && cd /tmp/go-install
curl -LO https://go.dev/dl/go1.25.3.linux-amd64.tar.gz
sudo tar -C /usr/local -xzf go1.25.3.linux-amd64.tar.gz
echo 'export PATH=/usr/local/go/bin:$PATH' | sudo tee /etc/profile.d/custom-go-path.sh >/dev/null
sudo chmod +x /etc/profile.d/custom-go-path.sh
source /etc/profile.d/custom-go-path.sh
go version   # go1.25.3 linux/amd64
```

### 4. Fetch Version?1 Source

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

### 5. Build and Publish the Web UI

The Go server embeds the static web bundle from `static/web`. Regenerate it before compiling Go.

```bash
cd /opt/owncast-private/owncast
./build/web/bundleWeb.sh
```

This script installs npm packages (if needed), runs `next build`, exports the site, and replaces `static/web` with the new output. You can use `./build/web/bundleWeb.sh --offline` to skip `npm install` when rebuilding on an existing server.

### 6. Build the Owncast Binary

```bash
cd /opt/owncast-private/owncast
go env -w GOTOOLCHAIN=local
go clean
go build -o owncast .
ls -lh owncast   # ~100?MB executable
```

### 7. Firewall (optional but recommended)

```bash
sudo ufw allow 8080/tcp    # viewer + admin UI
sudo ufw allow 1935/tcp    # RTMP ingest
sudo ufw --force enable
```

### 8. systemd Service

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

### 9. Verification Checklist

- Visit `http://SERVER_IP:8080/admin` in an incognito/private window.
- Footer reads `Private owncast v?` (confirms Version?1 assets are active).
- `Configuration ? Instance Details` shows the viewer password field and recording toggle.
- `Utilities ? Recordings` page is present (initially empty until a stream finishes).
- Enabling the viewer password triggers the new password gate on the public page.

### 10. Future Updates / Rebuilds

When new changes land:

```bash
cd /opt/owncast-private/owncast
git pull
./build/web/bundleWeb.sh     # regenerate static assets
go build -o owncast .
sudo systemctl restart owncast
```

That?s all?this document captures the exact steps for deploying "Version?1" with viewer password gate, recording management, modern UI, and the ?Private owncast? branding cue.

#!/bin/bash
set -euo pipefail

export HOME="${HOME:-/home/signal}"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
if [ -s "$NVM_DIR/nvm.sh" ]; then
  . "$NVM_DIR/nvm.sh"
  nvm use 22 >/dev/null
fi

cd /home/signal/signaldesk

echo "deploy: $(date -Is) host=$(hostname) pwd=$(pwd)"
git fetch origin
git checkout main
git pull --ff-only origin main
echo "deploy: HEAD=$(git rev-parse --short HEAD) $(git log -1 --format='%s')"

# tsx is a devDependency. Do not set NODE_ENV=production here or pnpm may skip tsx.
pnpm install

if [ ! -f node_modules/tsx/dist/cli.mjs ]; then
  echo "deploy: tsx missing after install" >&2
  exit 1
fi

sudo -n systemctl restart signal-desk
sudo -n systemctl is-active signal-desk
echo "deploy: restart ok"

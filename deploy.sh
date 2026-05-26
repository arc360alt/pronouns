#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Installing dependencies..."
npm install

echo "==> Building client and server..."
npm run build

echo "==> Restarting pm2 process..."
if pm2 describe pronouns > /dev/null 2>&1; then
  pm2 restart pronouns
else
  pm2 start npm --name "pronouns" -- start
fi

pm2 save

echo "==> Done! App is running."
pm2 status pronouns

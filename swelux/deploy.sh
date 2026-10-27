#!/bin/bash
set -euo pipefail

# Deploy the swelux Hajk demo to kog-prod: pull the fork on the server, build there
# (native amd64) and restart. Municipality data lives in $DATA_DIR on the server only.

HOST="${HOST:-root@kog-prod}"
BRANCH="${BRANCH:-swelux}"
REMOTE_DIR="/root/swelux-hajk"

ssh "$HOST" "
  set -e
  if [ ! -d $REMOTE_DIR/.git ]; then
    git clone --branch $BRANCH https://github.com/kognitiv-ai/Hajk.git $REMOTE_DIR
  fi
  cd $REMOTE_DIR
  git fetch origin $BRANCH
  git checkout -q $BRANCH
  git reset -q --hard origin/$BRANCH
  cd swelux
  test -f .env || { echo 'missing $REMOTE_DIR/swelux/.env (SWELUX_TENANT, SWELUX_DATA_DIR)'; exit 1; }
  docker compose build hajk
  docker compose up -d
  docker compose ps
"

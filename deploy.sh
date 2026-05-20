#!/usr/bin/env bash
set -euo pipefail

# Deploy script for checkIP_PortOpen to howard@1.163.141.233
# Uses SSH key: /Users/howard/.ssh-agent/id_ed25519

SERVER="howard@1.163.159.100"
SSH_KEY="/Users/howard/.ssh-agent/id_ed25519"
IMAGE_NAME="port-ledger"
IMAGE_TAG="latest"
REMOTE_DIR="~/port-ledger"

SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=30 -i ${SSH_KEY}"

echo "=== Building Docker image locally ==="
docker build -t "${IMAGE_NAME}:${IMAGE_TAG}" .

echo "=== Saving image to tar ==="
docker save "${IMAGE_NAME}:${IMAGE_TAG}" | gzip > "${IMAGE_NAME}.tar.gz"

echo "=== Creating remote directory ==="
ssh ${SSH_OPTS} "${SERVER}" "mkdir -p ${REMOTE_DIR}"

echo "=== Transferring image to server ==="
scp ${SSH_OPTS} "${IMAGE_NAME}.tar.gz" "${SERVER}:${REMOTE_DIR}/"

echo "=== Transferring docker-compose.yml ==="
scp ${SSH_OPTS} docker-compose.yml "${SERVER}:${REMOTE_DIR}/"

echo "=== Loading image and starting container on server ==="
ssh ${SSH_OPTS} "${SERVER}" << 'REMOTE'
  set -e
  cd ~/port-ledger

  echo "Loading Docker image..."
  gunzip -c port-ledger.tar.gz | docker load

  echo "Stopping old container if exists..."
  docker compose down 2>/dev/null || docker-compose down 2>/dev/null || true

  echo "Starting container..."
  docker compose up -d

  echo "Cleaning up..."
  rm -f port-ledger.tar.gz
  docker image prune -f

  echo "Deployment complete!"
  docker ps --filter name=port-ledger --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
REMOTE

echo "=== Cleaning up local tar ==="
rm -f "${IMAGE_NAME}.tar.gz"

echo "=== Done ==="

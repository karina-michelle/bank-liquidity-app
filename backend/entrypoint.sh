#!/bin/sh

set -e

echo "Seeding Database..."
python -m scripts.seed_market_inventory

echo "Starting Uvicorn Server..."
exec "$@"
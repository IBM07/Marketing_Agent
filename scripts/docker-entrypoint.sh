#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# HyperDrive AI — Docker Entrypoint
#
# Ensures the database schema is always in sync before starting the server.
# Uses `prisma db push` for self-hosted Docker deployments (default).
# Set PRISMA_MIGRATE=true to use `prisma migrate deploy` instead (for managed DBs).
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "🔄 Applying database schema..."

if [ "$PRISMA_MIGRATE" = "true" ]; then
  echo "Running 'prisma migrate deploy'..."
  npx prisma migrate deploy || {
    echo "⚠️  Prisma migrate deploy failed — the database may not be reachable yet."
    echo "   The server will start anyway; retry manually if needed."
  }
else
  echo "Running 'prisma db push'..."
  npx prisma db push --skip-generate || {
    echo "⚠️  Prisma db push failed — the database may not be reachable yet."
    echo "   The server will start anyway; retry manually if needed."
  }
fi

echo "🚀 Starting HyperDrive AI server..."
exec node server.js

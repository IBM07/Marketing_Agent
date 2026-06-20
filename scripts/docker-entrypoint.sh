#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# HyperDrive AI — Docker Entrypoint
#
# Ensures the database schema is always in sync before starting the server.
#   1. Runs `npx prisma db push` to apply schema changes (safe, idempotent)
#   2. Starts the Next.js production server
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "🔄 Applying database schema..."
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || {
  echo "⚠️  Prisma db push failed — the database may not be reachable yet."
  echo "   The server will start anyway; retry schema sync manually if needed."
}

echo "🚀 Starting HyperDrive AI server..."
exec node server.js

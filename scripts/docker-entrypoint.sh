#!/bin/sh
# Runs the container command as the unprivileged "node" user.
#
# Existing deployments bind-mount ./data, which Docker created as root while the
# container still ran as root. Hand those directories to the service user before
# dropping privileges, so upgrading does not require any manual chown.
set -e

if [ "$(id -u)" = "0" ]; then
  fix_owner() {
    # Only act on real directories, and only on entries the service user cannot already own.
    [ -n "$1" ] && [ -d "$1" ] && find "$1" ! -user node -exec chown node:node {} + 2>/dev/null || true
  }
  fix_owner /app/data
  fix_owner "${HOUSE_IMAGE_DIR:-}"
  fix_owner "${TOUR_COVER_DIR:-}"
  # Folders of file-based settings (SQLite database, one-time migration source and completion marker).
  for file in "${DATABASE_PATH:-}" "${SQLITE_MIGRATION_PATH:-}" "${MIGRATION_MARKER_PATH:-}"; do
    [ -n "$file" ] && fix_owner "$(dirname "$file")"
  done
  export HOME=/home/node
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi

# Already running as a non-root user (for example docker run --user): nothing to fix.
exec "$@"

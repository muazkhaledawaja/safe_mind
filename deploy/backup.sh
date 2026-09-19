#!/usr/bin/env bash
# Nightly mysqldump of the Safe Mind database. Install via cron:
#   0 3 * * * /path/to/safe_mind/deploy/backup.sh >> /var/log/safe-mind-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="/var/backups/safe-mind"
RETENTION_DAYS=14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Loads DB_* vars from .env without executing arbitrary shell in it.
ENV_FILE="$(dirname "$0")/../.env"
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"

mysqldump \
  --host="$DB_HOST" --port="$DB_PORT" \
  --user="$DB_USER" --password="$DB_PASSWORD" \
  --single-transaction --routines --triggers \
  "$DB_NAME" | gzip > "$BACKUP_DIR/safe_mind_${TIMESTAMP}.sql.gz"

find "$BACKUP_DIR" -name '*.sql.gz' -mtime +"$RETENTION_DAYS" -delete

echo "Backup complete: safe_mind_${TIMESTAMP}.sql.gz"

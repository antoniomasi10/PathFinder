#!/bin/bash
set -euo pipefail

# =====================================================
# PathFinder Database Backup Script
# Add to crontab: 0 3 * * * /opt/pathfinder/app/deploy/backup-db.sh
# (runs daily at 3:00 AM)
# =====================================================

BACKUP_DIR="/opt/pathfinder/backups"
MAX_BACKUPS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Starting backup..."

docker exec pathfinder-db pg_dump -U pathfinder pathfinder | gzip > "$BACKUP_DIR/pathfinder_${TIMESTAMP}.sql.gz"

echo "Backup saved: pathfinder_${TIMESTAMP}.sql.gz"

# Remove old backups (keep last 7)
ls -t "$BACKUP_DIR"/pathfinder_*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) | xargs -r rm

echo "Cleanup done. Current backups:"
ls -lh "$BACKUP_DIR"/pathfinder_*.sql.gz

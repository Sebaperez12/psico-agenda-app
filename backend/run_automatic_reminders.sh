#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  . "$SCRIPT_DIR/.env"
  set +a
fi

BACKEND_BASE_URL="${BACKEND_BASE_URL:-http://127.0.0.1:5000}"
REMINDER_JOB_KEY="${REMINDER_JOB_KEY:-}"

if [ -z "$REMINDER_JOB_KEY" ]; then
  echo "Falta configurar REMINDER_JOB_KEY en backend/.env"
  exit 1
fi

curl --fail --silent --show-error \
  -X POST \
  -H "X-Reminder-Key: $REMINDER_JOB_KEY" \
  "$BACKEND_BASE_URL/notifications/run-automatic-reminders"

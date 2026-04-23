#!/usr/bin/env sh
set -eu

python manage.py migrate --noinput
python manage.py seed_admin_users
python manage.py collectstatic --noinput

exec gunicorn backend.config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers "${GUNICORN_WORKERS:-2}" \
  --threads "${GUNICORN_THREADS:-4}" \
  --timeout "${GUNICORN_TIMEOUT:-120}"

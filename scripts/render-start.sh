#!/usr/bin/env bash
set -o errexit

python manage.py migrate --noinput
python manage.py seed_admin_users

gunicorn backend.config.wsgi:application --bind "0.0.0.0:${PORT:-10000}"

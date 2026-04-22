#!/usr/bin/env bash
set -o errexit

pip install --upgrade pip
pip install -r requirements.txt

cd frontend
npm ci
VITE_BASE_PATH=/static/ npm run build
cd ..

python manage.py collectstatic --noinput

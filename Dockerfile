FROM node:22-alpine AS frontend-build
WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.13-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --upgrade pip \
    && pip install -r requirements.txt

COPY manage.py ./
COPY apps ./apps
COPY backend ./backend
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
COPY --from=frontend-build /frontend/dist ./frontend/dist

RUN chmod +x ./scripts/docker-entrypoint.sh

EXPOSE 8000

CMD ["./scripts/docker-entrypoint.sh"]

# Multi-stage Dockerfile: builds frontend and backend, produces a small runtime image
FROM node:22-bookworm AS builder

WORKDIR /app

# Install build tools for native modules and copy backend deps
RUN apt-get update && apt-get install -y python3 build-essential libsqlite3-dev curl && rm -rf /var/lib/apt/lists/*
COPY backend/package*.json ./backend/
# Compile the native SQLite binding against the same Debian/glibc generation as
# the runtime image; upstream prebuilds may target a newer glibc.
RUN cd backend && npm_config_build_from_source=sqlite3 npm ci --omit=dev

# Copy frontend package files and install deps, then build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend source (after installing deps to leverage layer caching)
COPY backend/ ./backend/

# Production image
FROM node:22-bookworm-slim

WORKDIR /app

# Copy backend (with installed node_modules from builder)
COPY --from=builder /app/backend /app/backend

# Copy frontend build output
COPY --from=builder /app/frontend/build /app/frontend/build

# The build context can contain restrictive host directory modes. Runtime code
# is immutable, but every directory must be traversable by the non-root user.
RUN chmod -R a=rX /app/backend /app/frontend

# Create data directory for SQLite DB
RUN mkdir -p /app/data
RUN apt-get update && apt-get install -y curl gosu && rm -rf /var/lib/apt/lists/*

# Create a non-root user for running the app (Debian-compatible)
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /usr/sbin/nologin appuser || true

# Copy entrypoint script that will chown and drop privileges
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/tabletto.db

LABEL name="Tabletto" description="Tabletto - Medikamentenverwaltung" version="1.5.0"

EXPOSE 3000

WORKDIR /app/backend

# Use entrypoint to ensure /app/data is owned by appuser,
# then drop privileges and run as appuser for security
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/server.js"]

# Multi-stage Dockerfile: builds frontend and backend, produces a small runtime image
FROM node:18-alpine AS builder

WORKDIR /app

# Copy and install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy frontend package files and install deps, then build
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Copy backend source (after installing deps to leverage layer caching)
COPY backend/ ./backend/

# Production image
FROM node:18-alpine

WORKDIR /app

# Copy backend (with installed node_modules from builder)
COPY --from=builder /app/backend /app/backend

# Copy frontend build output
COPY --from=builder /app/frontend/dist /app/frontend/build

# Create data directory for SQLite DB
RUN mkdir -p /app/data
RUN apk add --no-cache curl

# Create a non-root user for running the app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/medikamente.db

EXPOSE 3000

WORKDIR /app/backend

USER appuser

CMD ["node", "src/server.js"]

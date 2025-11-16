FROM node:18-alpine AS builder

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app/backend ./backend
COPY backend/src ./backend/src
COPY --from=builder /app/frontend/build ./frontend/build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/medikamente.db

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "src/server.js"]

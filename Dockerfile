FROM node:20-alpine

WORKDIR /app

# Install backend dependencies at /app/node_modules so socket source files
# can resolve shared packages (socket.io, ioredis, pg, etc.) by walking up
# the directory tree from /app/socket/src/
COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./backend/
COPY socket/src/ ./socket/src/

WORKDIR /app/backend

EXPOSE 5000

CMD ["sh", "-c", "npm run migrate:apply && node scripts/setup-prod.js && node server.js"]

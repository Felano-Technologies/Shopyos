# ⚠️  DO NOT use this Dockerfile directly.
# This file cannot include the socket/ service source that socketBridge.js requires.
# Always build from the PROJECT ROOT using the root Dockerfile:
#
#   docker build -t shopyos .          (from Shopyos/)
#
# Railway uses the root Dockerfile automatically via railway.toml.

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "npm run migrate:apply && npm start"]

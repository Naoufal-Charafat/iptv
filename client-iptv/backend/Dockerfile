# syntax=docker/dockerfile:1

# ---- Build stage: compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /app

# Build tools for better-sqlite3 native addon (falls back to node:sqlite at
# runtime if the binding is unavailable).
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- Runtime stage: slim node image ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

# Persist the SQLite database in a mounted volume.
VOLUME ["/app/data"]
ENV DATABASE_PATH=/app/data/iptv.db
ENV DATA_DIR=/app/data/raw

EXPOSE 3001
CMD ["node", "dist/server.js"]

# ---- build the dashboard ----
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci
COPY . .
RUN npm --workspace web run build

# ---- runtime: API + built dashboard ----
FROM node:24-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# server has only 3 runtime deps; install them without the workspace/dev tree
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev --no-audit --no-fund

COPY server/src ./server/src
COPY --from=build /app/web/dist ./web/dist

ENV PORT=8787 \
    HOST=0.0.0.0 \
    DB_PATH=/data/entitytrack.db \
    WEB_DIST=/app/web/dist
VOLUME ["/data"]
EXPOSE 8787

# node:sqlite is stable in Node 24 — no flag needed
CMD ["node", "server/src/index.js"]

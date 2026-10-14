# Build with Bun (the lockfile is bun.lock), run on plain Node.
FROM oven/bun:1.2 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

# Production dependencies only; the server bundle keeps packages external.
FROM oven/bun:1.2 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
# The app writes a JSON mirror to data/ and may save config/; MySQL stays the source of truth.
RUN mkdir -p data config && chown node:node data config
USER node
EXPOSE 3000
CMD ["node", "dist/server.cjs"]

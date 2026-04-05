# Stage 1: Build with Bun
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/sync-github/package.json packages/sync-github/
COPY packages/cli/package.json packages/cli/
COPY packages/ui/package.json packages/ui/

RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY packages/core/ packages/core/
COPY packages/sync-github/ packages/sync-github/
COPY packages/cli/ packages/cli/

RUN bun run --filter '@gitpm/core' build && \
    bun run --filter '@gitpm/sync-github' build && \
    bun run --filter 'gitpm' build

# Stage 2: Production runtime
FROM gcr.io/distroless/nodejs22-debian12

WORKDIR /app

COPY --from=build /app/packages/core/dist/ packages/core/dist/
COPY --from=build /app/packages/core/package.json packages/core/
COPY --from=build /app/packages/sync-github/dist/ packages/sync-github/dist/
COPY --from=build /app/packages/sync-github/package.json packages/sync-github/
COPY --from=build /app/packages/cli/dist/ packages/cli/dist/
COPY --from=build /app/packages/cli/package.json packages/cli/
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/package.json .

ENTRYPOINT ["/nodejs/bin/node", "packages/cli/dist/index.js"]

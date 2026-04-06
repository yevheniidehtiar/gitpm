# Stage 1: Build with Bun
FROM oven/bun:1 AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY packages/core/package.json packages/core/
COPY packages/sync-github/package.json packages/sync-github/
COPY packages/cli/package.json packages/cli/
COPY packages/ui/package.json packages/ui/
COPY packages/sync-gitlab/package.json packages/sync-gitlab/
COPY packages/sync-jira/package.json packages/sync-jira/

RUN bun install

COPY tsconfig.json ./
COPY packages/core/ packages/core/
COPY packages/sync-github/ packages/sync-github/
COPY packages/cli/ packages/cli/
COPY packages/sync-gitlab/ packages/sync-gitlab/
COPY packages/sync-jira/ packages/sync-jira/

RUN bun run --filter '@gitpm/core' build && \
    bun run --filter '@gitpm/sync-github' build && \
    bun run --filter '@gitpm/sync-gitlab' build && \
    bun run --filter '@gitpm/sync-jira' build && \
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
COPY --from=build /app/packages/sync-gitlab/dist/ packages/sync-gitlab/dist/
COPY --from=build /app/packages/sync-gitlab/package.json packages/sync-gitlab/
COPY --from=build /app/packages/sync-jira/dist/ packages/sync-jira/dist/
COPY --from=build /app/packages/sync-jira/package.json packages/sync-jira/
COPY --from=build /app/node_modules/ node_modules/
COPY --from=build /app/package.json .

ENTRYPOINT ["/nodejs/bin/node", "packages/cli/dist/index.js"]

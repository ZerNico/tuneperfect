FROM oven/bun:1-slim AS base


FROM base AS builder

WORKDIR /usr/src/app

COPY package.json bun.lock turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/

RUN bun install -g turbo
RUN turbo prune @tuneperfect/api --docker


FROM base AS installer

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/out/json/ .
RUN bun install

COPY --from=builder /usr/src/app/out/full/ .

RUN bun turbo build


FROM base AS runner

WORKDIR /usr/src/app

RUN chown -R bun:bun /usr/src/app

USER bun

COPY --from=installer --chown=bun:bun /usr/src/app/apps/api/dist ./dist
COPY --from=installer --chown=bun:bun /usr/src/app/apps/api/drizzle ./drizzle
RUN bun add sharp

EXPOSE 3000

CMD ["bun", "dist/index.js"]

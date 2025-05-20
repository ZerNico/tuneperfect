FROM oven/bun:1-slim AS base


FROM base AS builder

WORKDIR /usr/src/app

COPY . .

RUN bun install -g turbo
RUN turbo prune @tuneperfect/web --docker


FROM base AS installer

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/out/json/ .
RUN bun install

COPY --from=builder /usr/src/app/out/full/ .

RUN bun turbo build


FROM base AS runner

WORKDIR /usr/src/app

USER bun

COPY --from=installer --chown=bun:bun /usr/src/app/apps/web/.output ./

EXPOSE 3000

CMD ["bun", "server/index.mjs"]

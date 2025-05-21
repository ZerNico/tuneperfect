FROM oven/bun:1 AS base


FROM base AS builder

WORKDIR /usr/src/app

COPY . .

RUN bun install -g turbo
RUN turbo prune @tuneperfect/app --docker


FROM base AS installer

WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/out/json/ .
RUN bun install

COPY --from=builder /usr/src/app/out/full/ .

RUN bun turbo build


FROM base AS runner

WORKDIR /usr/src/app

RUN chown -R bun:bun /usr/local/bin
RUN chown -R bun:bun ./

USER bun

COPY --chown=bun:bun ./apps/app/docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p $HOME/.bun/install/global
RUN bun install --global serve @import-meta-env/cli

COPY --from=installer --chown=bun:bun /usr/src/app/apps/app/dist ./
COPY --from=installer --chown=bun:bun /usr/src/app/apps/app/.env.example ./

EXPOSE 3000

CMD ["./entrypoint.sh"]

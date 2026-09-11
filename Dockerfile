# syntax=docker/dockerfile:1.7
# =============================================================================
# VELDOCS — imagem da aplicação (Next.js)
# -----------------------------------------------------------------------------
# Alvos:
#   dev     — desenvolvimento com recarga automática (usado pelo docker-compose)
#   runner  — execução com build de produção, para validar localmente
#
# Debian slim (não alpine): o Argon2 (@node-rs/argon2) e o Prisma dependem de
# binários nativos e do OpenSSL do sistema.
# =============================================================================

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# --- Dependências --------------------------------------------------------- #
# O schema entra antes do install porque o postinstall roda `prisma generate`.
FROM base AS deps
COPY package.json pnpm-lock.yaml prisma.config.ts ./
COPY prisma ./prisma
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile

# --- Desenvolvimento ------------------------------------------------------- #
# O código é copiado para dentro da imagem (não é bind mount): o watcher do
# Turbopack só enxerga alterações no sistema de arquivos do próprio container.
# `docker compose watch` copia para cá o que mudar no host.
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma generate && pnpm dev -H 0.0.0.0 -p 3000"]

# --- Build de produção ----------------------------------------------------- #
FROM deps AS build
COPY . .
RUN pnpm build

# --- Execução com build de produção ---------------------------------------- #
FROM base AS runner
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["pnpm", "start", "-H", "0.0.0.0", "-p", "3000"]

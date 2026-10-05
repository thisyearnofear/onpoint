# syntax=docker/dockerfile:1
# OnPoint web — Next.js 16 standalone build for Fly.io.
# Multi-stage monorepo build: turbo prune trims the workspace to web + deps.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@10.10.0 --activate

# Prune the monorepo to web + its workspace dependencies.
FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.9.16 prune web --docker

# Install from the pruned manifests + lockfile (best layer caching).
FROM base AS deps
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile

# Build web; turbo builds workspace package deps first.
# NEXT_PUBLIC_* vars are inlined into the bundle at build time —
# they arrive via fly.toml [build.args], NOT fly secrets.
FROM base AS builder
ENV NODE_OPTIONS="--max-old-space-size=6144"
WORKDIR /app
COPY --from=deps /app/ .
COPY --from=pruner /app/out/full/ .
ARG NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_AGENT_API_URL \
    NEXT_PUBLIC_API_BASE \
    NEXT_PUBLIC_APP_NAME \
    NEXT_PUBLIC_DEFAULT_CURRENCY \
    NEXT_PUBLIC_DEFAULT_LOCALE \
    NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY \
    NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_POSTHOG_KEY \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID \
    NEXT_PUBLIC_ZERO_G_ENABLED \
    NEXT_PUBLIC_URL
# Build workspace deps via turbo, then web via turbopack (default bundler —
# far lighter than the pinned webpack path, which OOMs shared builders).
RUN pnpm build --filter=web^... \
 && cd apps/web && node ../../node_modules/next/dist/bin/next build

# Runtime — standalone output already contains a traced node_modules.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 8080
CMD ["node", "apps/web/server.js"]

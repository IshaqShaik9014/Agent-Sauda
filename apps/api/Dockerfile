# ==============================================================================
# Multi-Stage Dockerfile for Agent Sauda Backend API (Fastify + Prisma Engine)
# ==============================================================================

# Stage 1: Dependencies Cache
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy root monorepo manifest and workspace definitions
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/domain/package.json ./packages/domain/
COPY packages/database/package.json ./packages/database/

RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production

# Generate Prisma Client in database package
RUN npm run db:generate --workspace=@agent-sauda/database

# Compile TypeScript packages in dependency order
RUN npm run build --workspace=@agent-sauda/domain
RUN npm run build --workspace=@agent-sauda/database
RUN npm run build --workspace=@agent-sauda/api

# Stage 3: Production Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache curl openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST="0.0.0.0"

# Non-root unprivileged execution
RUN addgroup --system --gid 1001 apigroup
RUN adduser --system --uid 1001 apiuser

# Copy application artifacts and dependencies
COPY --from=builder --chown=apiuser:apigroup /app/node_modules ./node_modules
COPY --from=builder --chown=apiuser:apigroup /app/package.json ./package.json
COPY --from=builder --chown=apiuser:apigroup /app/packages/domain ./packages/domain
COPY --from=builder --chown=apiuser:apigroup /app/packages/database ./packages/database
COPY --from=builder --chown=apiuser:apigroup /app/apps/api ./apps/api

USER apiuser

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/server.js"]

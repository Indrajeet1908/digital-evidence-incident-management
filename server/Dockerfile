# ==============================================================================
# Digital Evidence Platform - Production Backend Dockerfile
# Multi-stage build with non-root security execution.
#
# Production migration policy:
# Backend startup runs compiled server code directly (`node dist/server.js`).
# Migrations are decoupled and executed via dedicated `npx prisma migrate deploy`.
# ==============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Copy source code and build configs
COPY tsconfig.json ./
COPY src ./src

# Generate Prisma client and compile TypeScript
RUN npx prisma generate
RUN npm run build

# Prune dev dependencies for production runtime
RUN npm prune --omit=dev

# Stage 2: Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=5000

# Install dumb-init to properly handle PID 1 signal forwarding (SIGTERM / SIGINT)
RUN apk add --no-cache dumb-init

# Create evidence storage directory and set non-root ownership
RUN mkdir -p /app/storage/evidence && chown -R node:node /app

# Copy production node_modules from builder
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/prisma ./prisma
COPY --chown=node:node --from=builder /app/dist ./dist

# Run as unprivileged system user
USER node

# Expose internal API port
EXPOSE 5000

# Volume mount point for persistent digital evidence storage
VOLUME ["/app/storage/evidence"]

# Healthcheck probe using internal readiness endpoint
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/ready || exit 1

# Start server directly without automated schema migrations
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.js"]

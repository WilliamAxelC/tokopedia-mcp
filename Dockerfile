# Multi-stage Dockerfile for Tokopedia MCP & REST Server

# Stage 1: Builder
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package manifests and tsconfig
COPY package.json tsconfig.json pnpm-lock.yaml* ./

# Install dependencies (including devDependencies for building)
RUN pnpm install --ignore-scripts

# Copy source code
COPY src ./src

# Build TypeScript to dist
RUN pnpm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner

WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Install pnpm
RUN npm install -g pnpm

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0
ENV BASE_PATH=/tokopedia

# Copy package manifests
COPY package.json pnpm-lock.yaml* ./

# Install production dependencies only
RUN pnpm install --prod --ignore-scripts

# Copy compiled files from builder
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3001

# Health check against REST health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "dist/index.js"]

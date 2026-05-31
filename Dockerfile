# OpenWA - Dockerfile
# Multi-stage build for production-ready image (pnpm)

# ===== Stage 1: Builder =====
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies (for native modules)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack (version pinned by package.json "packageManager")
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

# Install all dependencies (including devDependencies for build)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source code and build
COPY . .
RUN pnpm build

# ===== Stage 2: Production =====
FROM node:22-slim AS production

# Install Chrome/Chromium and required dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set Chrome executable path for Puppeteer
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create app user for security
RUN groupadd -r openwa && useradd -r -g openwa openwa

WORKDIR /app

# Enable pnpm via corepack (version pinned by package.json "packageManager")
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable && corepack prepare pnpm@9.12.2 --activate

# Install production dependencies only
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create data directories with proper permissions
RUN mkdir -p ./data/sessions ./data/media && \
    chown -R openwa:openwa /app

# Note: Running as root to allow Docker socket access for orchestration
# For production with stricter security, consider using a Docker socket proxy
# USER openwa

# Expose port
EXPOSE 2785

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD node -e "require('http').get('http://localhost:2785/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start with dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

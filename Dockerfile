# AutoLumiku - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Builder
FROM node:20-alpine AS builder

# Build arguments for Next.js (NEXT_PUBLIC_* are embedded at build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG DATABASE_URL
ARG NODE_ENV=production

# Convert ARGs to ENVs for build process
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV DATABASE_URL=$DATABASE_URL
ENV NODE_ENV=$NODE_ENV

# Install Chromium for Puppeteer (needed for scrapers during build)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev deps needed for build)
# IMPORTANT: Use --include=dev to force install devDependencies
# Coolify injects NODE_ENV=production which causes npm to skip devDeps by default
RUN npm install --include=dev --no-audit && \
    npm cache clean --force

# Generate Prisma Client
RUN npx prisma generate

# Copy source files
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED 1

# Build Next.js application
RUN npm run build

# Create symlinks for URL-encoded dynamic route directories
# Fix for browsers requesting %5Bslug%5D instead of [slug]
RUN cd /app/.next/static/chunks/app/catalog && \
    if [ -d "[slug]" ]; then \
      ln -s "[slug]" "%5Bslug%5D"; \
    fi

# Stage 2: Runner (Production)
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache \
    # For Puppeteer/Chromium
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    # For Sharp (image processing) - runtime only
    vips

# Tell Puppeteer to use Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# Set production environment
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV HOSTNAME 0.0.0.0
ENV PORT 3000

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder with correct ownership
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Copy scripts folder (needed for scrapers and utilities)
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy node_modules is redundant with Next.js standalone output and causes OOM crashes
# COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Copy entrypoint script
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create uploads directory with correct ownership
RUN mkdir -p /app/uploads && chown -R nextjs:nodejs /app/uploads

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3001

# Health check (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with entrypoint (runs migrations then starts server)
CMD ["./docker-entrypoint.sh"]

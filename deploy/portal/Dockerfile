# The portal on its own server (migration plan, step p3-node): Next.js on
# Node 22, with the server's Chromium for the PDF and image exports
# (lib/pdf/browser.ts reads CHROME_PATH). Built on the server by
# deploy/portal/deploy.sh; Vercel does not use this file.

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# NEXT_PUBLIC_ values are written into the browser code at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-noto-color-emoji ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    CHROME_PATH=/usr/bin/chromium \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    INTERNAL_ORIGIN=http://127.0.0.1:3000
WORKDIR /app
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS -o /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node_modules/.bin/next", "start", "-p", "3000"]

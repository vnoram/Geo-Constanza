FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production

EXPOSE 3005

RUN mkdir -p /app/logs && chown node:node /app/logs

USER node

CMD ["sh", "-c", "npx prisma migrate deploy && exec node src/server.js"]

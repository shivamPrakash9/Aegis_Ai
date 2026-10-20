# Multi-stage production container for AegisAI Privacy Scanner Microservice

FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev
RUN npx prisma generate

COPY src ./src/
COPY openapi ./openapi/

FROM node:24-alpine AS runner

WORKDIR /usr/src/app

ENV NODE_ENV=production
ENV PORT=3002

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /usr/src/app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /usr/src/app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /usr/src/app/src ./src
COPY --from=builder --chown=appuser:appgroup /usr/src/app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /usr/src/app/openapi ./openapi

USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3002/health/live || exit 1

CMD ["node", "src/server.js"]

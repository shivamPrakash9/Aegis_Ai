# Multi-stage Dockerfile for AegisAI Security & Audit Service

FROM node:24-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:24-alpine

WORKDIR /usr/src/app

COPY package*.json ./
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV PORT=3005

EXPOSE 3005

USER node

CMD ["node", "src/server.js"]

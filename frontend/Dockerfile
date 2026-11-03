# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source files
COPY . .

# Run strict type checking and production build
RUN npm run build

# Stage 2: Production Nginx Server
FROM nginx:1.27-alpine AS runner

# Copy customized nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled SPA assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q --spider http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

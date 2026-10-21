# StashMind Dockerfile — Multi-stage production build

# Stage 1: Build frontend
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production server
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/src ./src

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD curl -f http://localhost:3000/api/v1/health || exit 1

CMD ["node", "server.ts"]

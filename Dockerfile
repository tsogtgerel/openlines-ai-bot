# Stage 1: Build Frontend and Bundle Node Server
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./
RUN npm install

# Copy all source files
COPY . .

# Build Vite client and bundle server with esbuild
RUN npm run build

# Stage 2: Minimal Production Runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled bundles and assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/server.ts ./

# Expose single port 3000
EXPOSE 3000

# Run standalone bundled CJS server
CMD ["node", "dist/server.cjs"]

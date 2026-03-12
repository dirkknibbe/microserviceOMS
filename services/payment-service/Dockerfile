FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY services/payment-service/package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy source code
COPY services/payment-service .

# Copy shared types to the expected location
COPY shared ../shared

# Install shared dependencies
WORKDIR /shared
COPY shared ./
RUN npm install

# Switch back to app directory and build the application
WORKDIR /app
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "run", "start:prod"]
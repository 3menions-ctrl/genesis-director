# Cloud Run FFmpeg Video Stitcher
# Production-grade video processing with lossless concatenation and audio injection

FROM node:20-slim

# Install FFmpeg and dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (use npm install since no lockfile)
RUN npm install --omit=dev

# Copy application code
COPY . .

# Expose port
EXPOSE 8080

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Run the service
CMD ["node", "server.js"]

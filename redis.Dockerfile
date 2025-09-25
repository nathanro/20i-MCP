# Redis Dockerfile for Render
# This Dockerfile creates a Redis cache instance optimized for Render

FROM redis:7-alpine

# Create directory for custom configuration
RUN mkdir -p /etc/redis/conf.d

# Copy custom configuration
COPY redis.conf /etc/redis/redis.conf

# Expose port
EXPOSE 6379

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD redis-cli ping

# Start Redis with custom configuration
CMD ["redis-server", "/etc/redis/redis.conf"]
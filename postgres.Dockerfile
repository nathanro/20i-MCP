# PostgreSQL Dockerfile for Render
# This Dockerfile creates a PostgreSQL database instance optimized for Render

FROM postgres:15-alpine

# Set environment variables
ENV POSTGRES_DB=mcp_server
ENV POSTGRES_USER=mcp_user
ENV POSTGRES_PASSWORD=password
ENV POSTGRES_INITDB_ARGS="--auth-host=scram-sha-256"

# Create directory for custom configuration
RUN mkdir -p /etc/postgresql/conf.d

# Copy custom configuration
COPY postgres.conf /etc/postgresql/conf.d/postgres.conf

# Copy initialization script
COPY init.sql /docker-entrypoint-initdb.d/

# Set PostgreSQL configuration
COPY postgres.conf /etc/postgresql/postgresql.conf

# Expose port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pg_isready -U mcp_user -d mcp_server

# Start PostgreSQL with custom configuration
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "hba_file=/etc/postgresql/pg_hba.conf"]
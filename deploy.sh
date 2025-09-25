#!/bin/bash

# 20i MCP Server Cloud Deployment Script
# This script automates the deployment of the MCP server to cloud infrastructure

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="20i-mcp-server"
DOCKER_IMAGE="20i-mcp-server"
DOCKER_TAG="latest"
DEPLOYMENT_ENV="production"

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check if required commands exist
check_requirements() {
    log "Checking deployment requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+ first."
        exit 1
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        log_error "npm is not installed. Please install npm first."
        exit 1
    fi
    
    log_success "All requirements are met."
}

# Validate environment variables
validate_environment() {
    log "Validating environment variables..."
    
    required_vars=(
        "TWENTYI_API_KEY"
        "TWENTYI_OAUTH_KEY"
        "TWENTYI_COMBINED_KEY"
        "POSTGRES_PASSWORD"
        "GRAFANA_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Environment variable $var is not set."
            log "Please set it in your .env file or export it:"
            log "export $var=your_value"
            exit 1
        fi
    done
    
    log_success "Environment variables are valid."
}

# Build and test the application
build_application() {
    log "Building the application..."
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci
    
    # Run tests
    log "Running tests..."
    npm test
    
    # Build the application
    log "Building TypeScript application..."
    npm run build
    
    log_success "Application built successfully."
}

# Build Docker image
build_docker_image() {
    log "Building Docker image..."
    
    # Build the image
    docker build -t ${DOCKER_IMAGE}:${DOCKER_TAG} .
    
    # Tag the image
    docker tag ${DOCKER_IMAGE}:${DOCKER_TAG} ${DOCKER_IMAGE}:${DOCKER_TAG}
    
    log_success "Docker image built successfully."
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying with Docker Compose..."
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose down
    
    # Pull latest images
    log "Pulling latest images..."
    docker-compose pull
    
    # Start services
    log "Starting services..."
    docker-compose up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    log "Checking service health..."
    docker-compose ps
    
    log_success "Deployment completed successfully."
}

# Deploy to cloud platform (AWS, GCP, Azure)
deploy_to_cloud() {
    log "Deploying to cloud platform..."
    
    # This is a placeholder for cloud deployment
    # You would implement this based on your preferred cloud provider
    
    log "Cloud deployment not implemented yet."
    log "Please implement cloud deployment based on your preferred provider:"
    log "- AWS ECS, EKS, or EC2"
    log "- Google Cloud Run, GKE, or Compute Engine"
    log "- Azure Container Instances, AKS, or VMs"
}

# Setup monitoring and logging
setup_monitoring() {
    log "Setting up monitoring and logging..."
    
    # Start monitoring services
    docker-compose up -d prometheus grafana
    
    log_success "Monitoring and logging setup completed."
}

# Backup and rollback functions
backup() {
    log "Creating backup..."
    
    # Create backup directory
    backup_dir="./backups/$(date +%Y%m%d_%H%M%S)"
    mkdir -p $backup_dir
    
    # Backup data volumes
    docker-compose down
    docker run --rm -v $(pwd):/backup -v mcp-postgres_data:/data postgres:15 \
        tar czf /backup/postgres_backup.tar.gz -C /data .
    
    docker run --rm -v $(pwd):/backup -v mcp-redis_data:/data redis:7 \
        tar czf /backup/redis_backup.tar.gz -C /data .
    
    log_success "Backup created in $backup_dir"
}

rollback() {
    log "Rolling back to previous version..."
    
    # This is a simplified rollback
    # In production, you'd want more sophisticated rollback logic
    
    docker-compose down
    docker-compose up -d
    
    log_success "Rollback completed."
}

# Main deployment function
main() {
    log "Starting deployment of ${PROJECT_NAME}..."
    
    # Parse command line arguments
    case "${1:-deploy}" in
        "check")
            check_requirements
            validate_environment
            ;;
        "build")
            check_requirements
            validate_environment
            build_application
            build_docker_image
            ;;
        "deploy")
            check_requirements
            validate_environment
            build_application
            build_docker_image
            deploy_docker_compose
            setup_monitoring
            ;;
        "cloud")
            check_requirements
            validate_environment
            build_application
            build_docker_image
            deploy_to_cloud
            ;;
        "backup")
            backup
            ;;
        "rollback")
            rollback
            ;;
        "logs")
            docker-compose logs -f
            ;;
        "status")
            docker-compose ps
            ;;
        "stop")
            docker-compose down
            ;;
        "restart")
            docker-compose restart
            ;;
        *)
            echo "Usage: $0 {check|build|deploy|cloud|backup|rollback|logs|status|stop|restart}"
            echo ""
            echo "Commands:"
            echo "  check        - Check deployment requirements and environment"
            echo "  build        - Build application and Docker image"
            echo "  deploy       - Deploy with Docker Compose (default)"
            echo "  cloud        - Deploy to cloud platform"
            echo "  backup       - Create backup"
            echo "  rollback     - Rollback to previous version"
            echo "  logs         - Show application logs"
            echo "  status       - Show service status"
            echo "  stop         - Stop all services"
            echo "  restart      - Restart all services"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
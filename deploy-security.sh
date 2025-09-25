#!/bin/bash

# Security Deployment Script for 20i MCP Server
# This script helps securely deploy the MCP server with protected variables

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RENDER_SERVICE_NAME="20i-mcp-server"
RENDER_DB_SERVICE_NAME="20i-mcp-database"
RENDER_REDIS_SERVICE_NAME="20i-mcp-redis"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if render CLI is installed
check_render_cli() {
    if ! command -v render &> /dev/null; then
        log_error "Render CLI is not installed. Please install it first:"
        log_info "npm install -g @render/cli"
        exit 1
    fi
}

# Generate secure passwords
generate_password() {
    openssl rand -base64 32 | tr -d '/+' | cut -c1-32
}

# Validate environment variables
validate_environment() {
    log_info "Validating environment variables..."
    
    required_vars=(
        "TWENTYI_API_KEY"
        "TWENTYI_OAUTH_KEY"
        "TWENTYI_COMBINED_KEY"
    )
    
    missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        log_info "Please set these variables in your environment:"
        log_info "export TWENTYI_API_KEY='your_api_key'"
        log_info "export TWENTYI_OAUTH_KEY='your_oauth_key'"
        log_info "export TWENTYI_COMBINED_KEY='your_combined_key'"
        exit 1
    fi
    
    # Validate API key format
    if [[ ${#TWENTYI_API_KEY} -lt 32 ]]; then
        log_warning "API key appears to be too short. Should be at least 32 characters."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "Environment validation passed"
}

# Set up secure environment variables
setup_secure_environment() {
    log_info "Setting up secure environment variables..."
    
    # Generate secure passwords for database and Redis
    DB_PASSWORD=$(generate_password)
    REDIS_PASSWORD=$(generate_password)
    
    # Set environment variables for Render
    log_info "Setting environment variables for $RENDER_SERVICE_NAME..."
    render env $RENDER_SERVICE_NAME TWENTYI_API_KEY="$TWENTYI_API_KEY"
    render env $RENDER_SERVICE_NAME TWENTYI_OAUTH_KEY="$TWENTYI_OAUTH_KEY"
    render env $RENDER_SERVICE_NAME TWENTYI_COMBINED_KEY="$TWENTYI_COMBINED_KEY"
    render env $RENDER_SERVICE_NAME NODE_ENV="production"
    render env $RENDER_SERVICE_NAME PORT="10000"
    render env $RENDER_SERVICE_NAME LOG_LEVEL="info"
    render env $RENDER_SERVICE_name HEALTH_CHECK_ENABLED="true"
    render env $RENDER_SERVICE_NAME MONITORING_ENABLED="true"
    
    # Set database environment variables
    log_info "Setting environment variables for $RENDER_DB_SERVICE_NAME..."
    render env $RENDER_DB_SERVICE_NAME POSTGRES_DB="mcp_server"
    render env $RENDER_DB_SERVICE_NAME POSTGRES_USER="mcp_user"
    render env $RENDER_DB_SERVICE_NAME POSTGRES_PASSWORD="$DB_PASSWORD"
    
    # Set Redis environment variables
    log_info "Setting environment variables for $RENDER_REDIS_SERVICE_NAME..."
    render env $RENDER_REDIS_SERVICE_NAME REDIS_PASSWORD="$REDIS_PASSWORD"
    
    log_success "Environment variables set up successfully"
}

# Deploy services
deploy_services() {
    log_info "Deploying services..."
    
    # Deploy main service
    log_info "Deploying $RENDER_SERVICE_NAME..."
    render services create --service-type web --name $RENDER_SERVICE_NAME --env docker --repo https://github.com/Cbrown35/20i-MCP --dockerfilePath ./Dockerfile --docker-context . --auto-deploy --branch main
    
    # Deploy database service
    log_info "Deploying $RENDER_DB_SERVICE_NAME..."
    render services create --service-type pserv --name $RENDER_DB_SERVICE_NAME --env docker --repo https://github.com/Cbrown35/20i-MCP --dockerfilePath ./postgres.Dockerfile --docker-context . --instance-count 1
    
    # Deploy Redis service
    log_info "Deploying $RENDER_REDIS_SERVICE_NAME..."
    render services create --service-type pserv --name $RENDER_REDIS_SERVICE_NAME --env docker --repo https://github.com/Cbrown35/20i-MCP --dockerfilePath ./redis.Dockerfile --docker-context . --instance-count 1
    
    log_success "Services deployed successfully"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Wait for services to be ready
    sleep 30
    
    # Check main service health
    log_info "Checking $RENDER_SERVICE_NAME health..."
    if render services list | grep -q "$RENDER_SERVICE_NAME.*healthy"; then
        log_success "$RENDER_SERVICE_NAME is healthy"
    else
        log_warning "$RENDER_SERVICE_NAME may not be ready yet"
    fi
    
    # Check database service health
    log_info "Checking $RENDER_DB_SERVICE_NAME health..."
    if render services list | grep -q "$RENDER_DB_SERVICE_NAME.*healthy"; then
        log_success "$RENDER_DB_SERVICE_NAME is healthy"
    else
        log_warning "$RENDER_DB_SERVICE_NAME may not be ready yet"
    fi
    
    # Check Redis service health
    log_info "Checking $RENDER_REDIS_SERVICE_NAME health..."
    if render services list | grep -q "$RENDER_REDIS_SERVICE_NAME.*healthy"; then
        log_success "$RENDER_REDIS_SERVICE_NAME is healthy"
    else
        log_warning "$RENDER_REDIS_SERVICE_NAME may not be ready yet"
    fi
    
    log_success "Deployment verification completed"
}

# Show deployment information
show_deployment_info() {
    log_info "Deployment Information:"
    echo "========================"
    
    # Get service URLs
    MAIN_SERVICE_URL=$(render services list | grep "$RENDER_SERVICE_NAME" | awk '{print $3}')
    DB_SERVICE_URL=$(render services list | grep "$RENDER_DB_SERVICE_NAME" | awk '{print $3}')
    REDIS_SERVICE_URL=$(render services list | grep "$RENDER_REDIS_SERVICE_NAME" | awk '{print $3}')
    
    echo "Main Service URL: $MAIN_SERVICE_URL"
    echo "Database Service URL: $DB_SERVICE_URL"
    echo "Redis Service URL: $REDIS_SERVICE_URL"
    echo ""
    echo "Health Check: $MAIN_SERVICE_URL/health"
    echo "API Endpoint: $MAIN_SERVICE_URL/api"
    echo ""
    echo "Important: Keep your API keys secure and never commit them to version control."
    echo "API Keys are stored securely in Render's environment variables."
}

# Main deployment function
main() {
    log_info "Starting secure deployment of 20i MCP Server..."
    
    # Check prerequisites
    check_render_cli
    
    # Validate environment
    validate_environment
    
    # Set up secure environment
    setup_secure_environment
    
    # Deploy services
    deploy_services
    
    # Verify deployment
    verify_deployment
    
    # Show deployment information
    show_deployment_info
    
    log_success "Deployment completed successfully!"
    log_info "Your 20i MCP Server is now running securely in Render."
}

# Handle command line arguments
case "${1:-}" in
    "check")
        check_render_cli
        validate_environment
        log_success "Environment check passed"
        ;;
    "env")
        setup_secure_environment
        ;;
    "deploy")
        deploy_services
        verify_deployment
        show_deployment_info
        ;;
    "verify")
        verify_deployment
        ;;
    "info")
        show_deployment_info
        ;;
    *)
        echo "Usage: $0 {check|env|deploy|verify|info}"
        echo ""
        echo "Commands:"
        echo "  check     - Check prerequisites and validate environment"
        echo "  env       - Set up secure environment variables"
        echo "  deploy    - Deploy all services"
        echo "  verify    - Verify deployment status"
        echo "  info      - Show deployment information"
        echo ""
        echo "Example: $0 deploy"
        exit 1
        ;;
esac
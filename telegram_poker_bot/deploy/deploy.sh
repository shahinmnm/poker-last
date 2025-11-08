#!/bin/bash
# Quick start script for Docker Compose deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Telegram Poker Bot - Docker Compose Deployment${NC}"
echo "=========================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found${NC}"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo -e "${YELLOW}Please edit .env file with your configuration before continuing${NC}"
    exit 1
fi

# Function to check if service is running
check_service() {
    docker-compose ps "$1" | grep -q "Up"
}

# Parse command line arguments
COMMAND=${1:-up}

case "$COMMAND" in
    up|start)
        echo -e "${GREEN}Starting services...${NC}"
        
        # Check if migrations need to be run
        if ! docker-compose exec -T postgres psql -U pokerbot -d pokerbot -c "\dt" > /dev/null 2>&1; then
            echo -e "${YELLOW}Running database migrations...${NC}"
            docker-compose --profile migrations up migrations
        fi
        
        docker-compose up -d
        echo -e "${GREEN}Services started!${NC}"
        echo ""
        echo "View logs: docker-compose logs -f"
        echo "Stop services: docker-compose down"
        ;;
    
    down|stop)
        echo -e "${YELLOW}Stopping services...${NC}"
        docker-compose down
        echo -e "${GREEN}Services stopped${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}Restarting services...${NC}"
        docker-compose restart
        echo -e "${GREEN}Services restarted${NC}"
        ;;
    
    logs)
        SERVICE=${2:-}
        if [ -z "$SERVICE" ]; then
            docker-compose logs -f
        else
            docker-compose logs -f "$SERVICE"
        fi
        ;;
    
    build)
        echo -e "${GREEN}Building images...${NC}"
        docker-compose build
        echo -e "${GREEN}Build complete${NC}"
        ;;
    
    migrate)
        echo -e "${GREEN}Running database migrations...${NC}"
        docker-compose --profile migrations up migrations
        ;;
    
    clone)
        echo -e "${GREEN}Cloning repository...${NC}"
        if [ -z "$GIT_REPO_URL" ]; then
            echo -e "${RED}Error: GIT_REPO_URL environment variable not set${NC}"
            echo "Usage: GIT_REPO_URL=https://github.com/user/repo.git ./deploy.sh clone"
            exit 1
        fi
        docker-compose -f docker-compose.clone.yml --profile clone up
        ;;
    
    status)
        echo -e "${GREEN}Service Status:${NC}"
        docker-compose ps
        ;;
    
    shell)
        SERVICE=${2:-api}
        echo -e "${GREEN}Opening shell in $SERVICE container...${NC}"
        docker-compose exec "$SERVICE" /bin/bash
        ;;
    
    help|--help|-h)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  up, start      Start all services (default)"
        echo "  down, stop     Stop all services"
        echo "  restart        Restart all services"
        echo "  logs [service] View logs (all services or specific service)"
        echo "  build          Build Docker images"
        echo "  migrate        Run database migrations"
        echo "  clone          Clone repository (requires GIT_REPO_URL)"
        echo "  status         Show service status"
        echo "  shell [service] Open shell in container (default: api)"
        echo "  help           Show this help message"
        ;;
    
    *)
        echo -e "${RED}Unknown command: $COMMAND${NC}"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

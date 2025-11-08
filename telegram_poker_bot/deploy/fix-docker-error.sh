#!/bin/bash
# Fix script for Docker ContainerConfig error
# This script resolves the 'ContainerConfig' KeyError when updating the bot container

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}   Docker ContainerConfig Error Fix${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""

# Step 1: Stop the problematic container
echo -e "${YELLOW}[1/6] Stopping pokerbot_bot container...${NC}"
if docker ps -a --filter "name=pokerbot_bot" --format "{{.Names}}" | grep -q "pokerbot_bot"; then
    docker stop pokerbot_bot 2>/dev/null || true
    echo -e "${GREEN}✓ Container stopped${NC}"
else
    echo -e "${YELLOW}⚠ Container not found (might already be removed)${NC}"
fi

# Step 2: Remove the problematic container
echo -e "${YELLOW}[2/6] Removing pokerbot_bot container...${NC}"
if docker ps -a --filter "name=pokerbot_bot" --format "{{.Names}}" | grep -q "pokerbot_bot"; then
    docker rm -f pokerbot_bot 2>/dev/null || true
    echo -e "${GREEN}✓ Container removed${NC}"
else
    echo -e "${YELLOW}⚠ Container not found (might already be removed)${NC}"
fi

# Step 3: Find and remove the bot image
echo -e "${YELLOW}[3/6] Removing corrupted bot image...${NC}"
BOT_IMAGE=$(docker images --filter=reference='telegram_poker_bot/deploy_bot' --format "{{.Repository}}:{{.Tag}}" | head -n 1)
if [ -n "$BOT_IMAGE" ]; then
    docker rmi -f "$BOT_IMAGE" 2>/dev/null || true
    echo -e "${GREEN}✓ Image removed: $BOT_IMAGE${NC}"
else
    # Try alternative naming patterns
    BOT_IMAGE=$(docker images --filter=reference='deploy_bot' --format "{{.Repository}}:{{.Tag}}" | head -n 1)
    if [ -n "$BOT_IMAGE" ]; then
        docker rmi -f "$BOT_IMAGE" 2>/dev/null || true
        echo -e "${GREEN}✓ Image removed: $BOT_IMAGE${NC}"
    else
        echo -e "${YELLOW}⚠ No bot image found to remove${NC}"
    fi
fi

# Step 4: Prune dangling images
echo -e "${YELLOW}[4/6] Pruning dangling images...${NC}"
docker image prune -f > /dev/null 2>&1 || true
echo -e "${GREEN}✓ Dangling images pruned${NC}"

# Step 5: Rebuild the bot image
echo -e "${YELLOW}[5/6] Rebuilding bot image (this may take a few minutes)...${NC}"
if docker-compose build --no-cache bot; then
    echo -e "${GREEN}✓ Bot image rebuilt successfully${NC}"
else
    echo -e "${RED}✗ Failed to rebuild bot image${NC}"
    echo -e "${YELLOW}Please check the error messages above${NC}"
    exit 1
fi

# Step 6: Start all services
echo -e "${YELLOW}[6/6] Starting all services...${NC}"
if docker-compose up -d; then
    echo -e "${GREEN}✓ Services started successfully${NC}"
else
    echo -e "${RED}✗ Failed to start services${NC}"
    echo -e "${YELLOW}Please check the error messages above${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}==================================================${NC}"
echo -e "${GREEN}✓ Fix completed successfully!${NC}"
echo -e "${BLUE}==================================================${NC}"
echo ""
echo -e "${GREEN}Checking service status:${NC}"
docker-compose ps
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:        docker-compose logs -f bot"
echo "  Check all logs:   docker-compose logs -f"
echo "  Service status:   docker-compose ps"
echo "  Restart service:  docker-compose restart bot"
echo ""

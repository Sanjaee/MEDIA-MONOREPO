#!/bin/bash
# monitoring.sh
# Check container status and logs

echo "=== Container Status ==="
docker-compose -f docker-compose.prod.yml ps

echo -e "\n=== Nginx Access Logs ==="
docker-compose -f docker-compose.prod.yml logs --tail=50 nginx

echo -e "\n=== Backend API Logs ==="
docker-compose -f docker-compose.prod.yml logs --tail=50 api

echo -e "\n=== Next.js Frontend Logs ==="
docker-compose -f docker-compose.prod.yml logs --tail=50 nextjs

echo -e "\n=== Error Checking ==="
docker-compose -f docker-compose.prod.yml logs | grep -i "error"

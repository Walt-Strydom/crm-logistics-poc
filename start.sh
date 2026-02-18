#!/bin/bash

# Logistics CRM - Quick Start Script
# This script helps you quickly deploy the Logistics CRM application

set -e

echo "╔════════════════════════════════════════════╗"
echo "║    Logistics CRM - Quick Start Setup       ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    echo "   Visit: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker and Docker Compose are installed"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Please edit .env file and set your passwords:"
    echo "   - POSTGRES_PASSWORD"
    echo "   - WEBHOOK_SECRET"
    echo ""
    read -p "Press Enter to continue after editing .env, or Ctrl+C to exit..."
fi

echo ""
echo "🚀 Starting deployment..."
echo ""

# Build and start containers
echo "📦 Building and starting containers..."
docker-compose up -d --build

echo ""
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if containers are running
echo ""
echo "🔍 Checking container status..."
docker-compose ps

echo ""
echo "✅ Deployment complete!"
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║          Access Information                ║"
echo "╠════════════════════════════════════════════╣"
echo "║  Application:  http://localhost:3000       ║"
echo "║  PostgreSQL:   localhost:5432              ║"
echo "║  Database:     coal_logistics_compliance   ║"
echo "║  User:         coal_logistics              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "📖 Useful commands:"
echo "   View logs:       docker-compose logs -f"
echo "   Stop services:   docker-compose down"
echo "   Restart:         docker-compose restart"
echo "   Access DB:       docker exec -it coal-postgres psql -U coal_logistics -d coal_logistics_compliance"
echo ""
echo "📚 For more information, see README.md and DEPLOYMENT.md"
echo ""

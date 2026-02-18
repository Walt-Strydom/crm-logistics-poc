#!/bin/bash

# Logistics CRM - Test Script
# Verifies that all components are working correctly

echo "╔════════════════════════════════════════════╗"
echo "║    Logistics CRM - System Test             ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected=$3
    
    echo -n "Testing $name... "
    response=$(curl -s -o /dev/null -w "%{http_code}" $url)
    
    if [ "$response" == "$expected" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (HTTP $response)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (HTTP $response, expected $expected)"
        ((FAILED++))
    fi
}

# Function to test database
test_database() {
    echo -n "Testing database connection... "
    result=$(docker exec coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT 1;" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "   Error: $result"
        ((FAILED++))
    fi
}

# Function to test database tables
test_tables() {
    local table=$1
    echo -n "Testing table 'public.$table'... "
    result=$(docker exec coal-postgres psql -U coal_logistics -d coal_logistics_compliance -c "SELECT COUNT(*) FROM public.$table;" 2>&1 | grep -oP '\d+' | head -1)
    
    if [ -n "$result" ]; then
        echo -e "${GREEN}✓ PASSED${NC} ($result records)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
}

# Run tests
echo "Starting tests..."
echo ""

# 1. Container tests
echo "1. Container Health Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Checking logistics-crm container... "
if docker ps | grep -q logistics-crm; then
    echo -e "${GREEN}✓ RUNNING${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ NOT RUNNING${NC}"
    ((FAILED++))
fi

echo -n "Checking postgres container... "
if docker ps | grep -q coal-postgres; then
    echo -e "${GREEN}✓ RUNNING${NC}"
    ((PASSED++))
else
    echo -e "${RED}✗ NOT RUNNING${NC}"
    ((FAILED++))
fi
echo ""

# 2. Database tests
echo "2. Database Connectivity"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_database
test_tables "drivers"
test_tables "vehicles"
test_tables "jobs"
echo ""

# 3. API endpoint tests
echo "3. API Endpoints"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health Check" "http://localhost:3000/api/health" "200"
test_endpoint "Drivers API" "http://localhost:3000/api/drivers" "200"
test_endpoint "Vehicles API" "http://localhost:3000/api/vehicles" "200"
test_endpoint "Jobs API" "http://localhost:3000/api/jobs" "200"
test_endpoint "Frontend" "http://localhost:3000/" "200"
echo ""

# 4. Data verification
echo "4. Data Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Verifying drivers data... "
drivers=$(curl -s http://localhost:3000/api/drivers | grep -o '"id"' | wc -l)
if [ "$drivers" -gt 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC} ($drivers drivers found)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (No drivers in database)"
fi

echo -n "Verifying vehicles data... "
vehicles=$(curl -s http://localhost:3000/api/vehicles | grep -o '"id"' | wc -l)
if [ "$vehicles" -gt 0 ]; then
    echo -e "${GREEN}✓ PASSED${NC} ($vehicles vehicles found)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (No vehicles in database)"
fi
echo ""

# 5. n8n webhook test (optional)
echo "5. Webhook Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -n "Checking webhook configuration... "
webhook_url=$(docker exec logistics-crm env | grep N8N_WEBHOOK_URL | cut -d'=' -f2)
if [ -n "$webhook_url" ]; then
    echo -e "${GREEN}✓ CONFIGURED${NC}"
    echo "   URL: $webhook_url"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ NOT CONFIGURED${NC}"
fi
echo ""

# Summary
echo "╔════════════════════════════════════════════╗"
echo "║              Test Summary                  ║"
echo "╠════════════════════════════════════════════╣"
echo -e "║  ${GREEN}Passed: $PASSED${NC}                               ║"
echo -e "║  ${RED}Failed: $FAILED${NC}                               ║"
echo "╚════════════════════════════════════════════╝"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! System is ready.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please check the logs:${NC}"
    echo "   docker-compose logs -f logistics-crm"
    exit 1
fi

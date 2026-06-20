#!/bin/bash
# Test script for Phase 3 ported Hetzner agent routes
# Usage: bash scripts/test-routes.sh
set -e

cd /Users/udingethe/Dev/onpoint/apps/api

# Kill any old server
pkill -f 'server.js' 2>/dev/null || true
sleep 1

# Start server on a high port
PORT=14889 NODE_ENV=development SERVICE_API_KEY=test VENICE_API_KEY=test \
  AGENT_WALLET_ADDRESS=0x5b33E63440e95289207120B94da78CE22F9D24fB \
  node server.js > /tmp/onpoint-test-server.log 2>&1 &
SERVER_PID=$!
sleep 5

echo "=== 1. PUBLIC GET ROUTES (no auth needed) ==="
for route in "api/agent/dashboard" "api/agent/identity"; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:14889/$route" 2>&1)
  echo "  GET /$route -> $STATUS"
done

echo ""
echo "=== 2. AUTH-PROTECTED GET (WITH x-service-key + x-user-id) ==="
for route in wallet suggestion approval style tip tip-agent fraud escrow treasury missions; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -H "x-service-key: test" \
    -H "x-user-id: test-user" \
    "http://localhost:14889/api/agent/$route" 2>&1)
  echo "  GET /api/agent/$route -> $STATUS"
done

echo ""
echo "=== 3. AUTH FAILURE TESTS ==="
echo -n "  GET /api/agent/wallet (no key): "
curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:14889/api/agent/wallet
echo ""
echo -n "  GET /api/agent/wallet (bad key): "
curl -s -o /dev/null -w "%{http_code}" --max-time 5 -H "x-service-key: wrong" http://localhost:14889/api/agent/wallet
echo ""

echo ""
echo "=== 4. POST ROUTES (validation error expected) ==="
for route in mint checkout schedule-event; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -X POST -H "x-service-key: test" -H "Content-Type: application/json" -d '{}' \
    "http://localhost:14889/api/agent/$route" 2>&1)
  echo "  POST /api/agent/$route -> $STATUS (expected 400 - validation)"
done

echo ""
echo "=== 5. 404 TESTS ==="
echo -n "  GET /api/nonexistent: "
curl -s -o /dev/null -w "%{http_code}" --max-time 3 http://localhost:14889/api/nonexistent
echo ""

echo ""
echo "=== 6. SERVER LOG (last 10 lines) ==="
tail -10 /tmp/onpoint-test-server.log 2>/dev/null || echo "  (no log file)"

# Cleanup
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true
echo ""
echo "=== ALL TESTS COMPLETE ==="

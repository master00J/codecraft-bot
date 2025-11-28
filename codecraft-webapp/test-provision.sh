#!/bin/bash
# Test Provisioning Script

# Replace with your actual order ID
ORDER_ID="your-order-id-here"

# Test auto-provision endpoint
curl -X POST https://codecraft-solutions-seven.vercel.app/api/admin/deployments/auto-provision \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: $WEBHOOK_SECRET" \
  -d "{
    \"orderId\": \"$ORDER_ID\"
  }" | jq .

echo ""
echo "Check Vercel logs for detailed output!"


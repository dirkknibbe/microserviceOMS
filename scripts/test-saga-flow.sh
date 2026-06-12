#!/usr/bin/env bash
# End-to-end saga flow verification. Requires the full stack up:
# docker infra + order/user/payment/inventory services + gateway (port 4000).
#
# Prices are server-side (order-service mock price list keyed by productId);
# CreateOrderInput has no unitPrice field. Demo trigger products:
#   ...440203 -> $29.99  happy path        -> COMPLETED
#   ...440206 -> $13.13  auth declines     -> FAILED (stock released)
#   ...440207 -> $26.26  capture fails     -> SHIPPED (terminal, ops alert)
set -euo pipefail

GATEWAY=${GATEWAY:-http://localhost:4000/graphql}

PRODUCT_HAPPY="550e8400-e29b-41d4-a716-446655440203"
PRODUCT_AUTH_DECLINE="550e8400-e29b-41d4-a716-446655440206"
PRODUCT_CAPTURE_FAIL="550e8400-e29b-41d4-a716-446655440207"

gql() { # $1 = query string
  curl -s "$GATEWAY" -H 'content-type: application/json' -d "{\"query\":\"$1\"}"
}

place_order() { # $1 = productId
  local resp
  resp=$(gql "mutation { createOrder(input: { userId: \\\"$(uuidgen | tr 'A-Z' 'a-z')\\\", items: [{ productId: \\\"$1\\\", quantity: 1 }] }) { id status totalAmount } }")
  echo "$resp" | python3 -c 'import json,sys
r = json.load(sys.stdin)
if r.get("errors"): raise SystemExit("createOrder errors: %s" % r["errors"])
print(r["data"]["createOrder"]["id"])'
}

poll_status() { # $1 = orderId, $2 = expected status, $3 = max attempts (2s apart)
  local status=""
  for _ in $(seq 1 "$3"); do
    status=$(gql "query { order(id: \\\"$1\\\") { status } }" \
      | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["order"]["status"])')
    [ "$status" = "$2" ] && echo "OK: order $1 reached $2" && return 0
    sleep 2
  done
  echo "FAIL: order $1 stuck at $status (expected $2)"
  return 1
}

echo "— Happy path (\$29.99) —"
id=$(place_order "$PRODUCT_HAPPY")
poll_status "$id" COMPLETED 20

echo "— Auth decline (\$13.13) —"
id=$(place_order "$PRODUCT_AUTH_DECLINE")
poll_status "$id" FAILED 10

echo "— Capture failure (\$26.26) —"
id=$(place_order "$PRODUCT_CAPTURE_FAIL")
poll_status "$id" SHIPPED 20

echo "All saga flows verified."

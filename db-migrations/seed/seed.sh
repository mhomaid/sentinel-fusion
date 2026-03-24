#!/usr/bin/env bash
# seed.sh — post demo scenario events to the Sentinel Fusion ingest API
#
# Usage:
#   ./seed.sh scenario_a          # Converging threat → CRITICAL
#   ./seed.sh scenario_b          # RF cluster       → HIGH
#   ./seed.sh scenario_c_part1    # Lone telemetry   → LOW
#   ./seed.sh scenario_c_part2    # Escalation       → MEDIUM

set -euo pipefail

API_URL="${API_URL:-http://localhost:8080}"
EVENTS_FILE="$(dirname "$0")/events.json"
SCENARIO="${1:-}"

if [[ -z "$SCENARIO" ]]; then
  echo "Usage: $0 <scenario_a|scenario_b|scenario_c_part1|scenario_c_part2>"
  exit 1
fi

if ! command -v jq &> /dev/null; then
  echo "Error: jq is required. Install with: brew install jq"
  exit 1
fi

if ! command -v curl &> /dev/null; then
  echo "Error: curl is required."
  exit 1
fi

echo "→ Posting scenario: $SCENARIO"
echo "  API: $API_URL"
echo ""

# Extract events array for the given scenario
EVENTS=$(jq -c ".${SCENARIO}.events[]" "$EVENTS_FILE" 2>/dev/null)

if [[ -z "$EVENTS" ]]; then
  echo "Error: scenario '$SCENARIO' not found in $EVENTS_FILE"
  exit 1
fi

COUNT=0
while IFS= read -r event; do
  RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "${API_URL}/api/events" \
    -H "Content-Type: application/json" \
    -d "$event")

  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | head -n-1)

  if [[ "$HTTP_CODE" == "202" ]]; then
    ID=$(echo "$BODY" | jq -r '.id // "unknown"')
    printf "  [%02d] ✓ %s (status %s)\n" "$((COUNT+1))" "$ID" "$HTTP_CODE"
  else
    printf "  [%02d] ✗ status %s — %s\n" "$((COUNT+1))" "$HTTP_CODE" "$BODY"
  fi

  COUNT=$((COUNT + 1))
  sleep 0.1
done <<< "$EVENTS"

echo ""
echo "Done. Posted $COUNT event(s) for scenario '$SCENARIO'."
echo "Fusion engine fires every 30s — check GET ${API_URL}/api/incidents"

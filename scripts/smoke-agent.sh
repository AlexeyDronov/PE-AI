#!/bin/sh
# Checks the RUNNING Mastra dev server (bundled code, not vitest): both agents load with their playbooks.
BASE=${BASE:-http://localhost:4111}
body=$(curl -s -m 10 "$BASE/api/agents") || { echo "FAIL agent server not reachable at $BASE"; exit 1; }
fail=0
for id in market-researcher analyst; do
  echo "$body" | grep -q "\"$id\"" && echo "ok   agent $id" || { echo "FAIL agent $id missing"; fail=1; }
done
for heading in "# Sizing a market" "# Citing sources" "# PE screening criteria"; do
  echo "$body" | grep -q "$heading" && echo "ok   playbook $heading" || { echo "FAIL playbook $heading not in instructions"; fail=1; }
done
# Every implemented job kind is routable in the bundle (422 for an empty body, not 404 unknown kind).
for kind in ${JOB_KINDS:-teaser_screen}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 10 -X POST "$BASE/jobs/$kind/start" \
    -H "authorization: Bearer ${AGENT_SERVICE_TOKEN:-dev-service-token}" -H "content-type: application/json" -d '{}')
  [ "$code" = "422" ] && echo "ok   job $kind" || { echo "FAIL job $kind not registered (HTTP $code)"; fail=1; }
done
exit $fail

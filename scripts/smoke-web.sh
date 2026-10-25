#!/bin/sh
# Requests every route from the running dev server; fails if any page doesn't compile or render.
BASE=${BASE:-http://localhost:3000}
fail=0
for path in / /markets /markets/s1 /research /deals /deals/new /deals/d1 /deals/d1/model /deals/d1/memo \
            /portfolio /portfolio/p1 /portfolio/covenants /exits /fund /dev/components; do
  code=$(curl -s -o /tmp/smoke-body -w "%{http_code}" "$BASE$path")
  if [ "$code" != "200" ] || grep -q "__next_error__\|Syntax error\|Module not found" /tmp/smoke-body; then
    echo "FAIL $code $path"; fail=1
  else
    echo "ok   $path"
  fi
done
exit $fail

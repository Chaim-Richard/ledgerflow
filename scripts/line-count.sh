#!/usr/bin/env bash
# Counts tracked lines by kind and appends one dated row to docs/LINE_COUNT.md (one row per day).
set -euo pipefail
count() { git ls-files -z -- "$@" | xargs -0 cat 2>/dev/null | wc -l | tr -d ' '; }
app=$(count 'src/*.ts' 'src/*.tsx' ':!src/tests/*' ':!*.test.ts' ':!*.test.tsx')
tests=$(count 'src/tests/*' '*.test.ts' '*.test.tsx' 'e2e/*.ts')
sql=$(count '*.sql')
docs=$(count 'docs/*.md' '*.md')
total=$((app + tests + sql + docs))
day=$(date -u +%Y-%m-%d)
f=docs/LINE_COUNT.md
if [ ! -f "$f" ]; then
  printf '# Lines of code, one row per day\n\nApp = src without tests; Tests = unit + browser tests; written by scripts/line-count.sh (daily by GitHub Actions).\n\n| Date | App | Tests | SQL | Docs | Total |\n|---|---:|---:|---:|---:|---:|\n' > "$f"
fi
grep -v "^| $day |" "$f" > "$f.tmp" && mv "$f.tmp" "$f"
printf '| %s | %s | %s | %s | %s | %s |\n' "$day" "$app" "$tests" "$sql" "$docs" "$total" >> "$f"
tail -1 "$f"

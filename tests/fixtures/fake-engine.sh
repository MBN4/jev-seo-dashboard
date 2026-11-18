#!/usr/bin/env bash
# Test stand-in for "python -m jevseo run <url> --out <dir> ...". Emits engine-format
# progress lines and writes outputs, so the job runner can be tested without network.
# Behaviour is selected by the target URL: "fail" exits 1, "slow" sleeps (for cancel tests).
url="$4"; out=""
args=("$@")
for i in "${!args[@]}"; do [ "${args[$i]}" = "--out" ] && out="${args[$((i+1))]}"; done
log() { echo "[jevseo 00:0$1] $2" >&2; }
log 0 "Auditing $url: up to 5 pages. Typical run 1 to 4 minutes; progress follows."
log 0 "== 1/7 Crawl: robots.txt, sitemaps, then pages"
case "$url" in
  *fail*) echo "Refusing to crawl fail.example: it does not resolve to a public address." >&2; exit 1;;
  *slow*) log 1 "crawled 1/5 URLs, 3 queued"; sleep 30;;
esac
log 1 "crawled 5/5 URLs, 0 queued"
log 1 "== 2/7 Rule checks"
log 1 "== 3/7 DataForSEO: skipped (add --full for rankings, keywords and backlinks)"
log 1 "== 4/7 Jev judgments: 5 pages, budget \$0.25"
log 1 "TYPESAFE_API_KEY not found: Jev judgments skipped; semantic sections will be marked not assessed."
log 2 "== 5/7 PageSpeed: 1 pages x mobile and desktop, about 30 to 60 seconds"
log 2 "PageSpeed 1/2: mobile $url (HTTP 429)"
log 2 "PageSpeed 2/2: desktop $url (HTTP 429)"
log 2 "PageSpeed Insights: 0/2 runs succeeded"
log 2 "== 6/7 Scoring"
mkdir -p "$out"
cp "$(dirname "$0")/audit.json" "$out/audit.json"
log 2 "audit written: $out/audit.json"
log 3 "== 7/7 Render: pdf,xlsx,md"
for f in report.pdf report.xlsx report.md; do echo "fake" > "$out/$f"; done
log 3 "pdf: $out/report.pdf"
exit 0

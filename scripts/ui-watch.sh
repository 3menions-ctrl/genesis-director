#!/bin/bash
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"
OWNER="8be6d9c9-776e-46af-9ad8-23ad41f0f99c"
PIDS="ff40f51d-0bed-41c2-8952-f8c05707c2f3 60beaf20-674c-4f1a-bdaf-24c877654eb9 94cb7033-4e67-4d3e-a99b-4d6f8c47f22c 9d3e041d-e530-454a-9b76-e6558e5a2225 2227f442-74fd-4686-9618-4c406ffa5626 0e61bd2e-cfdb-4f22-86c3-1e70acfcb881 2e54dd53-6984-4466-9924-dae2c620e898 70b7180b-7d66-4e42-9a42-c5aafe7550d6 1ba07be6-818b-48e8-a9e0-8c5614851610 9029f0e1-8cd8-456e-8176-2b42a22a71f4"
term(){ case "$1" in completed|failed|error|payment_failed) return 0;; *) return 1;; esac; }
for round in $(seq 1 50); do
  alldone=1
  for pid in $PIDS; do
    st=$(curl -s "$URL/rest/v1/movie_projects?id=eq.$pid&select=status" -H "apikey: $SR" -H "Authorization: Bearer $SR" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['status'] if d else 'missing')" 2>/dev/null)
    term "$st" || alldone=0
  done
  [ "$alldone" = "1" ] && break
  sleep 30
done
echo "================ UI LIBRARY (3menions) FINAL ================"
for pid in $PIDS; do
  row=$(curl -s "$URL/rest/v1/movie_projects?id=eq.$pid&select=title,status,video_url,video_engine,user_id" -H "apikey: $SR" -H "Authorization: Bearer $SR")
  echo "$row" | python3 -c "
import sys,json
d=json.load(sys.stdin)[0]
vu=d.get('video_url') or ''
import urllib.request
http='-'
print('%-42s | %-10s | owner3men=%s | vid=%s' % ((d.get('title') or '(untitled)')[:42], d.get('status'), 'Y' if d.get('user_id')=='$OWNER' else 'NO', 'Y' if vu else 'N'))
"
  vu=$(echo "$row" | python3 -c "import sys,json;print(json.load(sys.stdin)[0].get('video_url') or '')" 2>/dev/null)
  [ -n "$vu" ] && curl -s -o /dev/null -w "      finalHTTP=%{http_code}/%{size_download}b\n" "$vu"
done

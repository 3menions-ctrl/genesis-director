#!/usr/bin/env bash
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"

declare -A P=(
  [t2v-kling]=079c8d70-60ef-4e6e-a6a7-e76ca67be10d
  [t2v-seedance]=9b66e044-8843-4785-951b-70899d5c4729
  [t2v-veo]=95a304ff-6bb1-4909-9b08-935621efd540
  [t2v-sora]=584eac8c-1b70-4f06-a146-9e9a711c5bbe
  [crossover-breakout]=aab5ab89-766d-4d89-890e-9ce3ac9b0efd
  [learning-avatar-seed]=b2cddfc2-a046-4f02-96fa-23694734623f
  [i2v-kling]=22c62928-88cd-471e-a2d2-dbe9d8bbe198
  [avatar-kling]=06b8d71f-f67b-4d04-8d3c-1cd8f233ce0e
)

is_terminal(){ case "$1" in completed|failed|payment_failed|error) return 0;; *) return 1;; esac; }

for round in $(seq 1 40); do
  alldone=1; line="[$(date +%H:%M:%S)] "
  for label in "${!P[@]}"; do
    st=$(curl -s "$URL/rest/v1/movie_projects?id=eq.${P[$label]}&select=status" -H "apikey: $SR" -H "Authorization: Bearer $SR" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['status'] if d else 'missing')" 2>/dev/null)
    line+="$label=$st  "
    is_terminal "$st" || alldone=0
  done
  echo "$line"
  [ "$alldone" = "1" ] && break
  sleep 30
done

echo; echo "================ FINAL RESULTS ================"
for label in "${!P[@]}"; do
  row=$(curl -s "$URL/rest/v1/movie_projects?id=eq.${P[$label]}&select=status,video_url,last_error" -H "apikey: $SR" -H "Authorization: Bearer $SR")
  st=$(printf '%s' "$row" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0].get('status','') if d else 'missing')" 2>/dev/null)
  vu=$(printf '%s' "$row" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0].get('video_url') or '' if d else '')" 2>/dev/null)
  err=$(printf '%s' "$row" | python3 -c "import sys,json;d=json.load(sys.stdin);print((d[0].get('last_error') or '')[:120] if d else '')" 2>/dev/null)
  clips=$(curl -s "$URL/rest/v1/video_clips?project_id=eq.${P[$label]}&select=shot_index,status&order=shot_index" -H "apikey: $SR" -H "Authorization: Bearer $SR" | python3 -c "import sys,json;print(','.join(f\"{c['shot_index']}:{c['status']}\" for c in json.load(sys.stdin)))" 2>/dev/null)
  http="-"
  if [ -n "$vu" ]; then http=$(curl -s -o /dev/null -w "%{http_code}/%{size_download}b" "$vu"); fi
  printf "%-22s status=%-12s clips=[%s] finalHTTP=%s\n" "$label" "$st" "$clips" "$http"
  [ -n "$err" ] && echo "    last_error: $err"
done

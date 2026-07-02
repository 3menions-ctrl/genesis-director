#!/bin/bash
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"
OWNER="8be6d9c9-776e-46af-9ad8-23ad41f0f99c"
ALL="0a2ddf2e-1e13-4ad5-8fd7-46ac0e965aab 079c8d70-60ef-4e6e-a6a7-e76ca67be10d 9b66e044-8843-4785-951b-70899d5c4729 95a304ff-6bb1-4909-9b08-935621efd540 584eac8c-1b70-4f06-a146-9e9a711c5bbe aab5ab89-766d-4d89-890e-9ce3ac9b0efd b2cddfc2-a046-4f02-96fa-23694734623f 22c62928-88cd-471e-a2d2-dbe9d8bbe198 06b8d71f-f67b-4d04-8d3c-1cd8f233ce0e"
for pid in $ALL; do
  st=$(curl -s "$URL/rest/v1/movie_projects?id=eq.$pid&select=status" -H "apikey: $SR" -H "Authorization: Bearer $SR" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['status'] if d else '')" 2>/dev/null)
  if [ "$st" = "completed" ]; then
    curl -s -o /dev/null -w "  $pid completed -> reassigned HTTP %{http_code}\n" -X PATCH "$URL/rest/v1/movie_projects?id=eq.$pid" \
      -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" -H "Prefer: return=minimal" \
      -d "{\"user_id\":\"$OWNER\",\"title\":\"[PIPELINE TEST] $pid\"}" >/dev/null
    echo "  $pid -> reassigned to 3menions"
  else
    echo "  $pid status=$st (not completed)"
  fi
done

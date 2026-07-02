#!/bin/bash
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"
relabel(){ curl -s -o /dev/null -w "  %{http_code} $2\n" -X PATCH "$URL/rest/v1/movie_projects?id=eq.$1" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"title\":\"$2\"}"; }
# Templates did NOT apply (generic kling) -> honest titles
relabel 0e61bd2e-cfdb-4f22-86c3-1e70acfcb881 "UI · TEMPLATE FAILED to apply · Cinematic (generic)"
relabel 2e54dd53-6984-4466-9924-dae2c620e898 "UI · TEMPLATE FAILED to apply · Commercial (generic)"
relabel 70b7180b-7d66-4e42-9a42-c5aafe7550d6 "UI · TEMPLATE FAILED to apply · Educational (generic)"
relabel 1ba07be6-818b-48e8-a9e0-8c5614851610 "UI · TEMPLATE FAILED to apply · Entertainment (generic)"
relabel 9029f0e1-8cd8-456e-8176-2b42a22a71f4 "UI · TEMPLATE FAILED to apply · Corporate (generic)"
relabel 59c27430-2684-4c8e-86fd-afd34e7fdb6c "UI · BREAKOUT FAILED to apply · Post-Escape (generic)"
# API (not UI) -> mark clearly
relabel 0a2ddf2e-1e13-4ad5-8fd7-46ac0e965aab "API (not UI) · Text-to-Video · WAN"
relabel 584eac8c-1b70-4f06-a146-9e9a711c5bbe "API (not UI) · Text-to-Video · SORA"

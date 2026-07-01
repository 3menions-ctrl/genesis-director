#!/usr/bin/env bash
# Pipeline audit — fire one 5-sec generation per engine/pipeline through the
# real edge endpoints (faithful equivalent of the UI), each under a fresh
# funded test user. Writes PROJECT lines to the results file.
set -u
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"; ANON="$VITE_SUPABASE_PUBLISHABLE_KEY"
FACE="https://ywcwaumozoejierlfkgj.supabase.co/storage/v1/object/public/avatars/batch-v2/professor-aiyana-whitehorse-front-1778819486667.png"
RESULTS="/tmp/pipeaudit-results.txt"
: > "$RESULTS"

jget(){ python3 -c "import sys,json;print(json.load(sys.stdin).get('$1','') or '')" 2>/dev/null; }

# fire LABEL ENDPOINT JSON_BODY
fire(){
  local label="$1" endpoint="$2" body="$3"
  local stamp email pass create tuid tok resp pid
  stamp="$(date +%s)$RANDOM"
  email="pa-${label}-${stamp}@smallbridges.test"
  pass="Cx!${stamp}aB"
  create=$(curl -s -X POST "$URL/auth/v1/admin/users" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\",\"email_confirm\":true}")
  tuid=$(printf '%s' "$create" | jget id)
  if [ -z "$tuid" ]; then echo "$label CREATE_FAIL $create" >>"$RESULTS"; return; fi
  curl -s -X POST "$URL/rest/v1/rpc/add_credits" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" \
    -d "{\"p_user_id\":\"$tuid\",\"p_amount\":3000,\"p_description\":\"pipeaudit\",\"p_stripe_payment_id\":\"PA_${label}_${stamp}\"}" >/dev/null
  tok=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" | jget access_token)
  if [ -z "$tok" ]; then echo "$label SIGNIN_FAIL" >>"$RESULTS"; return; fi
  resp=$(curl -s -X POST "$URL/functions/v1/$endpoint" -H "apikey: $ANON" -H "Authorization: Bearer $tok" -H "Content-Type: application/json" -d "$body")
  pid=$(printf '%s' "$resp" | jget projectId)
  echo "$label user=$tuid project=$pid resp=${resp:0:220}" >>"$RESULTS"
  echo "fired $label -> project=$pid"
}

fire "t2v-kling"     mode-router '{"mode":"text-to-video","prompt":"A lone lighthouse beam sweeping across stormy waves at dusk, cinematic","aspectRatio":"16:9","clipCount":1,"clipDuration":5,"videoEngine":"kling","enableNarration":false,"enableMusic":false}'
fire "t2v-seedance"  mode-router '{"mode":"text-to-video","prompt":"A hummingbird hovering over a glowing tropical flower in slow motion, macro","aspectRatio":"16:9","clipCount":1,"clipDuration":5,"videoEngine":"seedance","enableNarration":false,"enableMusic":false}'
fire "t2v-veo"       mode-router '{"mode":"text-to-video","prompt":"A vintage train crossing a misty mountain viaduct at sunrise, sweeping aerial","aspectRatio":"16:9","clipCount":1,"clipDuration":5,"videoEngine":"veo","enableNarration":false,"enableMusic":false}'
fire "t2v-sora"      mode-router '{"mode":"text-to-video","prompt":"A neon koi fish swimming through a rain puddle reflecting city lights, surreal","aspectRatio":"16:9","clipCount":1,"clipDuration":5,"videoEngine":"sora","enableNarration":false,"enableMusic":false}'
fire "crossover"     mode-router '{"mode":"text-to-video","prompt":"A dancer leaps out of the phone screen into the real room","aspectRatio":"9:16","clipCount":1,"clipDuration":5,"isBreakout":true,"crossoverTemplateSlug":"the-dancers-leap","breakoutPlatform":"tiktok"}'
fire "avatar-kling"  mode-router "{\"mode\":\"avatar\",\"prompt\":\"A friendly professor greets the camera and welcomes you to class\",\"referenceImageUrl\":\"$FACE\",\"aspectRatio\":\"9:16\",\"clipCount\":1,\"clipDuration\":5,\"videoEngine\":\"kling\"}"
fire "learning-seed" mode-router "{\"mode\":\"avatar\",\"prompt\":\"An instructor explains the water cycle on a clean studio set\",\"referenceImageUrl\":\"$FACE\",\"aspectRatio\":\"16:9\",\"clipCount\":1,\"clipDuration\":5,\"videoEngine\":\"seedance\"}"
fire "i2v-kling"     mode-router "{\"mode\":\"image-to-video\",\"prompt\":\"The portrait subtly comes alive, eyes blink, hair moves in a soft breeze\",\"imageUrl\":\"$FACE\",\"aspectRatio\":\"9:16\",\"clipCount\":1,\"clipDuration\":5,\"videoEngine\":\"kling\"}"

echo "=== ALL FIRED ==="; cat "$RESULTS"

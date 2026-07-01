#!/bin/bash
cd "$(dirname "$0")/.."
set -a; . ./.env >/dev/null 2>&1; . ./.env.local >/dev/null 2>&1; set +a
SR="$SUPABASE_SERVICE_ROLE_KEY"; URL="$VITE_SUPABASE_URL"; OWNER="8be6d9c9-776e-46af-9ad8-23ad41f0f99c"
mv(){ curl -s -o /dev/null -w "  %{http_code} $2\n" -X PATCH "$URL/rest/v1/movie_projects?id=eq.$1" -H "apikey: $SR" -H "Authorization: Bearer $SR" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d "{\"user_id\":\"$OWNER\",\"title\":\"$2\"}"; }
# UI-created (the real proof set)
mv ff40f51d-0bed-41c2-8952-f8c05707c2f3 "UI · Text-to-Video · WAN (5s)"
mv 60beaf20-674c-4f1a-bdaf-24c877654eb9 "UI · Text-to-Video · KLING (5s)"
mv 94cb7033-4e67-4d3e-a99b-4d6f8c47f22c "UI · Text-to-Video · SEEDANCE (5s)"
mv 9d3e041d-e530-454a-9b76-e6558e5a2225 "UI · Text-to-Video · VEO (8s)"
mv 2227f442-74fd-4686-9618-4c406ffa5626 "UI · Text-to-Video · SORA (8s)"
mv 0ae6df2f-8c98-4d30-9cba-719603450697 "UI · TEMPLATE · Cinematic (Neo-Noir)"
mv fda088a5-08ab-4124-b585-562b49a92f9d "UI · TEMPLATE · Commercial (Product Reveal)"
mv 904f849b-9841-48f9-87b5-bd28bc34d56d "UI · TEMPLATE · Educational (Breakdown)"
mv 45521999-af84-4b81-aa4f-869bc03e73a8 "UI · TEMPLATE · Corporate"
mv 995b91b5-dd07-4528-94fe-90c0f9bc2f5b "UI · Avatar · Talking Head (Seedance)"
mv 19cbb059-4afa-4ded-9994-db47fe740dd4 "UI · Text-to-Video · WAN (verify run)"
# API-created (backend proof; pre-credit-out)
mv 0a2ddf2e-1e13-4ad5-8fd7-46ac0e965aab "API · Text-to-Video · WAN"
mv 584eac8c-1b70-4f06-a146-9e9a711c5bbe "API · Text-to-Video · SORA"
mv 9b66e044-8843-4785-951b-70899d5c4729 "API · Text-to-Video · SEEDANCE"
mv 95a304ff-6bb1-4909-9b08-935621efd540 "API · Text-to-Video · VEO"
mv aab5ab89-766d-4d89-890e-9ce3ac9b0efd "API · Breakout/Crossover · Dancer's Leap"
mv b2cddfc2-a046-4f02-96fa-23694734623f "API · Avatar/Learning · Seedance"
mv 22c62928-88cd-471e-a2d2-dbe9d8bbe198 "API · Image-to-Video · Kling"
mv 06b8d71f-f67b-4d04-8d3c-1cd8f233ce0e "API · Avatar · Kling"

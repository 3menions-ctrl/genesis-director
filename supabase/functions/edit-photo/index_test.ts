import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

// Helper to call edit-photo (unauthenticated — should fail auth, but validates safety checks happen first)
async function callEditPhoto(body: Record<string, unknown>) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/edit-photo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

Deno.test("edit-photo - rejects unauthenticated requests", async () => {
  const { response } = await callEditPhoto({
    imageUrl: "https://example.com/test.jpg",
    instruction: "make it brighter",
  });
  assertEquals(response.status, 401);
});

Deno.test("edit-photo - handles CORS preflight", async () => {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/edit-photo`, {
    method: "OPTIONS",
    headers: {
      "Origin": "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  await response.text();
  assertEquals(response.status, 200);
  assertExists(response.headers.get("Access-Control-Allow-Origin"));
});

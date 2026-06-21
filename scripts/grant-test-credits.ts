/**
 * grant-test-credits.ts — one-shot manual credit grant for a test user.
 *
 * Looks the user up by email via auth admin, then calls add_credits()
 * with a unique idempotency token derived from the amount + timestamp.
 *
 * Run:
 *   bunx tsx scripts/grant-test-credits.ts --email=3menions@gmail.com --amount=1000
 *   bunx tsx scripts/grant-test-credits.ts --email=3menions@gmail.com --amount=1000 --apply
 *
 * Without --apply, prints the plan only.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = "https://ywcwaumozoejierlfkgj.supabase.co";

function loadServiceKey(): string {
  const env = readFileSync(resolve(process.cwd(), ".env.local"), "utf-8");
  const line = env
    .split("\n")
    .find((l) => l.startsWith("SUPABASE_SERVICE_ROLE_KEY="));
  if (!line) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  return line.slice("SUPABASE_SERVICE_ROLE_KEY=".length).trim();
}

const KEY = loadServiceKey();

interface Args {
  email: string;
  amount: number;
  apply: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const email = argv.find((a) => a.startsWith("--email="))?.slice(8);
  const amountRaw = argv.find((a) => a.startsWith("--amount="))?.slice(9);
  if (!email) throw new Error("Missing --email=<address>");
  if (!amountRaw) throw new Error("Missing --amount=<integer>");
  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new Error(`Invalid amount: ${amountRaw} (must be 1..100000)`);
  }
  return { email, amount, apply: argv.includes("--apply") };
}

async function findUserIdByEmail(email: string): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?per_page=200`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    },
  );
  if (!res.ok) {
    throw new Error(`auth admin lookup failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const list: Array<{ id: string; email?: string }> = body.users ?? [];
  const match = list.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
  if (!match) {
    throw new Error(`No auth user found for ${email}. Checked ${list.length} accounts.`);
  }
  return match.id;
}

async function callRpc(name: string, args: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${name} failed: ${res.status} ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function getProfileBalance(userId: string): Promise<number | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=credits_balance`,
    {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
      },
    },
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows?.[0]?.credits_balance ?? null;
}

async function main() {
  const args = parseArgs();
  console.log(`▷ email=${args.email} amount=${args.amount} apply=${args.apply}`);

  const userId = await findUserIdByEmail(args.email);
  console.log(`✓ user id: ${userId}`);

  const before = await getProfileBalance(userId);
  console.log(`✓ current credits_balance: ${before ?? "(unknown)"}`);

  if (!args.apply) {
    console.log("✗ dry run — re-run with --apply to grant credits");
    return;
  }

  // Stable, traceable idempotency key. Re-running with the same key on the
  // same day is a no-op (add_credits dedupes on stripe_payment_id).
  const token = `MANUAL_TEST_GRANT_${args.email}_${args.amount}_${new Date()
    .toISOString()
    .slice(0, 10)}`;

  const result = await callRpc("add_credits", {
    p_user_id: userId,
    p_amount: args.amount,
    p_description: `Manual test grant (${args.amount} cr) — bcole@genesis`,
    p_stripe_payment_id: token,
  });
  console.log(`✓ add_credits result:`, result);

  const after = await getProfileBalance(userId);
  console.log(`✓ new credits_balance: ${after ?? "(unknown)"}`);
}

main().catch((err) => {
  console.error("❌", err.message);
  process.exit(1);
});

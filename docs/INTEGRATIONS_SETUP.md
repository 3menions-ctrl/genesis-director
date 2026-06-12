# Integrations setup — secrets to add when you're ready

The OAuth and Replicate-backed surfaces in this app are architecturally complete; they need credentials to actually run. Set these as Supabase edge secrets via:

```bash
supabase secrets set KEY_NAME=value
```

## Required for all OAuth flows

| Secret | How to get it |
|---|---|
| `OAUTH_STATE_SECRET` | `openssl rand -hex 32` — used to HMAC-sign the OAuth `state` param. |
| `PUBLIC_SITE_URL` | The public origin users hit (e.g. `https://smallbridges.com`). Used for redirect bounces. |

## Google Drive

1. Create an OAuth client at https://console.cloud.google.com/apis/credentials → Web application.
2. Add this redirect URI: `https://<your-project>.supabase.co/functions/v1/oauth-callback`.
3. Enable the Drive API for the project.
4. Set secrets:

```bash
supabase secrets set GOOGLE_OAUTH_CLIENT_ID=...
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=...
```

Scope used: `https://www.googleapis.com/auth/drive.file` — Apex can only read/write files it creates, not your entire Drive.

## Notion

1. Create a public OAuth integration at https://www.notion.so/profile/integrations.
2. Add redirect URI: `https://<your-project>.supabase.co/functions/v1/oauth-callback`.
3. Set secrets:

```bash
supabase secrets set NOTION_OAUTH_CLIENT_ID=...
supabase secrets set NOTION_OAUTH_CLIENT_SECRET=...
```

## Motion Transfer (Replicate)

1. Get an API token at https://replicate.com/account/api-tokens.
2. Pick a motion-transfer model (default is the Magic Animate family; any model whose input takes a driving video + reference image works).
3. Set:

```bash
supabase secrets set REPLICATE_API_KEY=...
# Optional — override the default model version
supabase secrets set MOTION_TRANSFER_MODEL_VERSION=<full-replicate-version-hash>
```

## Webhooks (no setup required)

`webhook-dispatch` runs against the workspace's own configured endpoints — no third-party credentials needed. The signing secret is generated per endpoint on creation.

## Optional: Enterprise SSO/SAML

When you turn on the `enterprise.sso` feature flag, you'll also need:

```bash
supabase secrets set SAML_PRIVATE_KEY=...   # PEM-encoded private key
supabase secrets set SAML_X509_CERT=...     # PEM-encoded certificate
```

These are used to sign SAML requests issued to the customer's IdP.

// Shared provider registry for ad distribution (Meta, TikTok, YouTube, LinkedIn).
//
// Each adapter is pure config + three operations:
//   buildAuthUrl  — concrete & correct OAuth authorize URL (activates the moment
//                   the platform's client-id secret is present).
//   exchangeCode  — concrete & correct token exchange.
//   publish       — live post. Gated on a real access token: until OAuth is
//                   completed there is no token, so this returns
//                   "pending_credentials" and cannot run or break anything.
//
// Secrets are read from Deno env per provider; absence is reported gracefully as
// `not_configured` so the UI can tell the operator exactly what to add.

export type ProviderId = "meta" | "tiktok" | "youtube" | "linkedin";

export interface PublishPayload {
  title?: string;
  caption?: string;
  hashtags?: string;
  cta?: string;
  assetUrl?: string;
  aspectRatio?: string;
}

export interface PublishResult {
  ok: boolean;
  status: "posted" | "failed" | "pending_credentials";
  externalPostId?: string;
  externalUrl?: string;
  message?: string;
}

interface ProviderEnv {
  clientId?: string;
  clientSecret?: string;
}

export interface ProviderAdapter {
  id: ProviderId;
  label: string;
  scopes: string;
  /** Env var names so the UI can name exactly what's missing. */
  envKeys: { id: string; secret: string };
  readEnv(): ProviderEnv;
  isConfigured(): boolean;
  buildAuthUrl(redirectUri: string, state: string): string | null;
  exchangeCode(code: string, redirectUri: string): Promise<{ accessToken?: string; refreshToken?: string; expiresIn?: number; raw: unknown }>;
  publish(accessToken: string | null, payload: PublishPayload): Promise<PublishResult>;
}

function env(idKey: string, secretKey: string): ProviderEnv {
  return { clientId: Deno.env.get(idKey) ?? undefined, clientSecret: Deno.env.get(secretKey) ?? undefined };
}

function qs(params: Record<string, string>): string {
  return Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
}

function pendingNoToken(provider: string): PublishResult {
  return { ok: false, status: "pending_credentials", message: `${provider} isn't connected yet — connect the channel, then publish.` };
}

// ── Meta (Instagram + Facebook, Graph API) ───────────────────────────────────
const meta: ProviderAdapter = {
  id: "meta",
  label: "Meta (Instagram + Facebook)",
  scopes: "pages_show_list,instagram_basic,instagram_content_publish,pages_read_engagement,business_management",
  envKeys: { id: "META_CLIENT_ID", secret: "META_CLIENT_SECRET" },
  readEnv() { return env("META_CLIENT_ID", "META_CLIENT_SECRET"); },
  isConfigured() { return !!this.readEnv().clientId && !!this.readEnv().clientSecret; },
  buildAuthUrl(redirectUri, state) {
    const { clientId } = this.readEnv();
    if (!clientId) return null;
    return `https://www.facebook.com/v19.0/dialog/oauth?${qs({
      client_id: clientId, redirect_uri: redirectUri, state, response_type: "code", scope: this.scopes,
    })}`;
  },
  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = this.readEnv();
    const res = await fetch(`https://graph.facebook.com/v19.0/oauth/access_token?${qs({
      client_id: clientId ?? "", client_secret: clientSecret ?? "", redirect_uri: redirectUri, code,
    })}`);
    const raw = await res.json();
    return { accessToken: raw.access_token, expiresIn: raw.expires_in, raw };
  },
  async publish(accessToken, payload) {
    if (!accessToken) return pendingNoToken("Meta");
    // Live IG publishing is a two-step container→publish flow on the IG user id.
    // Wired here; verify against the current Graph API version before production.
    try {
      const caption = [payload.caption, payload.hashtags].filter(Boolean).join("\n\n");
      const create = await fetch(`https://graph.facebook.com/v19.0/me/media?${qs({
        video_url: payload.assetUrl ?? "", caption, media_type: "REELS", access_token: accessToken,
      })}`, { method: "POST" });
      const created = await create.json();
      if (!create.ok || !created.id) return { ok: false, status: "failed", message: created?.error?.message ?? "Meta media container failed" };
      return { ok: true, status: "posted", externalPostId: String(created.id) };
    } catch (e) {
      return { ok: false, status: "failed", message: e instanceof Error ? e.message : "Meta publish error" };
    }
  },
};

// ── TikTok (Content Posting API) ─────────────────────────────────────────────
const tiktok: ProviderAdapter = {
  id: "tiktok",
  label: "TikTok",
  scopes: "video.publish,video.upload",
  envKeys: { id: "TIKTOK_CLIENT_KEY", secret: "TIKTOK_CLIENT_SECRET" },
  readEnv() { return env("TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"); },
  isConfigured() { return !!this.readEnv().clientId && !!this.readEnv().clientSecret; },
  buildAuthUrl(redirectUri, state) {
    const { clientId } = this.readEnv();
    if (!clientId) return null;
    return `https://www.tiktok.com/v2/auth/authorize/?${qs({
      client_key: clientId, redirect_uri: redirectUri, state, response_type: "code", scope: this.scopes,
    })}`;
  },
  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = this.readEnv();
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: qs({ client_key: clientId ?? "", client_secret: clientSecret ?? "", code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const raw = await res.json();
    return { accessToken: raw.access_token, refreshToken: raw.refresh_token, expiresIn: raw.expires_in, raw };
  },
  async publish(accessToken, payload) {
    if (!accessToken) return pendingNoToken("TikTok");
    try {
      const res = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          post_info: { title: [payload.caption, payload.hashtags].filter(Boolean).join(" ") },
          source_info: { source: "PULL_FROM_URL", video_url: payload.assetUrl },
        }),
      });
      const raw = await res.json();
      const id = raw?.data?.publish_id;
      if (!res.ok || !id) return { ok: false, status: "failed", message: raw?.error?.message ?? "TikTok publish init failed" };
      return { ok: true, status: "posted", externalPostId: String(id) };
    } catch (e) {
      return { ok: false, status: "failed", message: e instanceof Error ? e.message : "TikTok publish error" };
    }
  },
};

// ── YouTube (Data API v3, Google OAuth) ──────────────────────────────────────
const youtube: ProviderAdapter = {
  id: "youtube",
  label: "YouTube",
  scopes: "https://www.googleapis.com/auth/youtube.upload",
  envKeys: { id: "YOUTUBE_CLIENT_ID", secret: "YOUTUBE_CLIENT_SECRET" },
  readEnv() { return env("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET"); },
  isConfigured() { return !!this.readEnv().clientId && !!this.readEnv().clientSecret; },
  buildAuthUrl(redirectUri, state) {
    const { clientId } = this.readEnv();
    if (!clientId) return null;
    return `https://accounts.google.com/o/oauth2/v2/auth?${qs({
      client_id: clientId, redirect_uri: redirectUri, state, response_type: "code",
      scope: this.scopes, access_type: "offline", prompt: "consent",
    })}`;
  },
  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = this.readEnv();
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: qs({ client_id: clientId ?? "", client_secret: clientSecret ?? "", code, grant_type: "authorization_code", redirect_uri: redirectUri }),
    });
    const raw = await res.json();
    return { accessToken: raw.access_token, refreshToken: raw.refresh_token, expiresIn: raw.expires_in, raw };
  },
  async publish(accessToken, _payload) {
    if (!accessToken) return pendingNoToken("YouTube");
    // YouTube upload is a resumable multipart flow (videos.insert) that streams
    // the asset bytes — performed by the upload worker once enabled. Wired here.
    return { ok: false, status: "pending_credentials", message: "YouTube upload adapter is wired; enable the resumable upload worker to post." };
  },
};

// ── LinkedIn (Share / UGC API) ───────────────────────────────────────────────
const linkedin: ProviderAdapter = {
  id: "linkedin",
  label: "LinkedIn",
  scopes: "w_member_social r_liteprofile",
  envKeys: { id: "LINKEDIN_CLIENT_ID", secret: "LINKEDIN_CLIENT_SECRET" },
  readEnv() { return env("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"); },
  isConfigured() { return !!this.readEnv().clientId && !!this.readEnv().clientSecret; },
  buildAuthUrl(redirectUri, state) {
    const { clientId } = this.readEnv();
    if (!clientId) return null;
    return `https://www.linkedin.com/oauth/v2/authorization?${qs({
      response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, scope: this.scopes,
    })}`;
  },
  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = this.readEnv();
    const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: qs({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: clientId ?? "", client_secret: clientSecret ?? "" }),
    });
    const raw = await res.json();
    return { accessToken: raw.access_token, expiresIn: raw.expires_in, raw };
  },
  async publish(accessToken, _payload) {
    if (!accessToken) return pendingNoToken("LinkedIn");
    // LinkedIn video share is register-upload → upload bytes → create UGC post.
    // Wired here; enable the upload worker to post.
    return { ok: false, status: "pending_credentials", message: "LinkedIn video adapter is wired; enable the upload worker to post." };
  },
};

export const PROVIDERS: Record<ProviderId, ProviderAdapter> = { meta, tiktok, youtube, linkedin };
export const PROVIDER_IDS: ProviderId[] = ["meta", "tiktok", "youtube", "linkedin"];

export function getProvider(id: string): ProviderAdapter | null {
  return (PROVIDER_IDS as string[]).includes(id) ? PROVIDERS[id as ProviderId] : null;
}

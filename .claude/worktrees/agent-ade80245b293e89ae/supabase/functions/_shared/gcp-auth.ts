/**
 * Shared GCP Authentication Helper
 * 
 * Provides OAuth2 access token generation for Google Cloud Platform services.
 * Used by video generation, analysis, and other GCP-dependent edge functions.
 */

export interface GCPServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

/**
 * Get OAuth2 access token from a GCP service account
 * 
 * @param serviceAccount - The parsed GCP service account JSON
 * @returns Promise<string> - The access token
 * @throws Error if token generation fails
 */
export async function getAccessToken(serviceAccount: GCPServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour expiry

  // Create JWT header and payload
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: exp,
    scope: "https://www.googleapis.com/auth/cloud-platform"
  };

  // Base64URL encode helper
  const base64UrlEncode = (obj: object): string => {
    const str = JSON.stringify(obj);
    const bytes = new TextEncoder().encode(str);
    let base64 = btoa(String.fromCharCode(...bytes));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  };

  const headerB64 = base64UrlEncode(header);
  const payloadB64 = base64UrlEncode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key and sign
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${unsignedToken}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error("[GCP Auth] OAuth token error:", error);
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

/**
 * Parse and validate GCP service account JSON from environment
 * 
 * @param envVarName - Name of the environment variable (default: "GCP_SERVICE_ACCOUNT")
 * @returns The parsed service account object
 * @throws Error if not found or invalid JSON
 */
export function parseServiceAccount(envVarName: string = "GCP_SERVICE_ACCOUNT"): GCPServiceAccount {
  const serviceAccountJson = Deno.env.get(envVarName);
  if (!serviceAccountJson) {
    throw new Error(`${envVarName} environment variable is not set`);
  }
  
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (!serviceAccount.client_email || !serviceAccount.private_key || !serviceAccount.project_id) {
      throw new Error("Service account missing required fields");
    }
    return serviceAccount as GCPServiceAccount;
  } catch (e) {
    throw new Error(`Failed to parse ${envVarName}: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
  }
}

/**
 * Get project ID from service account
 */
export function getProjectId(serviceAccount: GCPServiceAccount): string {
  return serviceAccount.project_id;
}

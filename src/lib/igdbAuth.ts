// File: lib/igdbAuth.ts
// Purpose: Shared IGDB OAuth token acquisition with module-level caching

// ─── Internal — utils/lib
import { safeFetchJson } from "./safeFetch";

// ─── Internal types
interface IgdbTokenResponse {
  access_token: string;
  expires_in: number;
}

// ─── Module-level cache
const igdbTokenCache = {
  token: null as string | null,
  expiresAt: 0,
};

// ─── Exported Function: getIgdbAccessToken
/**
 * Retrieves a valid IGDB access token from cache or by fetching a new one from Twitch OAuth.
 * Refreshes the token if it's within 60 seconds of expiry.
 */
export const getIgdbAccessToken = async (): Promise<{
  token: string | null;
  error: string;
}> => {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { token: null, error: "Game data provider is not configured (missing credentials)." };
  }

  const now = Date.now();
  
  // Use cached token if valid and not expiring within 60s
  if (igdbTokenCache.token && igdbTokenCache.expiresAt > now + 60_000) {
    return { token: igdbTokenCache.token, error: "" };
  }

  const tokenUrl = `https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(
    clientSecret,
  )}&grant_type=client_credentials`;

  const response = await safeFetchJson<IgdbTokenResponse>(tokenUrl, { method: "POST" });

  if (!response.ok) {
    return { token: null, error: `Failed to acquire IGDB token: ${response.error}` };
  }

  const payload = response.data;
  if (!payload.access_token || typeof payload.expires_in !== "number") {
    return { token: null, error: "Game data provider authentication returned invalid payload." };
  }

  // Update cache
  igdbTokenCache.token = payload.access_token;
  igdbTokenCache.expiresAt = now + payload.expires_in * 1000;

  return { token: payload.access_token, error: "" };
};

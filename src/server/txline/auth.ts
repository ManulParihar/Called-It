// Handles the two TxLINE credentials the data feed needs.
//
// There are two pieces:
//   1. A guest token from POST /auth/guest/start. Short lived, renewed when a
//      request comes back 401.
//   2. An API token from POST /api/token/activate. This is created once, after
//      an on chain subscribe, and then stays valid. We hold one API token for
//      the whole app, so players never subscribe to TxLINE themselves.
//
// Both are kept on the server and sent with every data request as headers.

export interface TxlineCredentials {
  jwt: string;
  apiToken: string;
}

export function baseUrl(): string {
  return process.env.TXLINE_BASE_URL || "https://txline-dev.txodds.com";
}

// Fetches a fresh guest token.
export async function fetchGuestJwt(): Promise<string> {
  const res = await fetch(`${baseUrl()}/auth/guest/start`, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Guest token request failed with status ${res.status}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("Guest token response had no token");
  return body.token;
}

export interface ActivateArgs {
  jwt: string;
  // Signature from the on chain subscribe transaction.
  txSig: string;
  // Detached signature over the activation preimage, base64 encoded.
  walletSignature: string;
  // Leagues to activate. Empty for the standard free tier.
  leagues?: string[];
}

// The message that the wallet signs to prove ownership when activating a token.
// The format is: txSig, then the leagues joined by commas, then the guest jwt.
export function activationPreimage(
  txSig: string,
  jwt: string,
  leagues: string[] = [],
): string {
  return `${txSig}:${leagues.join(",")}:${jwt}`;
}

// Turns a completed subscribe transaction into a persistent API token.
export async function activateApiToken(args: ActivateArgs): Promise<string> {
  const res = await fetch(`${baseUrl()}/api/token/activate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      txSig: args.txSig,
      walletSignature: args.walletSignature,
      leagues: args.leagues ?? [],
    }),
  });
  if (!res.ok) {
    throw new Error(`Token activation failed with status ${res.status}`);
  }
  const body = (await res.json()) as { token?: string };
  if (!body.token) throw new Error("Token activation response had no token");
  return body.token;
}

// Holds the current credentials and refreshes the guest token when needed. The
// API token is read from the environment because it is created once out of band
// during setup.
export class CredentialStore {
  private jwt: string | null = null;
  private readonly apiToken: string;

  constructor(apiToken?: string) {
    const token = apiToken ?? process.env.TXLINE_API_TOKEN;
    if (!token) {
      throw new Error("Missing TXLINE_API_TOKEN. Activate one during setup.");
    }
    this.apiToken = token;
  }

  async current(): Promise<TxlineCredentials> {
    if (!this.jwt) this.jwt = await fetchGuestJwt();
    return { jwt: this.jwt, apiToken: this.apiToken };
  }

  // Forces a new guest token on the next call, used after a 401.
  async refresh(): Promise<TxlineCredentials> {
    this.jwt = await fetchGuestJwt();
    return { jwt: this.jwt, apiToken: this.apiToken };
  }

  authHeaders(creds: TxlineCredentials): Record<string, string> {
    return {
      Authorization: `Bearer ${creds.jwt}`,
      "X-Api-Token": creds.apiToken,
    };
  }
}

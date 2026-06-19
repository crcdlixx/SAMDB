const tokenKey = "samdb.authToken";

let memoryToken: string | null = null;

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage;
}

export function getAuthToken(): string | null {
  return memoryToken ?? storage()?.getItem(tokenKey) ?? null;
}

export function setAuthToken(token: string): void {
  memoryToken = token;
  storage()?.setItem(tokenKey, token);
}

export function clearAuthToken(): void {
  memoryToken = null;
  storage()?.removeItem(tokenKey);
}

const KEY = "signal-desk-dash-secret";

export function readDashSecret(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.sessionStorage.getItem(KEY) ?? "";
}

export function writeDashSecret(secret: string): void {
  window.sessionStorage.setItem(KEY, secret.trim());
}

export function dashHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  const secret = readDashSecret();
  if (secret) {
    headers.set("x-dash-secret", secret);
  }
  return headers;
}

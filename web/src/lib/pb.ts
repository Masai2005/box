import PocketBase from "pocketbase";

// Same origin in production. In dev, Vite proxies /api and /_ to the Go process.
export const pb = new PocketBase(window.location.origin);

// The UI drives one superuser session; don't auto-cancel requests when filters change.
pb.autoCancellation(false);

// A password change or account recreation rotates the token key. Drop a stale session so the
// route guard sends the user back to login instead of retrying every request with a dead token.
pb.afterSend = (response, data) => {
  if (response.status === 401 && pb.authStore.isValid) {
    pb.authStore.clear();
  }
  return data;
};

export type Json = Record<string, any>;

export function isSuperuser(): boolean {
  return pb.authStore.isValid && pb.authStore.isSuperuser;
}

export function errorMessage(err: unknown): string {
  const e = err as any;
  const data = e?.response?.data;
  if (data && typeof data === "object" && !data.message) {
    const fields = Object.entries(data)
      .map(([field, value]: [string, any]) => {
        const message = typeof value === "string" ? value : value?.message;
        return message ? `${field}: ${message}` : "";
      })
      .filter(Boolean);
    if (fields.length) return fields.join("\n");
  }
  return (
    e?.response?.message ||
    data?.message ||
    e?.message ||
    "Something went wrong."
  );
}

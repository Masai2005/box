import PocketBase from "pocketbase";

// Same origin in production. In dev, Vite proxies /api and /_ to the Go process.
export const pb = new PocketBase(window.location.origin);

// The UI drives one superuser session; don't auto-cancel requests when filters change.
pb.autoCancellation(false);

export type Json = Record<string, any>;

export function isSuperuser(): boolean {
  return pb.authStore.isValid && pb.authStore.isSuperuser;
}

export function errorMessage(err: unknown): string {
  const e = err as any;
  return (
    e?.response?.message ||
    e?.response?.data?.message ||
    e?.message ||
    "Something went wrong."
  );
}

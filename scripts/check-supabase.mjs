// Read-only check of the public Auth endpoint; does not query or modify student data.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("Fill both Supabase values in .env.local first.");
  process.exit(1);
}
if (!key.startsWith("sb_publishable_")) {
  console.error("Use the Supabase publishable key (sb_publishable_), not a secret or service-role key.");
  process.exit(1);
}
try {
  const endpoint = new URL("/auth/v1/settings", url);
  if (endpoint.protocol !== "https:") throw new Error("HTTPS required");
  const response = await fetch(endpoint, {
    headers: { apikey: key },
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    console.error(`Connection check failed (HTTP ${response.status}). Check the URL, publishable key, and project status.`);
    process.exitCode = 1;
  } else {
    console.log("Supabase public API connection verified. Database access and RLS are not tested by this check.");
  }
} catch {
  console.error("Could not reach Supabase. Check the project URL, internet connection, and project status.");
  process.exitCode = 1;
}

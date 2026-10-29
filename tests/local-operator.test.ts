// node --test tests/   (Node 24 runs TypeScript directly by stripping types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { localOperatorRefusal } from "../src/lib/tammeni/local-operator.ts";

const on = { TAMMENI_LOCAL_OPERATOR: "1", NODE_ENV: "development" };
// What `next dev` hands a route for a request typed into this machine's browser.
const local = (extra: Record<string, string> = {}) =>
  new Headers({ host: "localhost:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-for": "::1", "x-forwarded-proto": "http", ...extra });
// What it hands a route for the same page opened through ngrok.
const ngrok = (extra: Record<string, string> = {}) =>
  new Headers({ host: "abc123.ngrok-free.app", "x-forwarded-host": "abc123.ngrok-free.app", "x-forwarded-for": "203.0.113.7", "x-forwarded-proto": "https", ...extra });
const signIn = { signIn: true };

test("allowed for a direct local request in next dev with the flag on", () => {
  assert.equal(localOperatorRefusal(on, local()), null);
  assert.equal(localOperatorRefusal(on, local({ host: "127.0.0.1:3000", "x-forwarded-host": "127.0.0.1:3000", "x-forwarded-for": "127.0.0.1" })), null);
  assert.equal(localOperatorRefusal(on, local({ host: "[::1]:3000", "x-forwarded-host": "[::1]:3000" })), null);
  assert.equal(localOperatorRefusal(on, local({ origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }), signIn), null);
});

test("off unless explicitly enabled", () => {
  assert.equal(localOperatorRefusal({ NODE_ENV: "development" }, local()), "off");
  assert.equal(localOperatorRefusal({ ...on, TAMMENI_LOCAL_OPERATOR: "true" }, local()), "off");
  assert.equal(localOperatorRefusal({ ...on, TAMMENI_LOCAL_OPERATOR: "" }, local()), "off");
});

test("never on a production server or a deploy, even with the flag", () => {
  assert.equal(localOperatorRefusal({ ...on, NODE_ENV: "production" }, local()), "not-dev-server");
  assert.equal(localOperatorRefusal({ ...on, NODE_ENV: undefined }, local()), "not-dev-server");
  assert.equal(localOperatorRefusal({ ...on, VERCEL: "1" }, local()), "hosted");
});

test("refused through ngrok, including when the tunnel rewrites Host to localhost", () => {
  assert.equal(localOperatorRefusal(on, ngrok()), "host");
  // ngrok --host-header=rewrite: Host looks local, but the forwarded headers still show the tunnel.
  assert.equal(localOperatorRefusal(on, ngrok({ host: "localhost:3000" })), "forwarded-host");
  assert.equal(localOperatorRefusal(on, ngrok({ host: "localhost:3000", "x-forwarded-host": "localhost:3000" })), "forwarded-for");
  assert.equal(localOperatorRefusal(on, ngrok({ host: "localhost:3000", "x-forwarded-host": "localhost:3000", "x-forwarded-for": "::1" })), "forwarded-proto");
});

test("refused from the local network or behind any other proxy", () => {
  assert.equal(localOperatorRefusal(on, local({ host: "192.168.1.20:3000", "x-forwarded-host": "192.168.1.20:3000", "x-forwarded-for": "192.168.1.31" })), "host");
  assert.equal(localOperatorRefusal(on, local({ "x-forwarded-for": "203.0.113.7, ::1" })), "forwarded-for");
  assert.equal(localOperatorRefusal(on, local({ "x-forwarded-for": "" })), "forwarded-for");
  assert.equal(localOperatorRefusal(on, local({ forwarded: "for=203.0.113.7" })), "proxy");
  assert.equal(localOperatorRefusal(on, local({ "x-real-ip": "203.0.113.7" })), "proxy");
  assert.equal(localOperatorRefusal(on, local({ host: "localhost.evil.example:3000" })), "host");
});

test("the sign-in itself must come from a page on the same local origin", () => {
  assert.equal(localOperatorRefusal(on, local(), signIn), "origin");
  assert.equal(localOperatorRefusal(on, local({ origin: "https://evil.example" }), signIn), "origin");
  assert.equal(localOperatorRefusal(on, local({ origin: "http://localhost:4000" }), signIn), "origin");
  assert.equal(localOperatorRefusal(on, local({ origin: "http://localhost:3000", "sec-fetch-site": "cross-site" }), signIn), "origin");
});

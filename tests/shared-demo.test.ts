import { test } from "node:test";
import assert from "node:assert/strict";
import { dispatchModeForSession, sharedDemoEnabled, sharedDemoRefusal } from "../src/lib/tammeni/shared-demo.ts";

const on = { TAMMENI_SHARED_DEMO: "1" };
const tunnel = (extra: Record<string, string> = {}) =>
  new Headers({
    host: "demo.example.ngrok-free.app",
    origin: "https://demo.example.ngrok-free.app",
    "sec-fetch-site": "same-origin",
    ...extra,
  });

test("shared demo is off unless the setting is exactly 1", () => {
  assert.equal(sharedDemoEnabled({}), false);
  assert.equal(sharedDemoEnabled({ TAMMENI_SHARED_DEMO: "" }), false);
  assert.equal(sharedDemoEnabled({ TAMMENI_SHARED_DEMO: "true" }), false);
  assert.equal(sharedDemoEnabled(on), true);
  assert.equal(sharedDemoRefusal({}, tunnel(), { signIn: true }), "off");
});

test("a same-origin request on the shared URL may sign the operator in", () => {
  assert.equal(sharedDemoRefusal(on, tunnel(), { signIn: true }), null);
  assert.equal(sharedDemoRefusal(on, new Headers({ host: "localhost:3000", origin: "http://localhost:3000", "sec-fetch-site": "same-origin" }), { signIn: true }), null);
});

test("another site cannot start the shared operator session", () => {
  assert.equal(sharedDemoRefusal(on, tunnel({ origin: "https://evil.example" }), { signIn: true }), "origin");
  assert.equal(sharedDemoRefusal(on, tunnel({ "sec-fetch-site": "cross-site" }), { signIn: true }), "origin");
  assert.equal(sharedDemoRefusal(on, new Headers({ host: "demo.example.ngrok-free.app" }), { signIn: true }), "origin");
});

test("automatic shared access is mock-only; a password session keeps the configured provider", () => {
  assert.equal(dispatchModeForSession(true), "mock");
  assert.equal(dispatchModeForSession(false), "configured");
});

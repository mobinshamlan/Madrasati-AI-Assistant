import test from "node:test";
import assert from "node:assert/strict";
import { directDemoAllowed } from "../src/lib/tammeni/direct-demo.ts";
const env = { NODE_ENV: "development" };
test("direct local demo needs no session or password", () => {
 assert.equal(directDemoAllowed(env, new Headers({host:"localhost:3000"})), true);
});
test("direct demo refuses production and public forwarding", () => {
 assert.equal(directDemoAllowed({NODE_ENV:"production"}, new Headers({host:"localhost:3000"})), false);
 const cases: Record<string, string>[] = [{host:"test.ngrok.app"},{"x-forwarded-for":"192.168.1.2"},{origin:"https://other.test"},{"x-forwarded-proto":"https"},{"sec-fetch-site":"cross-site"}];
 for (const extra of cases) {
  assert.equal(directDemoAllowed(env,new Headers({host:"localhost:3000",...extra})),false);
 }
});

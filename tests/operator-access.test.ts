import test from "node:test";
import assert from "node:assert/strict";
import { crossOriginWriteRefused, operatorCredentialsValid } from "../src/lib/tammeni/operator-access.ts";

const env = { TAMMENI_OPERATOR_PASSWORD: "local-test-only" };
const basic = (credentials: string) => `Basic ${Buffer.from(credentials).toString("base64")}`;

test("accepts the operator with the right password", () => {
  assert.equal(operatorCredentialsValid(env, basic("operator:local-test-only")), true);
  assert.equal(operatorCredentialsValid({ TAMMENI_OPERATOR_PASSWORD: "a:b" }, basic("operator:a:b")), true);
});

test("refuses a wrong password or username", () => {
  assert.equal(operatorCredentialsValid(env, basic("operator:wrong")), false);
  assert.equal(operatorCredentialsValid(env, basic("operator:")), false);
  assert.equal(operatorCredentialsValid(env, basic("admin:local-test-only")), false);
});

test("refuses a missing or malformed header", () => {
  assert.equal(operatorCredentialsValid(env, null), false);
  for (const header of ["", "Basic", "Basic ", "Bearer abc", "Basic not base64!", basic("operator-no-colon")]) {
    assert.equal(operatorCredentialsValid(env, header), false, header);
  }
});

test("fails closed when the password is unset or empty", () => {
  assert.equal(operatorCredentialsValid({}, basic("operator:")), false);
  assert.equal(operatorCredentialsValid({}, basic("operator:undefined")), false);
  assert.equal(operatorCredentialsValid({ TAMMENI_OPERATOR_PASSWORD: "" }, basic("operator:")), false);
});

test("reads are never refused as cross-origin", () => {
  const headers = new Headers({ host: "tammeni.test", origin: "https://evil.test", "sec-fetch-site": "cross-site" });
  assert.equal(crossOriginWriteRefused("GET", headers), false);
  assert.equal(crossOriginWriteRefused("HEAD", headers), false);
});

test("same-origin writes pass", () => {
  assert.equal(crossOriginWriteRefused("POST", new Headers({ host: "tammeni.test" })), false);
  assert.equal(crossOriginWriteRefused("POST", new Headers({ host: "tammeni.test", origin: "https://tammeni.test", "sec-fetch-site": "same-origin" })), false);
  assert.equal(crossOriginWriteRefused("POST", new Headers({ host: "localhost:3456", origin: "http://localhost:3456" })), false);
});

test("cross-origin writes are refused", () => {
  const cases: Record<string, string>[] = [
    { "sec-fetch-site": "cross-site" },
    { "sec-fetch-site": "same-site" },
    { origin: "https://evil.test" },
    { origin: "https://tammeni.test:8443" },
    { origin: "null" },
  ];
  for (const extra of cases) {
    assert.equal(crossOriginWriteRefused("POST", new Headers({ host: "tammeni.test", ...extra })), true, JSON.stringify(extra));
  }
  assert.equal(crossOriginWriteRefused("POST", new Headers({ origin: "https://tammeni.test" })), true);
});

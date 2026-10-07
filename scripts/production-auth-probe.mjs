// Runs inside a disposable client container, never against a public origin.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { networkInterfaces } from "node:os";

const { proxy, email, password } = JSON.parse(readFileSync(0, "utf8"));
assert.match(proxy, /^http:\/\/sparkyrivals-acceptance-[a-f0-9]+-proxy$/);
const origin = "https://sparkyrivals.test";
const headers = {
  "Content-Type": "application/json",
  Origin: origin,
  Host: "sparkyrivals.test",
};
const post = (path, body, extra = {}) =>
  fetch(proxy + path, {
    method: "POST",
    headers: { ...headers, ...extra },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
const closed = await post("/api/auth/sign-up/email", {
  email: "unexpected@example.test",
  password,
  name: "Unexpected",
});
assert.ok(
  closed.status >= 400 && closed.status < 500,
  `signup status ${closed.status}`,
);
const login = await post(
  "/api/auth/sign-in/email",
  { email, password },
  {
    "X-Client-IP": "198.51.100.91",
    "X-Forwarded-For": "198.51.100.92",
    "X-Real-IP": "198.51.100.93",
  },
);
assert.equal(login.status, 200);
const cookies = login.headers.getSetCookie();
const sessionCookie = cookies.find((value) =>
  value.startsWith("__Secure-sparky.session_token="),
);
assert.ok(sessionCookie);
assert.match(sessionCookie, /; Secure/i);
assert.match(sessionCookie, /; HttpOnly/i);
assert.match(sessionCookie, /; SameSite=Lax/i);
const cookie = cookies.map((value) => value.split(";")[0]).join("; ");
for (const path of ["/api/auth/get-session", "/api/v2/challenges"]) {
  const response = await fetch(proxy + path, {
    headers: { ...headers, Cookie: cookie },
    signal: AbortSignal.timeout(20_000),
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  if (path.endsWith("get-session")) assert.equal(body.user.role, "admin");
}
const attempts = [];
for (let i = 0; i < 5; i++) {
  const response = await post(
    "/api/auth/sign-in/email",
    { email, password: password + "-wrong" },
    {
      "X-Client-IP": `198.51.100.${i + 1}`,
      "X-Forwarded-For": `203.0.113.${i + 1}`,
      "X-Real-IP": `192.0.2.${i + 1}`,
    },
  );
  attempts.push(response.status);
}
assert.deepEqual(attempts, [401, 401, 401, 429, 429]);
const clientIp = Object.values(networkInterfaces())
  .flat()
  .find((address) => address?.family === "IPv4" && !address.internal)?.address;
assert.ok(clientIp);
// No response bodies, cookies, routing tokens or passwords in the evidence.
console.log(
  JSON.stringify({
    closedSignup: true,
    authenticatedChallengeRoute: true,
    adminLogin: true,
    secureHttpOnlySameSiteCookie: true,
    spoofedHeadersRateLimited: true,
    attempts,
    clientIp,
  }),
);

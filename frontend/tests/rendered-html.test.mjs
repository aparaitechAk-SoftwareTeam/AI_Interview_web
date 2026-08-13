import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the finished Aparaitech landing page", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Aparaitech AI Interview/i);
  assert.match(html, /AI Interviews/i);
  assert.match(html, /Smarter Hiring/i);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/i);
});

test("keeps candidate and administrator routes wired to the same secure API proxy", async () => {
  const [candidate, interview, admin, proxy] = await Promise.all([
    readFile(new URL("../app/candidate/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/candidate/interview/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/backend/route.ts", import.meta.url), "utf8")
  ]);
  assert.match(candidate, /candidateProfile/);
  assert.match(interview, /MediaRecorder/);
  assert.match(interview, /finalizeRecording/);
  assert.match(admin, /Smart scanner/);
  assert.match(admin, /candidateWhatsAppUrl/);
  assert.match(proxy, /authorization/);
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});

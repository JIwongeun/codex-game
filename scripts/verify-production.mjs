import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const requiredPaths = [
  "dist/server/index.js",
  "dist/server/wrangler.json",
  "dist/client/index.html",
  "dist/client/og.png",
  "dist/client/robots.txt",
  "dist/client/THIRD_PARTY_LICENSES.txt",
  ".openai/hosting.json",
];

await Promise.all(requiredPaths.map((path) => access(path)));

const clientFiles = await filesBelow("dist/client");
let productionCode = "";
for (const path of clientFiles) {
  if (!path.endsWith(".js") && !path.endsWith(".html")) {
    continue;
  }

  const content = await readFile(path, "utf8");
  productionCode += content;
  if (content.includes("qaElapsedSeconds")) {
    throw new Error(`Development QA query leaked into production: ${path}`);
  }
}

for (const requiredRuntimeStorage of [
  "await-codex.guest-session-best.v1",
  "sessionStorage",
]) {
  if (!productionCode.includes(requiredRuntimeStorage)) {
    throw new Error(`Guest session storage is missing: ${requiredRuntimeStorage}`);
  }
}
if (productionCode.includes("await-codex.best-survival-ms.v2")) {
  throw new Error("Legacy persistent best-score key leaked into production.");
}

if (
  !productionCode.includes("await-codex-favicon") ||
  !productionCode.includes("toDataURL") ||
  !productionCode.includes("image/png")
) {
  throw new Error("Runtime-generated PNG favicon is missing from production.");
}

const html = await readFile("dist/client/index.html", "utf8");
for (const requiredFaviconMarkup of [
  'id="await-codex-favicon"',
  'rel="icon"',
  "data:image/svg+xml",
]) {
  if (!html.includes(requiredFaviconMarkup)) {
    throw new Error(
      `Initial HTML favicon is missing: ${requiredFaviconMarkup}`,
    );
  }
}

if (!html.includes('rel="license" href="/THIRD_PARTY_LICENSES.txt"')) {
  throw new Error("Production license link is missing.");
}

const robots = await readFile("dist/client/robots.txt", "utf8");
if (!robots.includes("User-agent: *") || !robots.includes("Disallow: /")) {
  throw new Error("Production robots.txt does not block indexing.");
}

const thirdPartyLicenses = await readFile(
  "dist/client/THIRD_PARTY_LICENSES.txt",
  "utf8",
);
for (const requiredNotice of [
  "Phaser 3.90.0",
  "eventemitter3 5.0.4",
  "Matter.js",
  "Pretendard 1.3.9",
  "SIL OPEN FONT LICENSE Version 1.1",
]) {
  if (!thirdPartyLicenses.includes(requiredNotice)) {
    throw new Error(`Third-party license notice is missing: ${requiredNotice}`);
  }
}
const publicOgUrl =
  "https://await-codex-context-overflow.jygjyg99.chatgpt.site/og.png?v=20260825-1";
for (const requiredMetadata of [
  "await CODEX: CONTEXT//OVERFLOW",
  'http-equiv="Content-Security-Policy"',
  'name="referrer" content="no-referrer"',
  "object-src 'none'",
  "noindex, nofollow, noarchive",
  publicOgUrl,
]) {
  if (!html.includes(requiredMetadata)) {
    throw new Error(`Production metadata is missing: ${requiredMetadata}`);
  }
}
for (const imageMetadataAttribute of [
  'property="og:image"',
  'name="twitter:image"',
]) {
  const attributeIndex = html.indexOf(imageMetadataAttribute);
  const tagStart = html.lastIndexOf("<meta", attributeIndex);
  const tagEnd = html.indexOf(">", attributeIndex);
  const tag = html.slice(tagStart, tagEnd + 1);
  if (attributeIndex < 0 || tagStart < 0 || tagEnd < 0 || !tag.includes(publicOgUrl)) {
    throw new Error(`Production image metadata is incomplete: ${imageMetadataAttribute}`);
  }
}

const hosting = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
if (typeof hosting.project_id !== "string" || hosting.project_id.length === 0) {
  throw new Error("Sites project_id is missing from .openai/hosting.json.");
}

const workerCode = await readFile("dist/server/index.js", "utf8");
for (const requiredHeader of [
  "Content-Security-Policy",
  "Permissions-Policy",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "X-Robots-Tag",
]) {
  if (!workerCode.includes(requiredHeader)) {
    throw new Error(`Worker security header is missing: ${requiredHeader}`);
  }
}
const wrangler = JSON.parse(await readFile("dist/server/wrangler.json", "utf8"));
if (wrangler.assets?.run_worker_first !== true) {
  throw new Error("Static assets are not routed through the security-header Worker.");
}

const og = await readFile("dist/client/og.png");
const pngSignature = "89504e470d0a1a0a";
if (og.subarray(0, 8).toString("hex") !== pngSignature) {
  throw new Error("dist/client/og.png is not a PNG image.");
}

const width = og.readUInt32BE(16);
const height = og.readUInt32BE(20);
if (Math.abs(width / height - 16 / 9) > 0.002) {
  throw new Error(`Open Graph image is not 16:9: ${width}x${height}`);
}

const ogStat = await stat("dist/client/og.png");
if (ogStat.size === 0) {
  throw new Error("Open Graph image is empty.");
}
const maximumSubmissionImageBytes = 10 * 1024 * 1024;
if (ogStat.size > maximumSubmissionImageBytes) {
  throw new Error(
    `Open Graph image exceeds the 10MB submission recommendation: ${ogStat.size} bytes`,
  );
}

console.log(
  `Production verified: ${clientFiles.length} client files, session-only best, license notices, robots policy, Worker security headers, initial and runtime favicon, ${width}x${height} OG image (${ogStat.size} bytes), no QA query.`,
);

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await filesBelow(path)));
    } else {
      files.push(path);
    }
  }

  return files;
}

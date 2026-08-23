import { access, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";

const requiredPaths = [
  "dist/server/index.js",
  "dist/client/index.html",
  "dist/client/og.png",
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

if (
  !productionCode.includes("await-codex-favicon") ||
  !productionCode.includes("toDataURL") ||
  !productionCode.includes("image/png")
) {
  throw new Error("Runtime-generated PNG favicon is missing from production.");
}

const html = await readFile("dist/client/index.html", "utf8");
const publicOgUrl =
  "https://await-codex-context-overflow.jygjyg99.chatgpt.site/og.png";
for (const requiredMetadata of [
  "await CODEX: CONTEXT//OVERFLOW",
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
  `Production verified: ${clientFiles.length} client files, runtime favicon, ${width}x${height} OG image (${ogStat.size} bytes), no QA query.`,
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

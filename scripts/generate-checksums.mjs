import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import { argv, platform } from "node:process";

const defaultBundleDir = "src-tauri/target/release/bundle";
const bundleDir = argv[2] ?? defaultBundleDir;
const outputDir = argv[3] ?? "dist/checksums";
const checksumSuffix = process.env.CHECKSUMS_SUFFIX ?? platform;
const packageJson = JSON.parse(await readFile("package.json", "utf8"));

const artifactExtensions = new Set([
  ".appimage",
  ".deb",
  ".dmg",
  ".exe",
  ".msi",
  ".rpm",
  ".sig",
  ".json",
  ".zip",
]);

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(fullPath)));
      continue;
    }

    const name = basename(fullPath);
    const ext = extname(entry.name).toLowerCase();
    const isCurrentVersion = name.includes(packageJson.version);
    const isUpdaterMetadata = name === "latest.json";

    if (artifactExtensions.has(ext) && (isCurrentVersion || isUpdaterMetadata)) {
      files.push(fullPath);
    }
  }

  return files;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(file);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

if (!existsSync(bundleDir)) {
  console.log(`Bundle directory not found: ${bundleDir}`);
  process.exit(0);
}

const files = (await listFiles(bundleDir)).sort();

if (files.length === 0) {
  console.log(`No release artifacts found in ${bundleDir}`);
  process.exit(0);
}

await mkdir(outputDir, { recursive: true });

const lines = [];
for (const file of files) {
  const digest = await sha256(file);
  lines.push(`${digest}  ${relative(bundleDir, file).replaceAll("\\", "/")}`);
}

const outputFile = join(outputDir, `SHA256SUMS-${checksumSuffix}.txt`);
await writeFile(outputFile, `${lines.join("\n")}\n`);

console.log(`Wrote ${basename(outputFile)} with ${files.length} entries`);

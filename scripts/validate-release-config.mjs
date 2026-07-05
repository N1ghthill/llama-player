import { readFile } from "node:fs/promises";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function readJson(path) {
  return readFile(path, "utf8").then((content) => JSON.parse(content));
}

function readCargoVersion(cargoToml) {
  const packageSection = cargoToml.match(/\[package\]([\s\S]*?)(?:\n\[|$)/);
  const version = packageSection?.[1].match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
  return version ?? null;
}

const [packageJson, tauriConfig, cargoToml] = await Promise.all([
  readJson("package.json"),
  readJson("src-tauri/tauri.conf.json"),
  readFile("src-tauri/Cargo.toml", "utf8"),
]);

const cargoVersion = readCargoVersion(cargoToml);
const versions = {
  "package.json": packageJson.version,
  "tauri.conf.json": tauriConfig.version,
  "Cargo.toml": cargoVersion,
};

const uniqueVersions = new Set(Object.values(versions));
if (uniqueVersions.size !== 1) {
  fail(`Version mismatch: ${JSON.stringify(versions)}`);
}

const identifier = tauriConfig.identifier;
if (!identifier || typeof identifier !== "string") {
  fail("Tauri identifier is missing");
} else if (identifier.endsWith(".app")) {
  fail(`Tauri identifier must not end with .app: ${identifier}`);
}

const bundle = tauriConfig.bundle;
if (!bundle?.active) {
  fail("Tauri bundle.active must be true for release builds");
}

if (!bundle?.createUpdaterArtifacts) {
  fail("Tauri bundle.createUpdaterArtifacts must be true for update releases");
}

const targets = bundle?.targets;
const expectedTargets = ["deb", "rpm", "msi", "dmg"];
if (!Array.isArray(targets) || expectedTargets.some((target) => !targets.includes(target))) {
  fail(`Tauri bundle.targets must include ${expectedTargets.join(", ")}`);
}

const updater = tauriConfig.plugins?.updater;
if (!updater?.pubkey || !Array.isArray(updater.endpoints) || updater.endpoints.length === 0) {
  fail("Tauri updater pubkey/endpoints are required");
}

const assetProtocol = tauriConfig.app?.security?.assetProtocol;
const assetAllow = assetProtocol?.scope?.allow;
if (!assetProtocol?.enable || !Array.isArray(assetAllow) || assetAllow.length === 0) {
  fail("assetProtocol must be enabled with a non-empty allow scope");
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log(`Release config OK for ${packageJson.name} v${packageJson.version}`);

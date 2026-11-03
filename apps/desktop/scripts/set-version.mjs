// Sets the BibleOS version in one go: package.json (which tauri.conf.json reads) and the Rust
// crate, so the app, its installers and the update feed always agree.
// Usage: pnpm --filter desktop release:version 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: release:version <major.minor.patch>, e.g. 0.2.0");
  process.exit(1);
}

const pkgPath = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const previous = pkg.version;
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const cargoPath = new URL("../src-tauri/Cargo.toml", import.meta.url);
const cargo = readFileSync(cargoPath, "utf8").replace(/^version = ".*"$/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`BibleOS ${previous} → ${version}. Commit, merge, then tag v${version} on main to release.`);

import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");

const SRC_DIR = path.join(REPO_ROOT, "database", "migrations");
const DEST_DIR = path.join(REPO_ROOT, "backend", "supabase", "migrations");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listSqlFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".sql"))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  if (!(await exists(SRC_DIR))) {
    throw new Error(`Source migrations dir not found: ${SRC_DIR}`);
  }

  await fs.mkdir(DEST_DIR, { recursive: true });

  const srcFiles = await listSqlFiles(SRC_DIR);
  const destFiles = (await exists(DEST_DIR)) ? await listSqlFiles(DEST_DIR) : [];

  const srcSet = new Set(srcFiles);

  const toDelete = destFiles.filter((name) => !srcSet.has(name));
  const toCopy = srcFiles;

  for (const name of toDelete) {
    await fs.unlink(path.join(DEST_DIR, name));
  }

  for (const name of toCopy) {
    await fs.copyFile(path.join(SRC_DIR, name), path.join(DEST_DIR, name));
  }

  const summary = {
    copied: toCopy.length,
    deleted: toDelete.length,
    src: SRC_DIR,
    dest: DEST_DIR,
  };

  // Keep output machine-readable for CI
  console.log(JSON.stringify({ event: "db.migrations.sync", ...summary }));
}

main().catch((err) => {
  console.error(JSON.stringify({ event: "db.migrations.sync.error", message: err?.message || String(err) }));
  process.exitCode = 1;
});


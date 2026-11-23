import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import pg from "pg";
import { workspaceVersion } from "./workspace-store.mjs";

const envFile = new URL("../.env", import.meta.url);
const supabaseCa = fileURLToPath(new URL("../certs/prod-ca-2021.crt", import.meta.url));

export function databaseErrorCode(error) {
  const code = error?.code;
  return typeof code === "string" && /^[A-Z0-9_]+$/.test(code) ? code : "DATABASE_ERROR";
}

export async function openDatabase() {
  let connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    const contents = await readFile(envFile, "utf8").catch(error => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    connectionString = parseEnv(contents).DATABASE_URL?.trim();
  }
  if (!connectionString) return undefined;

  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || !url.password) {
    throw Object.assign(new Error("Invalid DATABASE_URL"), { code: "INVALID_DATABASE_URL" });
  }
  if (url.hostname.endsWith(".supabase.co") || url.hostname.endsWith(".pooler.supabase.com")) {
    url.searchParams.set("sslmode", "verify-full");
    if (!url.searchParams.has("sslrootcert")) url.searchParams.set("sslrootcert", supabaseCa);
  }
  const pool = new pg.Pool({
    connectionString: url.href,
    ssl: true,
    connectionTimeoutMillis: 10000,
  });
  pool.on("error", error => console.error(`Idle database connection failed (${databaseErrorCode(error)})`));
  return pool;
}

export function postgresWorkspaceStore(database) {
  async function read() {
    const { rows: [row] } = await database.query(
      "SELECT revision, workspace FROM performance_workspace.workspace WHERE id = 1",
    );
    if (row) return { revision: Number(row.revision), workspace: row.workspace };
  }

  async function initialize(workspace, revision) {
    const { rowCount } = await database.query(
      `INSERT INTO performance_workspace.workspace (id, revision, workspace)
       VALUES (1, $1, $2) ON CONFLICT (id) DO NOTHING`,
      [revision, workspace],
    );
    return rowCount === 1;
  }

  async function save(workspace, version, create) {
    if (create) return await initialize(workspace, 1) ? 1 : undefined;

    const revision = Number(version?.slice(1, -1));
    if (!Number.isSafeInteger(revision) || revision < 1 || version !== workspaceVersion(revision)) return undefined;
    const { rows: [updated] } = await database.query(
      `UPDATE performance_workspace.workspace
       SET revision = revision + 1, workspace = $1
       WHERE id = 1 AND revision = $2
       RETURNING revision`,
      [workspace, revision],
    );
    if (updated) return Number(updated.revision);
  }

  return { read, save, initialize };
}

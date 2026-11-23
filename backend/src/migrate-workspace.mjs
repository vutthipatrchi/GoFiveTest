import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { databaseErrorCode, openDatabase, postgresWorkspaceStore } from "./postgres-workspace-store.mjs";
import { validWorkspace } from "./server.mjs";
import { defaultWorkspaceFile, workspaceStore } from "./workspace-store.mjs";

const schemaFile = new URL("../sql/workspace.sql", import.meta.url);

async function migrate(database) {
  const source = await workspaceStore(fileURLToPath(defaultWorkspaceFile)).read();
  if (!source || !validWorkspace(source.workspace)) {
    throw Object.assign(new Error("Missing or invalid local workspace"), { code: "INVALID_LOCAL_WORKSPACE" });
  }
  const schema = await readFile(schemaFile, "utf8");
  const client = await database.connect();
  let discardConnection = false;
  try {
    await client.query("BEGIN");
    await client.query(schema);
    const store = postgresWorkspaceStore(client);
    const inserted = await store.initialize(source.workspace, source.revision);
    const saved = await store.read();
    if (!isDeepStrictEqual(source, saved)) {
      const code = inserted ? "VERIFICATION_FAILED" : "DESTINATION_ALREADY_HAS_DATA";
      throw Object.assign(new Error("Destination does not match the local workspace"), { code });
    }
    await client.query("COMMIT");
    console.log(`${inserted ? "Migrated" : "Already migrated"} workspace revision ${source.revision} with ${source.workspace.people.length} people and ${source.workspace.history?.length ?? 0} archived rounds.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => { discardConnection = true; });
    throw error;
  } finally {
    client.release(discardConnection);
  }
}

let database;
try {
  database = await openDatabase();
  if (!database) {
    console.error("Set DATABASE_URL in backend/.env before running the migration.");
    process.exitCode = 1;
  } else {
    await migrate(database);
  }
} catch (error) {
  console.error(`Workspace migration failed (${databaseErrorCode(error)}).`);
  process.exitCode = 1;
} finally {
  await database?.end();
}

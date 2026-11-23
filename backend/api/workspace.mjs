import { createWorkspaceHandler } from "../src/server.mjs";
import { databaseErrorCode, openDatabase, postgresWorkspaceStore } from "../src/postgres-workspace-store.mjs";

let storePromise;

async function connectStore() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw Object.assign(new Error("Set DATABASE_URL in the Vercel project"), { code: "DATABASE_URL_REQUIRED" });
  }
  return postgresWorkspaceStore(await openDatabase());
}

function getStore() {
  storePromise ??= connectStore().catch(error => {
    storePromise = undefined;
    throw error;
  });
  return storePromise;
}

export default createWorkspaceHandler({
  async read() {
    return (await getStore()).read();
  },
  async save(workspace, version, create) {
    return (await getStore()).save(workspace, version, create);
  },
}, error => {
  console.error(`Workspace database error (${databaseErrorCode(error)})`);
});

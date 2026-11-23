import { createServer } from "node:http";
import { fileURLToPath, pathToFileURL } from "node:url";
import { databaseErrorCode, openDatabase, postgresWorkspaceStore } from "./postgres-workspace-store.mjs";
import { defaultWorkspaceFile, workspaceStore, workspaceVersion } from "./workspace-store.mjs";

const maximumBytes = 8 * 1024 * 1024;
const peopleStatuses = new Set(["employee", "approval", "manager", "returned", "hr", "decided", "published"]);
const teams = new Set(["Operations", "People", "Finance"]);
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const stringFields = (value, fields) => fields.every(field => typeof value[field] === "string");

function validRound(round) {
  if (!object(round) || !object(round.cycle) || !Array.isArray(round.people)) return false;
  const { cycle, people } = round;
  return stringFields(cycle, ["name", "employeeDue", "managerDue"]) &&
    ["draft", "open", "closed"].includes(cycle.status) && object(cycle.reviewers) &&
    Array.isArray(cycle.teams) && cycle.teams.every(team => teams.has(team)) &&
    Number.isInteger(cycle.resultWeight) && cycle.resultWeight >= 1 && cycle.resultWeight <= 99 &&
    people.every(person => object(person) && stringFields(person, ["id", "name", "initials", "title", "cohort", "due"]) &&
      teams.has(person.team) && peopleStatuses.has(person.status) && Array.isArray(person.goals) && Array.isArray(person.activity));
}

export function validWorkspace(workspace) {
  return validRound(workspace) && (workspace.history === undefined ||
    (Array.isArray(workspace.history) && workspace.history.every(round => validRound(round) && round.cycle.status === "closed")));
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function readJson(request) {
  if (request.headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "Send application/json");
  }
  if (Number(request.headers["content-length"]) > maximumBytes) throw new RequestError(413, "Workspace is too large");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > maximumBytes) {
      request.resume();
      throw new RequestError(413, "Workspace is too large");
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8"));
  } catch {
    throw new RequestError(400, "Invalid JSON");
  }
}

function json(response, status, body, version) {
  response.setHeader("Cache-Control", "no-store");
  if (version) response.setHeader("ETag", version);
  if (body !== undefined) response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.statusCode = status;
  response.end(body === undefined ? undefined : JSON.stringify(body));
}

export function sendHealth(request, response) {
  return request.method === "GET" ? json(response, 200, { status: "ok" })
    : json(response, 404, { error: "Route not found" });
}

export function createWorkspaceServer(file = fileURLToPath(defaultWorkspaceFile)) {
  return createServer(createWorkspaceHandler(workspaceStore(file)));
}

export function createWorkspaceHandler(store, reportError = error => console.error("Workspace API error:", error)) {
  return async (request, response) => {
    const path = request.url?.split("?")[0];
    try {
      if (path === "/api/health") return sendHealth(request, response);
      if (path !== "/api/workspace") return json(response, 404, { error: "Route not found" });
      if (request.method === "GET") {
        const saved = await store.read();
        if (saved && !validWorkspace(saved.workspace)) throw new Error("Invalid stored workspace");
        return saved ? json(response, 200, saved.workspace, workspaceVersion(saved.revision))
          : json(response, 404, { error: "Workspace has not been initialized" });
      }
      if (request.method !== "PUT") {
        response.setHeader("Allow", "GET, PUT");
        return json(response, 405, { error: "Method not allowed" });
      }
      const version = request.headers["if-match"];
      const create = request.headers["if-none-match"] === "*";
      if ((!version && !create) || (version && create)) throw new RequestError(428, "Supply one workspace version precondition");
      const workspace = await readJson(request);
      if (!validWorkspace(workspace)) throw new RequestError(422, "Invalid workspace structure");
      const revision = await store.save(workspace, version, create);
      if (revision === undefined) return json(response, 412, { error: "The workspace version has changed" });
      return json(response, create ? 201 : 204, undefined, workspaceVersion(revision));
    } catch (error) {
      if (error instanceof RequestError) return json(response, error.status, { error: error.message });
      reportError(error);
      if (!response.destroyed) json(response, 500, { error: "Workspace storage is unavailable" });
    }
  };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  let database;
  try {
    database = await openDatabase();
    const server = database ? await createDatabaseServer(database) : createWorkspaceServer();
    server.listen(3001, "127.0.0.1", () => {
      console.log(`Workspace API listening on http://127.0.0.1:3001 (${database ? "PostgreSQL" : "local file"})`);
    });
  } catch (error) {
    console.error(`Workspace storage could not start. Check backend/.env and run npm run migrate:workspace (${databaseErrorCode(error)}).`);
    await database?.end();
    process.exitCode = 1;
  }
}

async function createDatabaseServer(database) {
  const store = postgresWorkspaceStore(database);
  const saved = await store.read();
  if (!saved || !validWorkspace(saved.workspace)) {
    throw Object.assign(new Error("Workspace data is missing or invalid"), { code: "WORKSPACE_NOT_READY" });
  }
  const server = createServer(createWorkspaceHandler(store, error => {
    console.error(`Workspace database error (${databaseErrorCode(error)})`);
  }));
  server.once("close", () => void database.end());
  return server;
}

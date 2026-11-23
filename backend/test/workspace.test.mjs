import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rmdir, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createWorkspaceServer } from "../src/server.mjs";

const firstRound = {
  cycle: { name: "Test", status: "open", teams: ["Operations"], reviewers: { Operations: "Manager" },
    employeeDue: "2026-11-25", managerDue: "2026-11-26", resultWeight: 70 },
  people: [{ id: "E101", name: "Employee", initials: "E", title: "Operations Specialist", team: "Operations", cohort: "Specialist",
    due: "2026-11-26", status: "employee", goals: [], activity: [] }],
};

test("workspace API initializes once, resolves competing writes, and reloads saved history", async () => {
  const directory = await mkdtemp(join(tmpdir(), "performance-workspace-"));
  const file = join(directory, "workspace.json");
  let server;
  async function start() {
    server = createWorkspaceServer(file);
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function close() {
    if (!server?.listening) return;
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  const put = (url, data, headers) => fetch(url, {
    method: "PUT", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(data),
  });
  try {
    const origin = await start();
    const url = `${origin}/api/workspace`;
    assert.deepEqual(await (await fetch(`${origin}/api/health`)).json(), { status: "ok" });
    assert.equal((await fetch(url)).status, 404);
    assert.equal((await put(url, firstRound)).status, 428);
    assert.equal((await put(url, { cycle: {} }, { "If-None-Match": "*" })).status, 422);
    const created = await put(url, firstRound, { "If-None-Match": "*" });
    assert.equal(created.status, 201);
    assert.equal((await put(url, firstRound, { "If-None-Match": "*" })).status, 412);
    const read = await fetch(url);
    assert.deepEqual(await read.json(), firstRound);
    const version = read.headers.get("etag");
    assert.equal(version, created.headers.get("etag"));

    const workspace = {
      ...firstRound,
      cycle: { ...firstRound.cycle, name: "Latest" },
      history: [{ ...firstRound, cycle: { ...firstRound.cycle, status: "closed", closedAt: "2026-11-26T00:00:00Z" } }],
    };
    const replies = await Promise.all([
      put(url, workspace, { "If-Match": version }),
      put(url, workspace, { "If-Match": version }),
    ]);
    assert.deepEqual(replies.map(response => response.status).sort(), [204, 412]);
    const savedVersion = replies.find(response => response.status === 204).headers.get("etag");
    assert.notEqual(savedVersion, version);
    await close();
    const restarted = await fetch(`${await start()}/api/workspace`);
    assert.equal(restarted.headers.get("etag"), savedVersion);
    assert.deepEqual(await restarted.json(), workspace);
  } finally {
    await close();
    await unlink(file).catch(error => { if (error.code !== "ENOENT") throw error; });
    await rmdir(directory);
  }
});

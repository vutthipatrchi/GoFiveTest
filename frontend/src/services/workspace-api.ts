import type { Workspace } from "../types";

const endpoint = "/api/workspace";

export class WorkspaceConflict extends Error {}

function responseVersion(response: Response) {
  if (response.status === 412) throw new WorkspaceConflict();
  if (!response.ok) throw new Error(`Workspace API returned ${response.status}`);
  const version = response.headers.get("etag");
  if (!version) throw new Error("Workspace API returned no version");
  return version;
}

async function writeWorkspace(workspace: Workspace, condition: Record<string, string>, signal?: AbortSignal) {
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...condition },
    body: JSON.stringify(workspace),
    signal,
  });
  return responseVersion(response);
}

export async function loadWorkspace(initial: () => Workspace, signal?: AbortSignal) {
  let response = await fetch(endpoint, { signal });
  if (response.status === 404) {
    const workspace = initial();
    try {
      const version = await writeWorkspace(workspace, { "If-None-Match": "*" }, signal);
      return { workspace, version };
    } catch (error) {
      if (!(error instanceof WorkspaceConflict)) throw error;
      response = await fetch(endpoint, { signal });
    }
  }
  const version = responseVersion(response);
  return { workspace: await response.json() as Workspace, version };
}

export function saveWorkspace(workspace: Workspace, version: string) {
  return writeWorkspace(workspace, { "If-Match": version });
}

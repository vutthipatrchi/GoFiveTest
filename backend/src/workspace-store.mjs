import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const defaultWorkspaceFile = new URL("../data/workspace.json", import.meta.url);
export const workspaceVersion = revision => `"${revision}"`;

export function workspaceStore(file) {
  let writes = Promise.resolve();

  async function read() {
    try {
      const saved = JSON.parse(await readFile(file, "utf8"));
      if (!Number.isSafeInteger(saved.revision) || saved.revision < 1 || !saved.workspace) {
        throw new Error("Invalid workspace file");
      }
      return saved;
    } catch (error) {
      if (error.code === "ENOENT") return undefined;
      throw error;
    }
  }

  function save(workspace, version, create) {
    const operation = writes.then(async () => {
      const current = await read();
      const matches = create ? !current : current && version === workspaceVersion(current.revision);
      if (!matches) return undefined;

      const revision = (current?.revision ?? 0) + 1;
      const temporary = `${file}.${randomUUID()}.tmp`;
      await mkdir(dirname(file), { recursive: true });
      try {
        await writeFile(temporary, JSON.stringify({ revision, workspace }), { encoding: "utf8", flag: "wx", flush: true });
        await rename(temporary, file);
      } finally {
        await unlink(temporary).catch(error => {
          if (error.code !== "ENOENT") throw error;
        });
      }
      return revision;
    });
    writes = operation.catch(() => {});
    return operation;
  }

  return { read, save };
}

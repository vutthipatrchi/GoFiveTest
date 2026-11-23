import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const frontend = new URL("../frontend/", import.meta.url);
const backend = new URL("../backend/", import.meta.url);
const require = createRequire(new URL("package.json", frontend));
const vite = join(dirname(require.resolve("vite/package.json")), "bin", "vite.js");
const mode = process.argv[2] === "preview" ? "preview" : "dev";
const options = { stdio: "inherit", windowsHide: true };
const processes = [
  spawn(process.execPath, ["src/server.mjs"], { ...options, cwd: backend }),
  spawn(process.execPath, [vite, mode], { ...options, cwd: frontend }),
];

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of processes) child.kill();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of processes) {
  child.on("error", error => {
    console.error(error);
    stop(1);
  });
  child.on("exit", (code, signal) => stop(code ?? (signal === "SIGINT" ? 0 : 1)));
}

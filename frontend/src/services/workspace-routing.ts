import type { Role, Workspace } from "../types";

export type Page = "overview" | "work" | "tracking" | "backlog" | "appeals" | "setup" | "criteria" | "calibration" | "results" | "feedback";

interface RouteContext {
  role: Role;
  round: number;
  actor?: string;
}

export interface WorkspaceRoute extends RouteContext {
  page: Page;
  person?: string;
}

const pagePaths: Record<Role, Partial<Record<Page, string>>> = {
  hr: {
    overview: "overview", calibration: "calibration", results: "results", appeals: "appeals",
    backlog: "manager-backlog", feedback: "manager-comparison", setup: "setup", criteria: "criteria",
  },
  manager: { overview: "overview", tracking: "team", calibration: "calibration", feedback: "self-review", criteria: "criteria" },
  employee: { overview: "overview", work: "goals", feedback: "manager-feedback", criteria: "criteria" },
};

const personPages: Record<Role, Page[]> = {
  hr: ["overview", "calibration", "results", "appeals", "backlog", "feedback"],
  manager: ["overview", "tracking", "calibration"],
  employee: [],
};

export function workspacePath({ role, round, actor, page, person }: WorkspaceRoute) {
  const parts = [role, "reviews", `round-${round}`];
  if (role !== "hr" && actor) parts.push(actor);
  parts.push(pagePaths[role][page] ?? "overview");
  if (person && personPages[role].includes(page)) parts.push("employees", person);
  return "/" + parts.map(encodeURIComponent).join("/");
}

export function parseWorkspacePath(path: string): WorkspaceRoute | undefined {
  try {
    const parts = path.replace(/^\//, "").replace(/\/$/, "").split("/").map(decodeURIComponent);
    const [role, section, roundSegment] = parts;
    if (role !== "hr" && role !== "manager" && role !== "employee") return;
    if (section !== "reviews" || !/^round-[1-9]\d*$/.test(roundSegment)) return;
    const round = Number(roundSegment.slice(6));
    if (!Number.isSafeInteger(round)) return;
    const remaining = parts.slice(3);
    const actor = role === "hr" ? undefined : remaining.shift();
    if (role !== "hr" && !actor) return;
    const [slug, collection, person] = remaining;
    const page = (Object.keys(pagePaths[role]) as Page[]).find(page => pagePaths[role][page] === slug);
    if (!page) return;
    if (remaining.length !== 1 && (remaining.length !== 3 || collection !== "employees" ||
      !person || !personPages[role].includes(page))) return;
    return { role, round, actor, page, person };
  } catch {
    return;
  }
}

export function reviewRoundAt(workspace: Workspace, number: number) {
  const history = workspace.history ?? [];
  const latest = history.length + 1;
  if (number === latest) return { data: workspace, archiveIndex: undefined };
  // The workspace prepends old rounds. Numbering from the oldest keeps existing links stable.
  const archiveIndex = latest - number - 1;
  const data = history[archiveIndex];
  return data && { data, archiveIndex };
}

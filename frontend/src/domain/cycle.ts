import type { Cycle, Person, Workspace } from "../types";
import { kpiTemplates } from "./goal-plan";

export const newRoundName = "รอบประเมินใหม่";

export function cycleClosure(cycle: Cycle, people: Person[]) {
  const participants = people.filter(person => cycle.teams.includes(person.team));
  const total = participants.length;
  const published = participants.filter(person => person.status === "published").length;
  const openAppeals = participants.filter(person => person.appeal && !person.appeal.response?.trim()).length;
  return { total, published, unpublished: total - published, openAppeals };
}

export function closeReviewCycle(cycle: Cycle, closedAt: string): Cycle | undefined {
  if (cycle.status !== "open") return;
  return { ...cycle, status: "closed", closedAt };
}

export function createReviewRound({ cycle, people, history = [] }: Workspace): Workspace | undefined {
  if (cycle.status !== "closed") return;

  return {
    cycle: {
      name: newRoundName,
      status: "draft",
      teams: [...new Set(people.map(person => person.team))],
      reviewers: { ...cycle.reviewers },
      secondaryReviewers: { ...cycle.secondaryReviewers },
      employeeDue: "",
      managerDue: "",
      resultWeight: cycle.resultWeight,
      kpiTemplates: structuredClone(kpiTemplates({ ...cycle, status: "draft" })),
      teamTemplates: { ...cycle.teamTemplates },
    },
    people: people.map(({ id, name, initials, title, team, managerId, cohort }) => ({
      id, name, initials, title, team, managerId, cohort,
      status: "employee", due: "", goals: [], activity: [],
    })),
    history: [{ cycle, people }, ...history],
  };
}

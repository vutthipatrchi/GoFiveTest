import type { Person, Status } from "../types";

export const milestones: ReadonlyArray<{ filter: string; label: string; states: readonly Status[]; tone: string }> = [
  { filter: "stage-employee", label: "รอพนักงานส่ง", states: ["employee"], tone: "waiting" },
  { filter: "stage-manager", label: "อยู่กับหัวหน้า", states: ["approval", "manager", "returned"], tone: "reviewing" },
  { filter: "stage-hr", label: "อยู่กับ HR", states: ["hr", "decided"], tone: "calibrating" },
  { filter: "stage-published", label: "เผยแพร่แล้ว", states: ["published"], tone: "published" },
];

export function milestoneCounts(people: Person[]) {
  return milestones.map(milestone => ({
    ...milestone,
    count: people.filter(person => milestone.states.includes(person.status)).length,
  }));
}

import { key } from "../config";
import { seed } from "../data/seed";
import { defaultKpiTemplates } from "../domain/goal-plan";
import { mockPrimaryReviewers, mockSecondaryReviewers } from "../domain/managers";
import type { Cycle, Person, Workspace } from "../types";

export function initialCycle(): Cycle {
  return {
    name: "รอบประเมินประจำปี 2026",
    status: "draft",
    teams: [...new Set(seed.map(person => person.team))],
    reviewers: { ...mockPrimaryReviewers },
    secondaryReviewers: { ...mockSecondaryReviewers },
    employeeDue: "2026-11-24",
    managerDue: "2026-11-25",
    resultWeight: 70,
    kpiTemplates: structuredClone(defaultKpiTemplates),
    teamTemplates: {},
  };
}

export function readData(): Workspace {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      const value = JSON.parse(saved) as Workspace | Person[] | null;
      if (Array.isArray(value)) {
        const people = structuredClone(seed).map(person => {
          const previous = value.find(entry => entry.id === person.id);
          return previous ? {
            ...person, ...previous,
            goals: previous.goals.map((goal, index) => ({ ...person.goals[index], ...goal, period: goal.period ?? "" }))
          } : person;
        });
        return { people, cycle: { ...initialCycle(), status: "open" } };
      }
      if (Array.isArray(value?.people) && value.cycle) {
        if (value.history || value.cycle.status === "closed") return value;
        const known = new Set(value.people.map(person => person.id));
        const managerSamples = seed.filter(person => person.managerId && !known.has(person.id));
        return { ...value, people: [...value.people, ...structuredClone(managerSamples)] };
      }
    }
  } catch {}
  return { people: structuredClone(seed), cycle: initialCycle() };
}

export function saveData(data: Workspace) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

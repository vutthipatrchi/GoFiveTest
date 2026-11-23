import { kpiResultFor, workSourceFor } from "../services/work-source";
import type { Goal, Person, WorkSource, Workspace } from "../types";
import { goalLevel } from "./kpi";
import { bangkokDay } from "./submission";
import { deliveryGoal, sourceDeliveryRate } from "./work";

const systemEvidence = "จากระบบงานจำลอง";

/** True for the KPI measured from work records. Other KPIs still get their result from the source system. */
export function usesWorkRecords(goal: Goal) {
  if (goal.source) return goal.source === "work-delivery";
  return !!goal.workSource || deliveryGoal(goal);
}

/** Older rounds may hold results people typed in, so only results from the system carry the system label. */
export const isSystemResult = (goal: Goal) => usesWorkRecords(goal) || goal.evidence === systemEvidence;

function recordResult(goal: Goal, source: WorkSource, actual: number, linked?: WorkSource): Goal {
  const through = bangkokDay(new Date(source.asOf));
  const period = `${source.from} – ${through}`;
  const baseline = goal.updates ?? (goal.unmeasured ? [] : [{
    actual: goal.actual, period: goal.period ?? "", evidence: goal.evidence ?? "",
  }]);
  return {
    ...goal, actual, period, evidence: systemEvidence, unmeasured: false, ...(linked && { workSource: linked }),
    updates: [{ actual, period, evidence: systemEvidence, recordedOn: through }, ...baseline],
  };
}

function syncGoal(person: Person, goal: Goal, force = false): Goal {
  const source = workSourceFor(person.id);
  if (!source) return goal;
  if (deliveryGoal(goal)) {
    if (!force && goal.workSource?.asOf === source.asOf) return goal;
    const rate = sourceDeliveryRate(source);
    return rate === null ? goal : recordResult(goal, source, rate, source);
  }
  if (goalLevel(goal) !== null) return goal;
  const actual = kpiResultFor(person.id, goal);
  return actual === undefined ? goal : recordResult(goal, source, actual);
}

/** Results freeze once the employee submits, so only people still at the employee step are refreshed. */
export function syncPersonWork(person: Person): Person {
  if (person.status !== "employee" || !person.goals.length) return person;
  const goals = person.goals.map(goal => syncGoal(person, goal));
  return goals.some((goal, index) => goal !== person.goals[index]) ? { ...person, goals } : person;
}

/** Lets HR fetch only the KPI results still missing, at any step and without sending the person back. */
export function refreshMissingResults(person: Person): Person {
  const goals = person.goals.map(goal => goalLevel(goal) === null ? syncGoal(person, goal, true) : goal);
  return goals.some((goal, index) => goal !== person.goals[index]) ? { ...person, goals } : person;
}

export function syncWorkspaceWork(workspace: Workspace): Workspace {
  if (workspace.cycle.status === "closed") return workspace;
  const people = workspace.people.map(syncPersonWork);
  return people.some((person, index) => person !== workspace.people[index]) ? { ...workspace, people } : workspace;
}

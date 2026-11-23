import type { Cycle, Person, Workspace } from "../types";
import { activateGoals } from "./goal-plan";
import { syncPersonWork } from "./work-sync";

/** KPI plans come from HR, so a plan takes effect as soon as it is sent. */
export function applyPlan(person: Person, on: string) {
  const assignment = person.goalAssignment;
  if (!assignment) return;
  if (person.goals.length) (person.previousGoalPlans ??= []).unshift({
    replacedOn: on, goals: person.goals, ...(person.acceptedGoalTemplate && { template: person.acceptedGoalTemplate }),
  });
  person.goals = syncPersonWork({ ...person, goals: activateGoals(person.goals, assignment.goals) }).goals;
  person.planIssuedOn ??= person.goalsAcceptedOn ?? on;
  person.goalsAcceptedOn = on;
  if (assignment.template) person.acceptedGoalTemplate = assignment.template;
  else delete person.acceptedGoalTemplate;
  delete person.goalAssignment;
}

export function activateAssignedPeople(people: Person[]) {
  let changed = false;
  const updated = people.map(person => {
    if (person.status !== "employee" || !person.goalAssignment) return person;
    const next = structuredClone(person);
    applyPlan(next, person.goalAssignment.assignedOn);
    changed = true;
    return next;
  });
  return changed ? updated : people;
}

/** Plans saved while employees still had to accept them start now. Closed rounds stay as recorded. */
export function activateAssignedPlans(workspace: Workspace): Workspace {
  if (workspace.cycle.status === "closed") return workspace;
  const people = activateAssignedPeople(workspace.people);
  return people === workspace.people ? workspace : { ...workspace, people };
}

export const planEditDays = 7;

/** Last day HR may change an issued plan. Edits do not restart the window, and draft rounds have none yet. */
export function planEditDue(person: Pick<Person, "planIssuedOn" | "goalsAcceptedOn">, cycle: Pick<Cycle, "status">) {
  const issuedOn = person.planIssuedOn ?? person.goalsAcceptedOn;
  if (cycle.status === "draft" || !issuedOn) return undefined;
  const day = new Date(`${issuedOn}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + planEditDays);
  return day.toISOString().slice(0, 10);
}

export function canEditPlan(person: Pick<Person, "planIssuedOn" | "goalsAcceptedOn">, cycle: Pick<Cycle, "status">, today: string) {
  const due = planEditDue(person, cycle);
  return !due || today <= due;
}

export const hasOpenPlanQuestion =(person: Person) => !!person.planQuestion && !person.planQuestion.response;

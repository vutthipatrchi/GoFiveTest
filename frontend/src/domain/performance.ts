import type { CalibrationRecord, Cycle, Goal, Person, Team } from "../types";
import { category, goalLevel } from "./kpi";
import { hasCurrentSecondReview } from "./manager-feedback";

export function currentCalibration(person: Person) {
  return person.calibrationHistory?.find(entry => entry.id === person.decision?.calibrationId);
}

export const performanceBands = [
  { id: "high", label: category(4), tone: "green" },
  { id: "expected", label: category(3), tone: "blue" },
  { id: "low", label: category(2), tone: "amber" },
  { id: "incomplete", label: "ยังประเมินไม่ได้", tone: "amber" },
  { id: "pending", label: "รอ HR ยืนยันผล", tone: "" },
] as const;

type PerformanceBand = (typeof performanceBands)[number]["id"];

export interface PerformanceFilters {
  team: Team | "";
  title: string;
  cohort: string;
  band: PerformanceBand | "";
}

export const emptyPerformanceFilters: PerformanceFilters = { team: "", title: "", cohort: "", band: "" };

export function confirmedLevel(person: Person, cycle: Cycle) {
  const level = person.decision?.level;
  if (!level || ![1, 2, 3, 4, 5].includes(level)) return;
  if (person.status === "published" || (person.status === "decided" && hasCurrentSecondReview(person, cycle))) return level;
}

/** Difference from level 3 in the weighted KPI result, before applying the results/behaviors split. */
export function kpiImpact(goal: Goal, level: number) {
  return (level - 3) * goal.weight / 100;
}

export function performanceResult(person: Person, cycle: Cycle) {
  const level = confirmedLevel(person, cycle);
  const record = level ? currentCalibration(person) : undefined;
  const kpis = record?.kpis ?? person.goals.map(goal => ({ goal, level: goalLevel(goal), cited: false }));
  const complete = kpis.filter(kpi => kpi.level !== null).length;
  const band: PerformanceBand = level
    ? (level >= 4 ? "high" : level <= 2 ? "low" : "expected")
    : (!kpis.length || complete < kpis.length || person.status === "published" ? "incomplete" : "pending");
  const impacts = kpis.flatMap(({ goal, level }) => level === null ? [] : [{ goal, level, impact: kpiImpact(goal, level) }]);
  const driver = impacts.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact) || b.goal.weight - a.goal.weight)[0];
  return { person, level, band, complete, total: kpis.length, driver, record };
}

export function snapshotCalibration(person: Person, inputs: Pick<CalibrationRecord, "id" | "at" | "reviewer" |
  "proposed" | "finalLevel" | "reason" | "resultWeight" | "workScore" | "manager">, citations: Set<string>): CalibrationRecord {
  return {
    ...inputs,
    cohort: person.cohort,
    previousLevel: person.decision?.level,
    template: person.acceptedGoalTemplate && structuredClone(person.acceptedGoalTemplate),
    secondReview: person.secondReview && { ...person.secondReview, cited: citations.has("second-review") },
    kpis: person.goals.map((goal, index) => {
      const { updates: _updates, ...measurement } = goal;
      return { goal: structuredClone(measurement), level: goalLevel(goal), cited: citations.has(`kpi-${index}`) };
    }),
  };
}

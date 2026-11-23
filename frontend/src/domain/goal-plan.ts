import { t } from "../i18n";
import type { Cycle, Goal, GoalDefinition, KpiTemplate, Person, Team } from "../types";
import { deliveryGoal } from "./work";

export const goalCutoffs = (goal: GoalDefinition) =>
  goal.cutoffs ?? [goal.target * .75, goal.target, goal.target * 1.1, goal.target * 1.25];

export const operationsSpecialistTemplate: KpiTemplate = {
  id: "operations",
  title: "Operations Specialist",
  version: 1,
  goals: [
    {
      name: "ส่งมอบงานตามกำหนด", weight: 60, unit: "%", target: 95, cutoffs: [80, 95, 98, 100],
      responsibility: "ส่งมอบงานปฏิบัติการตามกำหนดที่ตกลงกับทีมผู้รับงาน วัดจากระบบติดตามงาน",
      source: "work-delivery",
    },
    {
      name: "ปรับปรุงกระบวนการทำงาน", weight: 40, unit: "รายการ", target: 4, cutoffs: [2, 4, 5, 6],
      responsibility: "เสนอและนำการปรับปรุงขั้นตอนงานไปใช้จริง โดยมีตัวเลขก่อน-หลังยืนยัน",
      source: "manual",
    },
  ],
};

const onTimeDelivery: GoalDefinition = {
  name: "ส่งมอบงานตามกำหนด", weight: 60, unit: "%", target: 95, cutoffs: [80, 95, 98, 100],
  responsibility: "ส่งมอบงานตามกำหนดที่ตกลงกับผู้รับงาน วัดจากระบบติดตามงาน",
  source: "work-delivery",
};

export const defaultKpiTemplates: KpiTemplate[] = [
  operationsSpecialistTemplate,
  {
    id: "people", title: "People", version: 1,
    goals: [onTimeDelivery, {
      name: "ปิดคำขอของพนักงานตามเวลา", weight: 40, unit: "%", target: 90, cutoffs: [75, 90, 95, 100],
      responsibility: "ปิดคำขอด้านบุคคลภายในเวลาที่กำหนด โดยมีรายงานคำขอยืนยัน",
      source: "manual",
    }],
  },
  {
    id: "finance", title: "Finance", version: 1,
    goals: [onTimeDelivery, {
      name: "ความถูกต้องของรายงานการเงิน", weight: 40, unit: "%", target: 98, cutoffs: [95, 98, 99, 100],
      responsibility: "จัดทำรายงานการเงินให้ถูกต้อง โดยมีผลตรวจทานยืนยัน",
      source: "manual",
    }],
  },
];

/** The round's template library. Closed rounds saved before the library keep only the template they used. */
export function kpiTemplates(cycle: Cycle): KpiTemplate[] {
  if (cycle.kpiTemplates) return cycle.kpiTemplates;
  const legacy = cycle.roleKpiTemplate;
  const saved = legacy && { id: operationsSpecialistTemplate.id, title: legacy.title, version: legacy.version, goals: legacy.goals };
  if (cycle.status === "closed") return saved ? [saved] : [];
  return defaultKpiTemplates.map(template => saved && template.id === saved.id ? saved : template);
}

export function templateForTeam(cycle: Cycle, team: Team) {
  const id = cycle.teamTemplates?.[team];
  return id ? kpiTemplates(cycle).find(template => template.id === id) : undefined;
}

const round = (value: number) => Math.round(value * 10) / 10;

/** Suggested level 2/3/4/5 thresholds for a target, mirrored for lower-is-better KPIs. */
export function suggestedCutoffs(target: number, direction?: "lower", unit?: string) {
  if (direction === "lower") return [target * 1.5, target, target * 2 / 3, target / 3].map(round);
  const suggested = [target * .75, target, target * 1.1, target * 1.25];
  // Percentages cannot pass 100: spread levels 4 and 5 over the room left above the target instead.
  if (unit === "%" && suggested[3] > 100 && target < 100) {
    suggested[2] = target + (100 - target) / 2;
    suggested[3] = 100;
  }
  return suggested.map(round);
}

/** Problems with a single KPI definition, or undefined when it is valid. */
export function goalProblem(goal: GoalDefinition) {
  if (!goal.name || !goal.unit || !goal.responsibility) return t("ระบุชื่อ KPI หน่วย และหน้าที่ที่เกี่ยวข้องให้ครบ");
  if (goal.source === "work-delivery" && !deliveryGoal(goal)) return t("KPI อัตราส่งทันใช้หน่วย % และทิศทางยิ่งสูงยิ่งดี");
  if (!Number.isInteger(goal.weight) || goal.weight < 1) return t("น้ำหนักต้องเป็นจำนวนเต็มตั้งแต่ 1%");
  const bounds = goalCutoffs(goal);
  if (bounds.length !== 4 || bounds[1] !== goal.target ||
    !bounds.every(value => Number.isFinite(value) && value >= 0 && (goal.unit !== "%" || value <= 100))) {
    return t("เกณฑ์ต้องเป็นตัวเลขตั้งแต่ 0{0}", goal.unit === "%" ? t(" ถึง 100") : "");
  }
  const ordered = bounds.slice(1).every((value, index) =>
    goal.direction === "lower" ? value < bounds[index] : value > bounds[index]);
  if (!ordered) return goal.direction === "lower"
    ? t("ยิ่งต่ำยิ่งดี: เกณฑ์ต้องลดลงจากระดับ 2 ไประดับ 5")
    : t("ยิ่งสูงยิ่งดี: เกณฑ์ต้องเพิ่มขึ้นจากระดับ 2 ไประดับ 5");
}

function definitionsProblem(goals: GoalDefinition[]) {
  if (new Set(goals.map(goal => goal.name.toLocaleLowerCase())).size !== goals.length) return t("ชื่อ KPI ต้องไม่ซ้ำกัน");
  if (goals.filter(deliveryGoal).length > 1) return t("เลือก KPI ที่ใช้อัตราส่งทันจากระบบงานได้หนึ่งรายการต่อแผน");
  for (const goal of goals) {
    const problem = goalProblem(goal);
    if (problem) return goal.name ? `«${goal.name}» · ${problem}` : problem;
  }
}

const totalWeight = (goals: GoalDefinition[]) => goals.reduce((sum, goal) => sum + goal.weight, 0);

/** A complete plan for one person: valid KPIs whose weights add up to exactly 100%. */
export function validateGoalPlan(goals: GoalDefinition[]) {
  if (!goals.length) return t("เพิ่ม KPI อย่างน้อย 1 รายการ");
  const problem = definitionsProblem(goals);
  if (problem) return problem;
  if (totalWeight(goals) !== 100) return t("น้ำหนัก KPI ต้องรวมกันได้ 100%");
}

export const toDefinition = ({ name, unit, weight, target, direction, cutoffs, responsibility, scope, source }: GoalDefinition): GoalDefinition =>
  ({ name, unit, weight, target, direction, cutoffs, responsibility, ...(source && { source }), ...(scope && { scope }) });

function sameMeasurement(first: GoalDefinition, second: GoalDefinition) {
  return first.name === second.name && first.unit === second.unit && first.direction === second.direction &&
    first.responsibility === second.responsibility && first.target === second.target &&
    deliveryGoal(first) === deliveryGoal(second) &&
    goalCutoffs(first).every((value, index) => value === goalCutoffs(second)[index]);
}

export function matchesTemplateGoals(goals: GoalDefinition[], template: KpiTemplate) {
  return goals.length === template.goals.length && template.goals.every(expected =>
    goals.some(goal => goal.weight === expected.weight && sameMeasurement(goal, expected)));
}

/** The plan a member is working towards: the one waiting for acceptance, else the active one. */
export const currentPlan = (person: Person): GoalDefinition[] => person.goalAssignment?.goals ?? person.goals;

export const needsGoalAssignment = (person: Person) =>
  person.status === "employee" && !person.goals.length && !person.goalAssignment;

export function assignTeamPlans(cycle: Cycle, people: Person[], assignedOn: string, at: string) {
  if (cycle.status !== "open") return { people, sent: 0 };
  let sent = 0;
  const updated = people.map(person => {
    const template = templateForTeam(cycle, person.team);
    if (!template || validateGoalPlan(template.goals) || !cycle.teams.includes(person.team) || !needsGoalAssignment(person)) return person;
    sent++;
    return {
      ...person,
      goalAssignment: {
        goals: structuredClone(template.goals), assignedOn, assignedBy: "HR",
        template: { title: template.title, version: template.version },
      },
      activity: [{ role: "hr" as const, message: t("ระบบส่งแผน KPI จากแม่แบบของทีม"), at }, ...person.activity],
    };
  });
  return { people: updated, sent };
}

export function activateGoals(previous: Goal[], definitions: GoalDefinition[]): Goal[] {
  return definitions.map(definition => {
    const matching = previous.find(goal => sameMeasurement(goal, definition));
    if (!matching) return { ...definition, actual: 0, unmeasured: true };
    const { scope: _previousScope, source: _previousSource, ...measured } = matching;
    return { ...measured, ...definition };
  });
}

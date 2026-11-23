import { t } from "../i18n";
import { states } from "../config";
import type { Cycle, ManagerId, Person, Role, Team } from "../types";
import { awaitingClarification, isPendingAppeal } from "./appeals";
import { needsGoalAssignment } from "./goal-plan";
import { hasOpenPlanQuestion } from "./plan-activation";
import { category, goalLevel, missingFields, proposal, score } from "./kpi";
import { awaitingSecondReview, hasCurrentSecondReview } from "./manager-feedback";
import { directReports, managerForPerson, managersForTeam, personManagerId, type Manager } from "./managers";
import { managerTasks, type ManagerTask } from "./reminders";
import { milestones } from "./review-stages";
import { bangkokDay, employeeOverdue } from "./submission";

export interface HrFilters {
  view: "teams" | "managers" | "people";
  query: string;
  team: Team | "";
  managerId: ManagerId | "";
  state: string;
  result: string;
}

export const emptyFilters: HrFilters = { view: "teams", query: "", team: "", managerId: "", state: "", result: "" };
export const ownerLabels: Record<Role, string> = { employee: "Employee", manager: "Manager", hr: "HR" };

export function reviewNextStep(person: Person, cycle: Cycle): { owner?: Role; task: string; due?: string } {
  if (awaitingClarification(person)) return { owner: "manager", task: t("ชี้แจงต่อ HR") };
  if (isPendingAppeal(person)) return { owner: "hr", task: t("พิจารณาคำขอตรวจสอบ") };
  if (cycle.status === "closed") {
    if (person.status === "published" && !person.acknowledged) return { owner: "employee", task: t("รับทราบผลประเมิน") };
    return { task: t("ปิดรอบแล้ว") };
  }
  const incomplete = person.goals.filter(goal => goalLevel(goal) === null);
  switch (person.status) {
    case "employee": {
      if (needsGoalAssignment(person)) return { owner: "hr", task: t("มอบหมายแผน KPI") };
      const due = cycle.employeeDue;
      if (incomplete.length) {
        const missing = [...new Set(incomplete.flatMap(missingFields))].join(" · ");
        return { owner: "employee", task: t("ตรวจข้อมูล KPI ที่ยังไม่ครบ {0} รายการ ({1})", incomplete.length, missing), due };
      }
      return { owner: "employee", task: t("ส่งสรุปผลงานให้ Manager"), due };
    }
    case "approval":
      return { owner: "manager", task: t("ตรวจสรุปผลงานปลายรอบ"), due: person.submission?.approvalDue };
    case "manager":
      return { owner: "manager", task: t("ให้คะแนนและส่ง HR"), due: person.due };
    case "returned":
      return { owner: "manager", task: t("ทบทวนคะแนนตามที่ HR ส่งกลับ"), due: person.due };
    case "hr":
    case "decided":
      if (!person.goals.length || incomplete.length) return { owner: "hr", task: t("ตรวจข้อมูล KPI จากระบบงาน") };
      if (!proposal(person, cycle.resultWeight)) return { owner: "hr", task: t("ตรวจคะแนนที่ Manager ส่ง") };
      if (awaitingSecondReview(person, cycle)) return { owner: "hr", task: t("บันทึกความเห็นผู้ทบทวนคนที่สอง") };
      if (person.status === "decided" && person.decision?.level && hasCurrentSecondReview(person, cycle)) {
        return { owner: "hr", task: t("พร้อมเผยแพร่ผล") };
      }
      return { owner: "hr", task: person.status === "decided" ? t("ยืนยันระดับสุดท้ายอีกครั้ง") : t("ทบทวนและยืนยันระดับสุดท้าย") };
    case "published":
      if (!person.acknowledged) return { owner: "employee", task: t("รับทราบผลประเมิน") };
      return { task: t("เสร็จสิ้น") };
  }
}

export function summarizeTeams(people: Person[], cycle: Cycle, today = bangkokDay()) {
  return cycle.teams.map(team => {
    const members = people.filter(person => person.team === team);
    const managers = managersForTeam(cycle, team).map(manager => summarizeManager(manager, members, cycle, today));
    return {
      team, managers, members, tasks: managers.flatMap(manager => manager.tasks),
      published: members.filter(person => person.status === "published").length,
      hrPending: members.filter(person => person.status === "hr").length,
      late: managers.reduce((total, manager) => total + manager.late, 0),
    };
  });
}

function summarizeManager(manager: Manager, people: Person[], cycle: Cycle, today: string) {
  const members = directReports(people, manager.id);
  const tasks = managerTasks(members, cycle, today);
  return {
    ...manager, members, tasks, late: tasks.filter(task => task.level === "late").length,
    nextDue: tasks.find(task => task.level !== "late" && task.due)?.due,
  };
}

export type ManagerSummary = ReturnType<typeof summarizeManager>;

/** Readiness filters HR reaches from the overview; each matches one planReadiness group. */
export const planFilters = {
  "plan-none": needsGoalAssignment,
  "kpi-incomplete": (person: Person) => planReadiness([person]).incomplete.length > 0,
  "not-submitted": (person: Person) => person.status === "employee",
} as const;

export function filterPeople(people: Person[], filters: HrFilters, cycle: Cycle, tasks: ManagerTask[], today = bangkokDay()) {
  const query = filters.query.trim().toLowerCase();
  const overdueIds = new Set(tasks.filter(task => task.level === "late").map(task => task.person.id));
  const stage = milestones.find(milestone => milestone.filter === filters.state);
  return people.filter(person => {
    if (filters.team && person.team !== filters.team) return false;
    if (filters.managerId && personManagerId(person) !== filters.managerId) return false;
    if (filters.state === "overdue") {
      if (!overdueIds.has(person.id)) return false;
    } else if (filters.state === "employee-overdue") {
      if ((cycle.status === "open" && person.status !== "employee") || !employeeOverdue(person, cycle.employeeDue, today)) return false;
    } else if (filters.state === "unacknowledged") {
      if (person.status !== "published" || person.acknowledged) return false;
    } else if (filters.state in planFilters) {
      if (!planFilters[filters.state as keyof typeof planFilters](person)) return false;
    } else if (stage ? !stage.states.includes(person.status) : filters.state && person.status !== filters.state) {
      return false;
    }
    return (!filters.result || (person.status === "published" && category(person.decision?.level) === filters.result)) &&
      `${person.name} ${person.id}`.toLowerCase().includes(query);
  });
}

export function reviewCsv(people: Person[], cycle: Cycle, exportedAt = new Date()) {
  const headings = [t("รอบประเมิน"), t("เวลาส่งออก (UTC)"), t("รหัส"), t("พนักงาน"), t("ทีม"), "Manager",
    t("สถานะแผน KPI"), t("KPI ครบ"), t("KPI ทั้งหมด"), t("ผลลัพธ์งาน"), t("สถานะ"), t("ใครต้องทำต่อ"), t("สิ่งที่ต้องทำถัดไป"), t("กำหนดงานถัดไป"),
    t("พฤติกรรม"), t("ระดับเสนอ"), t("ระดับสุดท้าย"), t("ผลที่เผยแพร่")];
  const records = people.map(person => {
    const next = reviewNextStep(person, cycle);
    const planStatus = needsGoalAssignment(person)
      ? t("ยังไม่มีแผน KPI") : person.goalsAcceptedOn ? t("มีแผนแล้ว") : t("ใช้เป้าหมายเดิม");
    return [
      t(cycle.name), exportedAt.toISOString(), person.id, person.name, person.team, managerForPerson(cycle, person).name,
      planStatus, person.goals.filter(goal => goalLevel(goal) !== null).length, person.goals.length,
      score(person)?.toFixed(2), t(states[person.status][0]), next.owner && ownerLabels[next.owner], next.task, next.due,
      person.review?.rating, proposal(person, cycle.resultWeight)?.level, person.decision?.level,
      person.status === "published" && person.decision?.level ? t(category(person.decision.level)) : "",
    ];
  });
  return [headings, ...records].map(row => row.map(value => {
    let cell = String(value ?? "");
    if (/^[=+@\t\r-]/.test(cell)) cell = "'" + cell;
    return '"' + cell.replaceAll('"', '""') + '"';
  }).join(",")).join("\r\n");
}

export type HrTaskKind = "appeal" | "plan" | "second" | "kpi" | "decide" | "publish";
export const hrTaskOrder: HrTaskKind[] = ["appeal", "plan", "second", "kpi", "decide", "publish"];

/** Which kind of HR work a person is waiting on, if any. Mirrors the HR branches of reviewNextStep. */
export function hrTaskKind(person: Person, cycle: Cycle): HrTaskKind | undefined {
  if (isPendingAppeal(person)) return "appeal";
  if (cycle.status !== "open") return;
  if (hasOpenPlanQuestion(person)) return "plan";
  if (person.status !== "hr" && person.status !== "decided") return;
  if (!person.goals.length || person.goals.some(goal => goalLevel(goal) === null)) return "kpi";
  if (!proposal(person, cycle.resultWeight)) return "decide";
  if (awaitingSecondReview(person, cycle)) return "second";
  if (person.status === "decided" && person.decision?.level && hasCurrentSecondReview(person, cycle)) return "publish";
  return "decide";
}

/** HR's own queue, grouped by kind in the order HR should work through it. */
export function hrTasks(people: Person[], cycle: Cycle) {
  const groups = new Map<HrTaskKind, Person[]>();
  for (const person of people) {
    const kind = hrTaskKind(person, cycle);
    if (kind) groups.set(kind, [...(groups.get(kind) ?? []), person]);
  }
  return hrTaskOrder.filter(kind => groups.has(kind)).map(kind => ({ kind, people: groups.get(kind)! }));
}

export type CyclePhase = "setup" | "plan" | "review" | "decide" | "after" | "closed";

/** Where the round stands: by deadline while open, "after" once every result is published. */
export function cyclePhase(people: Person[], cycle: Cycle, today = bangkokDay()): CyclePhase {
  if (cycle.status === "draft") return "setup";
  if (cycle.status === "closed") return "closed";
  if (people.length && people.every(person => person.status === "published")) return "after";
  if (!cycle.employeeDue || today <= cycle.employeeDue) return "plan";
  if (!cycle.managerDue || today <= cycle.managerDue) return "review";
  return "decide";
}

/** Plan and submission readiness for the early part of an open round. */
export function planReadiness(people: Person[]) {
  const atEmployee = people.filter(person => person.status === "employee");
  return {
    none: atEmployee.filter(needsGoalAssignment),
    incomplete: atEmployee.filter(person => person.goals.length > 0
      && person.goals.some(goal => goalLevel(goal) === null)),
    submitted: people.filter(person => person.status !== "employee"),
  };
}

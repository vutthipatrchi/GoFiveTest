import { t } from "../i18n";
import type { Cycle, ManagerId, Person } from "../types";
import { awaitingClarification } from "./appeals";
import { directReports } from "./managers";
import { overdue } from "./kpi";
import { approvalOverdue, bangkokDay } from "./submission";
/** Start reminding this many days before a deadline. */
export const remindAheadDays = 3;

export type AlertLevel = "upcoming" | "soon" | "late";

export interface ManagerTask {
  person: Person;
  kind: string;
  detail: string;
  due?: string;
  late: boolean;
  /** Days until due; negative once overdue. */
  daysLeft?: number;
  level?: AlertLevel;
  action: string;
}

const daysFrom = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

export function alertLevel(daysLeft: number | undefined, late: boolean): AlertLevel | undefined {
  if (late || (daysLeft !== undefined && daysLeft < 0)) return "late";
  if (daysLeft === undefined) return undefined;
  if (daysLeft <= 1) return "soon";
  if (daysLeft <= remindAheadDays) return "upcoming";
  return undefined;
}

/** Everything waiting on the managers of these people, most urgent first. */
export function managerTasks(people: Person[], cycle: Cycle, today = bangkokDay()): ManagerTask[] {
  const isOpen = cycle.status === "open";
  const tasks: Omit<ManagerTask, "daysLeft" | "level">[] = [];
  for (const person of people) {
    if (awaitingClarification(person)) tasks.push({ person, kind: "ชี้แจงต่อ HR", detail: t("HR ขอข้อมูลเพิ่มเพื่อตรวจสอบผล"),
      late: false, action: t("เปิดคำถาม") });
    if (isOpen && person.status === "approval") tasks.push({ person, kind: "อนุมัติสรุปผลงาน", detail: t("พนักงานส่งสรุปผลงานปลายรอบแล้ว"),
      due: person.submission?.approvalDue, late: approvalOverdue(person, today), action: t("ตรวจสรุปผลงานปลายรอบ") });
    if (isOpen && person.status === "manager") tasks.push({ person, kind: "ประเมินผลงาน", detail: person.reviewDraft ? t("มีคะแนนที่บันทึกไว้แล้ว ตรวจและส่ง HR") : t("ให้คะแนนพฤติกรรมและส่ง HR"),
      due: person.due, late: overdue(person), action: t("เปิดแบบประเมิน") });
    if (isOpen && person.status === "returned") tasks.push({ person, kind: "ทบทวนตาม HR", detail: person.returnReason || t("HR ส่งกลับให้ทบทวน"),
      due: person.due, late: overdue(person), action: t("เปิดแบบประเมิน") });
  }
  return tasks.map(task => {
    const daysLeft = task.due ? daysFrom(today, task.due) : undefined;
    return { ...task, daysLeft, level: alertLevel(daysLeft, task.late) };
  }).sort((a, b) => Number(b.late) - Number(a.late) || (a.due ?? "9999").localeCompare(b.due ?? "9999"));
}

export function dueText(task: Pick<ManagerTask, "daysLeft" | "late">) {
  const days = task.daysLeft;
  if (days === undefined) return task.late ? t("เลยกำหนด") : "";
  if (days < 0) return t("เลยกำหนด {0} วัน", -days);
  if (days === 0) return task.late ? t("เลยกำหนด") : t("ครบกำหนดวันนี้");
  return t("เหลือ {0} วัน", days);
}

/** Most recent reminder HR recorded for a team's manager, including per-person reminders. */
export function lastReminder(cycle: Cycle, managerId: ManagerId, people: Person[]) {
  const stamps = [
    ...(cycle.managerReminders?.[managerId] ?? []),
    ...directReports(people, managerId).map(person => person.remindedAt ?? ""),
  ].filter(Boolean).sort();
  return stamps.at(-1);
}

export function reminderHistory(cycle: Cycle, managerId: ManagerId, people: Person[]) {
  const teamWide = (cycle.managerReminders?.[managerId] ?? []).map(at => ({ at, text: t("HR เตือนให้จัดการงานค้างทั้งหมด") }));
  const personal = directReports(people, managerId).filter(person => person.remindedAt)
    .map(person => ({ at: person.remindedAt!, text: t("HR เตือนเรื่องงานของ {0}", person.name), personId: person.id }));
  return [...teamWide, ...personal].sort((a, b) => b.at.localeCompare(a.at));
}

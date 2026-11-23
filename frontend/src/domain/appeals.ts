import type { Appeal, AppealGround, Cycle, Person } from "../types";
import { currentCalibration } from "./performance";

export const appealDays = 7;

export const appealGrounds: ReadonlyArray<{ id: AppealGround; label: string }> = [
  { id: "data", label: "ข้อมูลหรือการคำนวณผิด" },
  { id: "evidence", label: "หลักฐานไม่ถูกนำมาพิจารณา" },
  { id: "criteria", label: "ใช้เกณฑ์ไม่ตรงกับที่ตกลง" },
  { id: "circumstance", label: "มีเหตุนอกการควบคุม เช่น ลา หรือรองานจากผู้อื่น" },
  { id: "fairness", label: "สงสัยว่ามีอคติหรือไม่เป็นธรรม" },
];

export const appealGroundLabel = (ground?: AppealGround) =>
  appealGrounds.find(item => item.id === ground)?.label;

export function appealDue(publishedOn: string) {
  const day = new Date(`${publishedOn}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + appealDays);
  return day.toISOString().slice(0, 10);
}

/** Results published before the deadline existed stay appealable only while their round is open. */
export function canRequestAppeal(person: Person, cycle: Cycle, today: string) {
  if (person.status !== "published" || !person.decision?.level || person.appeal) return false;
  return person.publishedOn ? today <= appealDue(person.publishedOn) : cycle.status === "open";
}

export const isPendingAppeal = (person: Person) =>
  person.status === "published" && !!person.appeal && !person.appeal.response;

export const awaitingClarification = (person: Person) =>
  isPendingAppeal(person) && !!person.appeal?.clarification && !person.appeal.clarification.response;

const sameName = (first: string, second?: string) =>
  first.trim().toLocaleLowerCase() === second?.trim().toLocaleLowerCase();

/** The appeal reviewer can be neither the rating manager nor the HR reviewer who confirmed the result. */
export function isIndependentReviewer(reviewer: string, person: Person, managerName: string) {
  return !!reviewer.trim() && !sameName(reviewer, managerName) && !sameName(reviewer, currentCalibration(person)?.reviewer);
}

/** Levels an appeal may move a result to. An appeal never lowers a result. */
export const raisableLevels = (level: number) => [1, 2, 3, 4, 5].filter(option => option > level);

/** The level HR confirmed in calibration, before any appeal changed it. */
export function calibratedLevel(person: Pick<Person, "appeal">, level: number) {
  return raisedOnAppeal(person.appeal) ? person.appeal!.previousLevel! : level;
}

export const raisedOnAppeal = (appeal?: Appeal) => appeal?.outcome === "raised" && appeal.previousLevel !== undefined;

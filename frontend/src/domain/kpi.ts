import { demoDate } from "../config";
import { t } from "../i18n";
import { goalCutoffs } from "./goal-plan";
import type { Cycle, Goal, Person } from "../types";

export function goalLevel(goal: Goal) {
  if (goal.unmeasured || !Number.isFinite(goal.actual) || !goal.evidence?.trim() || !goal.period?.trim()) return null;
  const { actual } = goal;
  const cutoffs = goalCutoffs(goal);
  const meets = (value: number) => goal.direction === "lower" ? actual <= value : actual >= value;
  return 1 + cutoffs.filter(meets).length;
}

/** Labels of the inputs a goal still needs before it can be scored. */
export function missingFields(goal: Goal) {
  const missing: string[] = [];
  if (goal.unmeasured || !Number.isFinite(goal.actual)) missing.push(t("ผลจริง"));
  if (!goal.period?.trim()) missing.push(t("ช่วงเวลาที่วัด"));
  if (!goal.evidence?.trim()) missing.push(t("หลักฐาน"));
  return missing;
}

/** Share of the target reached, 0–100. */
export function goalProgress(goal: Goal) {
  if (goal.unmeasured) return 0;
  const ratio = goal.direction === "lower"
    ? (goal.actual <= goal.target ? 1 : goal.target / goal.actual)
    : (goal.target > 0 ? goal.actual / goal.target : 1);
  return Math.min(100, Math.max(0, (Number.isFinite(ratio) ? ratio : 0) * 100));
}

export function score(person: Pick<Person, "goals">) {
  const levels = person.goals.map(goalLevel);
  if (!levels.length || !levels.every(level => level !== null)) return null;
  return person.goals.reduce((sum, goal, index) => sum + levels[index] * goal.weight / 100, 0);
}

export function proposal(person: Pick<Person, "goals" | "review">, resultWeight = 70) {
  const results = score(person);
  const rating = person.review?.rating;
  if (results === null || rating === undefined || ![1, 2, 3, 4, 5].includes(rating)) return null;
  const overall = (Math.round(results * 100) * resultWeight + rating * 100 * (100 - resultWeight)) / 10000;
  return { overall, level: Math.round(overall) };
}

/** High, Low, or results that disagree: the cases that deserve a closer look before HR confirms them. */
export function isSensitiveCase(person: Pick<Person, "goals" | "review">, resultWeight: number) {
  const proposed = proposal(person, resultWeight);
  const results = score(person);
  if (!proposed || results === null || !person.review) return true;
  return proposed.level !== 3 || Math.abs(results - person.review.rating) >= 2 || person.goals.some(goal => goalLevel(goal) === 1);
}

/** Managers may rate behavior at any point before the review reaches HR. */
export const canReviewBehavior = (person: Pick<Person, "status">, cycle: Pick<Cycle, "status">) =>
  cycle.status === "open" && ["employee", "approval", "manager", "returned"].includes(person.status);

/** The rating goes to HR only after the employee's submission has been approved. */
export const reviewReadyToSend = (person: Pick<Person, "status">) => ["manager", "returned"].includes(person.status);

export function reviewActionLabel(person: Pick<Person, "status" | "reviewDraft">) {
  if (!person.reviewDraft) return t("ประเมินพฤติกรรม");
  return reviewReadyToSend(person) ? t("ตรวจและส่งให้ HR") : t("แก้ไขคะแนนพฤติกรรม");
}

export function category(level?: number) {
  if (!level) return "ยังประเมินไม่ได้";
  if (level >= 4) return "สูงกว่าความคาดหวัง";
  if (level <= 2) return "ต่ำกว่าความคาดหวัง";
  return "ตามความคาดหวัง";
}

export function overdue(person: Person) {
  return ["manager", "returned"].includes(person.status) && person.due < demoDate;
}

export function reviewFlag(person: Person, resultWeight: number) {
  const proposed = proposal(person, resultWeight);
  if (!proposed) return t("หลักฐานหรือคะแนนยังไม่ครบ");
  const results = score(person);
  if (results !== null && person.review && Math.abs(results - person.review.rating) >= 2) return t("ผลลัพธ์กับพฤติกรรมต่างกัน ≥ 2 ระดับ");
  if (proposed.level !== 3) return t("ทบทวนระดับนอกเกณฑ์คาดหวัง");
  return t("ตรวจตามเกณฑ์กลาง");
}

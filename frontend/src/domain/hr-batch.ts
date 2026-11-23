import { t } from "../i18n";
import type { Cycle, Person, Team } from "../types";
import { goalLevel, proposal, score } from "./kpi";
import { awaitingSecondReview, hasCurrentSecondReview } from "./manager-feedback";
import { managerForPerson } from "./managers";
import { snapshotCalibration } from "./performance";

export const routineReason = () => t("ผลงานเป็นไปตามเกณฑ์ที่ตกลงไว้ HR ยืนยันตามระดับที่ระบบเสนอ");
export const routineNext = () => t("รักษาผลงานและตั้งเป้าหมายร่วมกับ Manager ในรอบถัดไป");

/** Why HR must read this person individually. An empty list means the proposed level can be confirmed in a batch. */
export function reviewExceptions(person: Person, cycle: Cycle) {
  const reasons: string[] = [];
  const proposed = proposal(person, cycle.resultWeight);
  const results = score(person);
  if (!person.goals.length || results === null) reasons.push(t("ข้อมูล KPI ไม่ครบ"));
  if (!person.review) reasons.push(t("ยังไม่มีคะแนนจาก Manager"));
  if (proposed && proposed.level >= 4) reasons.push(t("ผลสูงกว่าความคาดหวัง"));
  if (proposed && proposed.level <= 2) reasons.push(t("ผลต่ำกว่าความคาดหวัง"));
  if (person.goals.some(goal => goalLevel(goal) === 1)) reasons.push(t("มี KPI ต่ำกว่าเกณฑ์ระดับ 2"));
  if (results !== null && person.review && Math.abs(results - person.review.rating) >= 2) reasons.push(t("ผลลัพธ์กับพฤติกรรมต่างกัน ≥ 2 ระดับ"));
  if (awaitingSecondReview(person, cycle)) reasons.push(t("ต้องมีผู้ทบทวนคนที่สอง"));
  if (person.secondReview && person.secondReview.rating !== person.review?.rating) reasons.push(t("ผู้ทบทวนคนที่สองให้คะแนนต่างจาก Manager"));
  return reasons;
}

const awaitingHr = (people: Person[], cycle: Cycle) =>
  people.filter(person => cycle.teams.includes(person.team) && person.status === "hr");

export const routineCases = (people: Person[], cycle: Cycle) =>
  awaitingHr(people, cycle).filter(person => !reviewExceptions(person, cycle).length);

export const exceptionCases = (people: Person[], cycle: Cycle) => awaitingHr(people, cycle)
  .map(person => ({ person, reasons: reviewExceptions(person, cycle) }))
  .filter(entry => entry.reasons.length > 0);

export const publishableCases = (people: Person[], cycle: Cycle) => people.filter(person =>
  cycle.teams.includes(person.team) && person.status === "decided" && !!person.decision?.level &&
  !!proposal(person, cycle.resultWeight) && hasCurrentSecondReview(person, cycle));

export function confirmRoutine(people: Person[], cycle: Cycle, reviewer: string, at: string) {
  if (cycle.status !== "open") return { people, count: 0 };
  const ids = new Set(routineCases(people, cycle).map(person => person.id));
  const updated = people.map(person => {
    const proposed = proposal(person, cycle.resultWeight);
    const results = score(person);
    if (!ids.has(person.id) || !proposed || results === null || !person.review) return person;
    const citations = new Set([...person.goals.map((_, index) => `kpi-${index}`), "manager"]);
    const reason = routineReason();
    const record = snapshotCalibration(person, {
      id: String((person.calibrationHistory?.length ?? 0) + 1), at, reviewer, proposed, finalLevel: proposed.level,
      reason, resultWeight: cycle.resultWeight, workScore: results,
      manager: { name: managerForPerson(cycle, person).name, rating: person.review.rating, feedback: person.review.feedback, cited: true },
    }, citations);
    return {
      ...person, status: "decided" as const,
      decision: { level: proposed.level, proposed: proposed.level, reason, next: person.review.next || routineNext(),
        secondReviewAt: person.secondReview?.at, calibrationId: record.id },
      calibrationHistory: [record, ...(person.calibrationHistory ?? [])],
      activity: [{ role: "hr" as const, message: t("HR ยืนยันตามระดับที่เสนอแบบกลุ่ม โดย {0}", reviewer), at }, ...person.activity],
    };
  });
  return { people: updated, count: ids.size };
}

export function publishCases(people: Person[], cycle: Cycle, team: Team | "", on: string, at: string) {
  if (cycle.status !== "open") return { people, count: 0 };
  const ids = new Set(publishableCases(people, cycle).filter(person => !team || person.team === team).map(person => person.id));
  const updated = people.map(person => !ids.has(person.id) ? person : {
    ...person, status: "published" as const, publishedOn: on,
    activity: [{ role: "hr" as const, message: t("เผยแพร่ผลให้พนักงานแล้ว"), at }, ...person.activity],
  });
  return { people: updated, count: ids.size };
}

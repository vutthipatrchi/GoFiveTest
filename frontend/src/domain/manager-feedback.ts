import type { Cycle, FeedbackRatings, ManagerFeedback, ManagerId, Person } from "../types";
import { isSensitiveCase } from "./kpi";
import { personManagerId } from "./managers";
import { t } from "../i18n";

export const feedbackQuestions = [
  "อธิบายเกณฑ์และความคาดหวังให้ทีมทราบก่อนประเมิน",
  "ให้ข้อเสนอแนะอย่างสม่ำเสมอตลอดรอบ",
  "ใช้ตัวอย่างผลงานและเหตุการณ์จริงประกอบการให้คะแนน",
] as const;
export const minimumResponses = 3;
export const feedbackGapThreshold = 1;

export function validRatings(values: readonly number[]): values is FeedbackRatings {
  return values.length === feedbackQuestions.length &&
    values.every(value => Number.isInteger(value) && value >= 1 && value <= 5);
}

export function addManagerFeedback(current: ManagerFeedback | undefined, ratings: FeedbackRatings, voterId?: string): ManagerFeedback | undefined {
  if (!validRatings(ratings)) return undefined;
  const entry: ManagerFeedback = current ?? { teamTotals: [0, 0, 0], respondedIds: [] };
  if (voterId === undefined) return entry.self ? undefined : { ...entry, self: ratings };
  if (entry.respondedIds.includes(voterId)) return undefined;
  const [clear, regular, evidence] = entry.teamTotals;
  return {
    ...entry,
    teamTotals: [clear + ratings[0], regular + ratings[1], evidence + ratings[2]],
    respondedIds: [...entry.respondedIds, voterId],
  };
}

const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

export function feedbackSummary(cycle: Cycle, managerId: ManagerId) {
  const entry = cycle.managerFeedback?.[managerId];
  const count = entry?.respondedIds.length ?? 0;
  const self = entry?.self ? total(entry.self) / feedbackQuestions.length : null;
  const sampleSize = count * feedbackQuestions.length;
  const teamMean = entry && count >= minimumResponses ? total(entry.teamTotals) / sampleSize : null;
  const difference = entry?.self && teamMean !== null ? Math.abs(total(entry.self) * count - total(entry.teamTotals)) : null;
  return {
    count, self, teamMean,
    gap: difference === null ? null : difference / sampleSize,
    flagged: difference !== null && difference >= feedbackGapThreshold * sampleSize,
  };
}

export function secondReviewReasons(person: Person, cycle: Cycle) {
  if (cycle.status !== "open" || !person.review || !["hr", "decided"].includes(person.status)) return [];
  const reasons: string[] = [];
  if (feedbackSummary(cycle, personManagerId(person)).flagged && isSensitiveCase(person, cycle.resultWeight)) reasons.push(t("ผลประเมินตนเองของ Manager ต่างจากผลรวมลูกทีม"));
  if (!person.review.feedback?.trim()) reasons.push(t("คะแนน Manager ยังไม่มีเหตุการณ์หรือหลักฐานประกอบ"));
  return reasons;
}

export function awaitingSecondReview(person: Person, cycle: Cycle) {
  return !person.secondReview && secondReviewReasons(person, cycle).length > 0;
}

export function hasCurrentSecondReview(person: Person, cycle: Cycle) {
  if (!person.secondReview) return secondReviewReasons(person, cycle).length === 0;
  // A later second opinion needs a new decision only when it disagrees with the manager's rating.
  return person.decision?.secondReviewAt === person.secondReview.at ||
    (!!person.decision && person.secondReview.rating === person.review?.rating);
}

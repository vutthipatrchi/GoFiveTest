import type { GoalDefinition, WorkItem, WorkSource } from "../types";
import { formatLocale } from "../i18n";

export function workStatus(item: WorkItem, now = new Date()) {
  const first = item.attempts[0];
  const latest = item.attempts.at(-1);
  const due = Date.parse(item.dueAt);
  const dueForMeasurement = now.getTime() >= due;
  return {
    timeliness: first ? (Date.parse(first.submittedAt) <= due ? "on-time" : "late")
      : dueForMeasurement ? "overdue" : "pending",
    dueForMeasurement,
    quality: first?.review?.decision,
    pendingReview: !!first && !first.review,
    reviewedAfterChanges: first?.review?.decision === "changes" && latest?.review?.decision === "approved",
  } as const;
}

export function deliveryMetrics(items: WorkItem[], now = new Date()) {
  const statuses = items.map(item => workStatus(item, now));
  const timed = statuses.filter(status => status.dueForMeasurement);
  const reviewed = statuses.filter(status => status.quality !== undefined);
  return {
    onTime: timed.filter(status => status.timeliness === "on-time").length,
    timed: timed.length,
    firstPass: reviewed.filter(status => status.quality === "approved").length,
    reviewed: reviewed.length,
    pendingReview: statuses.filter(status => status.pendingReview).length,
  };
}

export const deliveryGoal = (goal: GoalDefinition) =>
  (goal.source === "work-delivery" || (goal.source === undefined && goal.name === "ส่งมอบงานตามกำหนด")) &&
  goal.unit === "%" && goal.direction !== "lower";

export function sourceDeliveryRate(source: WorkSource) {
  const { onTime, timed } = deliveryMetrics(source.records, new Date(source.asOf));
  return timed ? onTime * 100 / timed : null;
}

export function workDateTime(value: string) {
  return new Intl.DateTimeFormat(formatLocale(), {
    dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

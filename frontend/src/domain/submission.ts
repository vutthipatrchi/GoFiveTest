import type { Person } from "../types";

export const approvalDays = 7;

export function bangkokDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = (unit: "year" | "month" | "day") => parts.find(part => part.type === unit)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function approvalDue(submittedOn: string) {
  const day = new Date(`${submittedOn}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + approvalDays);
  return day.toISOString().slice(0, 10);
}

export function employeeOverdue(person: Person, employeeDue: string, today = bangkokDay()) {
  const submission = person.submission;
  if (submission?.decision === "declined" || (!submission && person.status === "employee")) {
    return today > employeeDue;
  }
  return !!submission && submission.submittedOn > employeeDue;
}

export function approvalOverdue(person: Person, today = bangkokDay()) {
  return person.status === "approval" && !!person.submission && today > person.submission.approvalDue;
}

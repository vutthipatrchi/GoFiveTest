import type { ReactNode } from "react";
import { remindAheadDays } from "../domain/reminders";
import { bangkokDay } from "../domain/submission";
import { t } from "../i18n";
import type { Person } from "../types";
import { date, daysBetween } from "../utils/format";
import { Button, Icon, Panel } from "./ui";

export type TodoUrgency = "late" | "soon" | "ready";

export interface TodoItem {
  id: string;
  urgency: TodoUrgency;
  title: string;
  detail?: string;
  people?: Person[];
  due?: string;
  dueText?: string;
  action: { label: string; onClick: () => void };
}

export function todoUrgency(due: string | undefined, late: boolean, today: string): TodoUrgency {
  if (late || (due && daysBetween(today, due) < 0)) return "late";
  if (due && daysBetween(today, due) <= remindAheadDays) return "soon";
  return "ready";
}

function urgencyLabel(urgency: "late" | "soon", due: string | undefined, today: string) {
  const days = due ? daysBetween(today, due) : undefined;
  if (urgency === "late") return days !== undefined && days < 0 ? t("เลยกำหนด {0} วัน", -days) : t("เลยกำหนด");
  if (days === 0) return t("ครบกำหนดวันนี้");
  if (days === 1) return t("ครบกำหนดพรุ่งนี้");
  return days !== undefined && days > 1 ? t("เหลือ {0} วัน", days) : t("ควรทำเร็ว ๆ นี้");
}

export function DueChip({ label, due, today }: { label: string; due: string; today: string }) {
  const urgency = todoUrgency(due, false, today);
  const tone = urgency === "late" ? "red" : urgency === "soon" ? "amber" : "date-label";
  const relative = urgency === "ready" ? t("เหลือ {0} วัน", daysBetween(today, due)) : urgencyLabel(urgency, due, today);
  return <span className={`pill ${tone}`}>{label} {date(due)} · {relative}</span>;
}

const urgencyOrder = { late: 0, soon: 1, ready: 2 };

export function TodoBoard({ items, summary, note, empty, today = bangkokDay() }: {
  items: TodoItem[]; summary?: string; note?: ReactNode; empty?: string; today?: string;
}) {
  const urgent = items.filter(item => item.urgency !== "ready").sort((a, b) =>
    urgencyOrder[a.urgency] - urgencyOrder[b.urgency] || (a.due || "9999").localeCompare(b.due || "9999"));
  const columns = [
    { id: "urgent", label: t("ด่วน · ทำก่อน"), cards: urgent },
    { id: "ready", label: t("พร้อมทำ"), cards: items.filter(item => item.urgency === "ready") },
  ];
  return <Panel title={t("สิ่งที่ต้องทำ")} description={summary}>
    {note && <p className="todo-board-note subtle">{note}</p>}
    {items.length ? <div className="todo-board">{columns.map(({ id, label, cards }) =>
      <section key={id} className={`todo-col todo-col-${id}`}>
        <h3><span>{label}</span><span className="pill">{cards.length}</span></h3>
        {cards.length ? <ul>{cards.map((item, index) => {
          const people = item.people ?? [];
          const deadline = item.due ? date(item.due) : item.dueText;
          return <li className="todo-card" key={item.id}>
            {item.urgency !== "ready" && <span className={`pill ${item.urgency === "late" ? "red" : "amber"}`}>
              {urgencyLabel(item.urgency, item.due, today)}
            </span>}
            <h4>{item.title}</h4>
            {item.detail && <p className="subtle">{item.detail}</p>}
            {(people.length > 0 || deadline) && <div className="todo-card-meta">
              {people.length > 0 && <span className="todo-card-avatars" aria-label={people.map(person => person.name).join(", ")} role="img">
                {people.slice(0, 3).map(person => <span key={person.id} className="avatar" aria-hidden="true">{person.initials}</span>)}
                {people.length > 3 && <span className="avatar" aria-hidden="true">+{people.length - 3}</span>}
              </span>}
              {deadline && <span className="todo-card-due"><Icon name="backlog" size={15} />{deadline}</span>}
            </div>}
            <Button variant={id === "urgent" && index === 0 ? "" : "secondary"} onClick={item.action.onClick}>{item.action.label}</Button>
          </li>;
        })}</ul> : <p className="empty">{t("ไม่มีงานในกลุ่มนี้")}</p>}
      </section>)}</div> : <p className="empty">{empty ?? t("ไม่มีงานค้างในตอนนี้")}</p>}
  </Panel>;
}

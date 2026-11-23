import { t } from "../i18n";
import { useEffect, useRef, useState } from "react";
import { dueText, lastReminder, managerTasks, reminderHistory, remindAheadDays, type ManagerTask } from "../domain/reminders";
import { summarizeTeams } from "../domain/hr-overview";
import { bangkokDay } from "../domain/submission";
import { workDateTime } from "../domain/work";
import type { Cycle, ManagerId, Person } from "../types";
import { date } from "../utils/format";
import { Button, Heading, Panel, Stat } from "./ui";

const levelLabel = { late: "เลยกำหนด", soon: "ใกล้ครบกำหนด", upcoming: "แจ้งล่วงหน้า" } as const;
const levelTone = { late: "red", soon: "amber", upcoming: "blue" } as const;

/** Header bell for managers: tasks inside the reminder window plus reminders HR recorded. */
export function NotificationBell({ people, cycle, managerId, onOpen }: {
  people: Person[]; cycle: Cycle; managerId: ManagerId; onOpen: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const alerts = managerTasks(people, cycle).filter(task => task.level);
  const reminders = reminderHistory(cycle, managerId, people).slice(0, 3);
  const urgent = alerts.filter(task => task.level !== "upcoming").length;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const go = (id: string) => { setOpen(false); onOpen(id); };
  return <div className="bell" ref={box}>
    <button type="button" className="bell-button" aria-expanded={open} aria-haspopup="true"
      aria-label={t("การแจ้งเตือน {0} รายการ", alerts.length)} onClick={() => setOpen(value => !value)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
      {alerts.length > 0 && <span className={`bell-count ${urgent ? "urgent" : ""}`}>{alerts.length}</span>}
    </button>
    {open && <div className="bell-panel" role="dialog" aria-label={t("การแจ้งเตือน")}>
      <div className="bell-head"><strong>{t("การแจ้งเตือน")}</strong><span className="subtle">{t("เตือนล่วงหน้า") + " "}{remindAheadDays}{" " + t("วันก่อนครบกำหนด")}</span></div>
      {reminders.map(entry => <div className="bell-item reminder" key={entry.at}>
        <span className="pill red">{t("จาก HR")}</span>
        <div><strong>{entry.text}</strong><div className="subtle">{workDateTime(entry.at)}</div></div>
      </div>)}
      {alerts.length ? alerts.map((task, index) => <button type="button" className="bell-item" key={`${task.person.id}-${task.kind}-${index}`}
        onClick={() => go(task.person.id)}>
        <span className={`pill ${levelTone[task.level!]}`}>{t(levelLabel[task.level!])}</span>
        <div><strong>{t(task.kind)} · {task.person.name}</strong>
          <div className="subtle">{task.detail} · {date(task.due)} · {dueText(task)}</div></div>
      </button>) : !reminders.length && <p className="empty">{t("ไม่มีงานใกล้ครบกำหนด")}</p>}
    </div>}
  </div>;
}

function TaskList({ tasks, onOpen }: { tasks: ManagerTask[]; onOpen: (id: string) => void }) {
  return <ul className="inbox">{tasks.map((task, index) => <li key={`${task.person.id}-${task.kind}-${index}`} className={task.level}>
    <span className="avatar">{task.person.initials}</span>
    <div className="inbox-body">
      <div className="inbox-title"><span className="inbox-kind">{t(task.kind)}</span><strong>{task.person.name}</strong></div>
      <div className="subtle">{task.detail}</div>
    </div>
    <div className="inbox-meta">
      {task.due && <span className={task.level ? `pill ${levelTone[task.level]}` : "subtle"}>{date(task.due)} · {dueText(task)}</span>}
      <Button variant="secondary" onClick={() => onOpen(task.person.id)}>{t("เปิดรายการ")}</Button>
    </div>
  </li>)}</ul>;
}

/** HR view of every manager's outstanding reviews, worst first. */
export function ManagerBacklog({ people, cycle, onOpen, onRemind }: {
  people: Person[]; cycle: Cycle; onOpen: (id: string) => void; onRemind: (managerId: ManagerId) => void;
}) {
  const [expanded, setExpanded] = useState<ManagerId>();
  const today = bangkokDay();
  const rows = summarizeTeams(people, cycle, today).flatMap(team => team.managers).map(manager => {
    const late = manager.tasks.filter(task => task.level === "late");
    const worst = Math.max(0, ...late.map(task => -(task.daysLeft ?? 0)));
    return { ...manager, worst, reminded: lastReminder(cycle, manager.id, manager.members) };
  }).sort((a, b) => b.worst - a.worst || b.late - a.late || b.tasks.length - a.tasks.length);
  const total = rows.reduce((sum, row) => sum + row.tasks.length, 0);
  const lateTotal = rows.reduce((sum, row) => sum + row.late, 0);

  return <>
    <Heading title={t("งานค้างของ Manager")} description={t("ติดตามการอนุมัติและการประเมินผลงานปลายรอบ")} />
    <div className="stats">
      <Stat label={t("Manager ที่มีงานค้าง")}>{rows.filter(row => row.tasks.length).length} / {rows.length}</Stat>
      <Stat label={t("งานค้างทั้งหมด")}>{total}</Stat>
      <Stat label={t("งานเลยกำหนด")}>{lateTotal}</Stat>
      <Stat label={t("ค้างนานสุด")}>{rows[0]?.worst ? t("{0} วัน", rows[0].worst) : "—"}</Stat>
    </div>
    <Panel title={t("รายชื่อ Manager")} description={t("เรียงจาก Manager ที่งานเลยกำหนดนานที่สุด · กดดูรายการเพื่อเปิดงานรายคน")}>
      <div className="scroll"><table><thead><tr>
        <th>{t("Manager / ตำแหน่ง")}</th><th>{t("งานค้าง")}</th><th>{t("เลยกำหนด")}</th><th>{t("ค้างนานสุด")}</th><th>{t("ครบกำหนดถัดไป")}</th><th>{t("เตือนล่าสุด")}</th><th>{t("ดำเนินการ")}</th>
      </tr></thead><tbody>{rows.map(row => <tr key={row.id} className={row.late ? "row-late" : undefined}>
        <td><strong>{row.name}</strong><div className="subtle">{row.title}</div></td>
        <td>{row.tasks.length}</td>
        <td>{row.late ? <span className="pill red">{row.late}{" " + t("งาน")}</span> : "—"}</td>
        <td>{row.worst ? t("{0} วัน", row.worst) : "—"}</td>
        <td>{row.nextDue ? date(row.nextDue) : "—"}</td>
        <td>{row.reminded ? workDateTime(row.reminded) : <span className="subtle">{t("ยังไม่เคยเตือน")}</span>}</td>
        <td><div className="actions">
          <Button variant="text" onClick={() => setExpanded(expanded === row.id ? undefined : row.id)}>
            {expanded === row.id ? t("ซ่อนรายการ") : t("ดูรายการ")}</Button>
          {row.tasks.length > 0 && <Button variant="secondary" onClick={() => onRemind(row.id)}>{t("บันทึกการเตือน")}</Button>}
        </div></td>
      </tr>)}</tbody></table></div>
    </Panel>
    {rows.filter(row => row.id === expanded).map(row => <Panel key={row.id} title={t("งานค้างของ {0}", row.name)}
      description={t("{0} · {1} งาน · เปิดรายการเพื่อบันทึกการเตือนรายคนหรือขยายเวลา", row.title, row.tasks.length)}
      actions={<Button variant="text" onClick={() => setExpanded(undefined)}>{t("ปิด")}</Button>}>
      {row.tasks.length ? <TaskList tasks={row.tasks} onOpen={onOpen} /> : <p className="empty">{t("ไม่มีงานค้าง")}</p>}
    </Panel>)}
  </>;
}

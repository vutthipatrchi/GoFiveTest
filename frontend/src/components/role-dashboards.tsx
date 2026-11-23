import { useState } from "react";
import { t } from "../i18n";
import { canReviewBehavior, category, goalLevel, goalProgress, reviewActionLabel } from "../domain/kpi";
import { needsGoalAssignment } from "../domain/goal-plan";
import { bangkokDay, employeeOverdue } from "../domain/submission";
import { dueText, managerTasks, reminderHistory } from "../domain/reminders";
import { milestoneCounts } from "../domain/review-stages";
import { workDateTime as dateTime } from "../domain/work";
import { isSystemResult } from "../domain/work-sync";
import { feedbackSummary, minimumResponses } from "../domain/manager-feedback";
import { managersForTeam } from "../domain/managers";
import type { Cycle, ManagerId, Person, Team } from "../types";
import { date, number } from "../utils/format";
import { PlanStatus, planState } from "./goal-plan";
import { CycleStatus } from "./overview";
import { AppealPanel } from "./appeals";
import { ResultCard, type PersonAction } from "./person";
import { DueChip, TodoBoard, todoUrgency, type TodoItem } from "./todo-board";
import { Badge, Button, Heading, Icon, Panel, PersonLabel, Stat } from "./ui";

export function EmployeeDashboard({ person, cycle, onWork, onAction, onFeedback, feedbackPending }: {
  person: Person; cycle: Cycle; onWork: () => void; onAction: (action: PersonAction, index?: number) => void;
  onFeedback?: () => void; feedbackPending?: boolean;
}) {
  const isOpen = cycle.status === "open";
  const isClosed = cycle.status === "closed";
  const hasStarted = cycle.status !== "draft";
  const today = bangkokDay();
  const editable = !isClosed && person.status === "employee";
  const waitingForPlan = editable && needsGoalAssignment(person);
  const remaining = person.goals.map((goal, index) => goalLevel(goal) === null ? index : -1).filter(index => index >= 0);
  const canSubmit = isOpen && editable && person.goals.length > 0 && !remaining.length;
  const due = isOpen ? cycle.employeeDue || undefined : undefined;
  const late = !!due && employeeOverdue(person, due, today);
  const urgency = todoUrgency(due, late, today);
  const published = hasStarted && person.status === "published";
  const decision = person.decision;
  const items: TodoItem[] = [];

  if (editable && person.returnReason) items.push({
    id: "returned", urgency: "late", title: t("แก้ไขตามที่ส่งกลับ"), detail: person.returnReason, due,
    action: { label: t("แก้ไข"), onClick: onWork },
  });
  if (isOpen && editable && remaining.length) items.push({
    id: "check-kpis", urgency, title: t("ตรวจสอบ KPI ที่ข้อมูลยังไม่ครบ ({0} ตัว)", remaining.length),
    detail: remaining.map(index => t(person.goals[index].name)).join(" · "), due,
    action: { label: t("ดูข้อมูลและหลักฐาน"), onClick: onWork },
  });
  if (canSubmit) {
    const ready = t("ข้อมูล KPI ครบทั้ง {0} ตัวแล้ว · Manager จะอนุมัติก่อนเริ่มประเมิน", person.goals.length);
    items.push({ id: "submit", urgency, title: t("เขียนสรุปผลงานและส่งให้ Manager"), due,
      detail: late ? `${ready} · ${t("เลยกำหนดส่ง {0} แล้ว คุณยังส่งผลงานได้", date(due))}` : ready,
      action: { label: t("เขียนสรุปและส่ง"), onClick: () => onAction("submit") } });
  }
  if (published && decision?.level && !person.acknowledged) items.push({
    id: "acknowledge", urgency: "soon", title: t("รับทราบผลประเมิน"),
    action: { label: t("ดูผลและรับทราบ"), onClick: onWork },
  });
  if (isOpen && feedbackPending && onFeedback) items.push({
    id: "feedback", urgency: "ready", title: t("ให้ feedback ต่อ Manager"),
    detail: t("แบบสอบถามสั้น 1 ชุด · ไม่ระบุชื่อ · Manager เห็นเฉพาะค่าเฉลี่ย"),
    action: { label: t("เริ่มตอบ"), onClick: onFeedback },
  });

  let waiting: string | undefined;
  if (waitingForPlan) waiting = `${t("รอ HR จัดแผน KPI")} · ${t("เมื่อ HR ส่งแผน KPI ผลงานจากระบบจะแสดงที่หน้านี้")}`;
  else if (isOpen && person.status === "approval") waiting = t("รอ Manager อนุมัติสรุปผลงาน · กำหนด {0}", date(person.submission?.approvalDue));
  else if (isOpen && ["manager", "returned"].includes(person.status)) waiting = t("Manager กำลังประเมินผลงาน · กำหนด {0}", date(person.due));
  else if (isOpen && ["hr", "decided"].includes(person.status)) waiting = t("HR กำลังทบทวนมาตรฐานคะแนน ผลจะแสดงที่นี่เมื่อเผยแพร่");

  let empty = waiting ?? t("ไม่มีงานค้างในตอนนี้");
  if (isClosed && !published) empty = t("รอบนี้ปิดแล้วและยังไม่มีผลเผยแพร่");
  else if (!hasStarted && !waiting) empty = t("ตรวจ KPI และผลจากระบบได้ทันที เมื่อ HR เปิดรอบจึงเริ่มส่งประเมินได้");

  return <>
    <Heading title={t("สวัสดี {0}", person.name.trim().split(/\s+/)[0])}
      description={[person.team, t(person.title), t(cycle.name)].filter(Boolean).join(" · ")}
      actions={isClosed ? <CycleStatus status="closed" />
        : editable && due ? <DueChip label={t("กำหนดส่งผลงาน")} due={due} today={today} /> : undefined} />
    <TodoBoard items={items} note={items.length ? waiting : undefined} empty={empty} today={today} />
    {!!person.kpiIssues?.length && <Panel title={t("รายการแจ้งข้อมูลคลาดเคลื่อน")} actions={<Button variant="text" onClick={onWork}>{t("ดูรายละเอียดทั้งหมด")}</Button>}>
      <p>{t("รอหัวหน้าตรวจสอบ {0} รายการ · ตอบแล้ว {1} รายการ", person.kpiIssues.filter(issue => !issue.response).length, person.kpiIssues.filter(issue => issue.response).length)}</p>
    </Panel>}
    {published && decision?.level && <div className="stats">
      <Stat label={t("ผลการประเมิน")}>{t(category(decision.level))}</Stat>
      <Stat label={t("วันติดตามผล")}>{date(decision.followUp)}</Stat>
      <Stat label={t("การรับทราบผล")}>{person.acknowledged ? t("รับทราบแล้ว") : t("ยังไม่รับทราบ")}</Stat>
    </div>}
    {published && decision && <Panel title={t("ผลประเมินของคุณ")} description={t("ดูเหตุผล แผนพัฒนา และวันติดตามผล")}
      actions={<Button variant="secondary" onClick={onWork}>{t("ดูรายละเอียดทั้งหมด")}</Button>}>
      <ResultCard person={person} showLevel={false} />
      <AppealPanel person={person} cycle={cycle} role="employee" onAction={onAction} />
    </Panel>}
    {person.goals.length > 0 && <Panel title={t("KPI ของฉัน")} description={t("{0} ตัว", person.goals.length)}
      actions={<Button variant="text" onClick={onWork}>{t("ดูหลักฐานและประวัติ")} <span aria-hidden="true">›</span></Button>}>
      <ul className="dashboard-list">{person.goals.map((goal, index) => {
        const complete = goalLevel(goal) !== null;
        const progress = goalProgress(goal);
        return <li key={index} className="kpi-row">
          <div className="kpi-main">
            <div className="kpi-title"><strong>{t(goal.name)}</strong><span className="subtle">{t("น้ำหนัก") + " "}{goal.weight}%</span></div>
            {!goal.unmeasured && <div className="kpi-bar" role="progressbar" aria-label={t("ความคืบหน้า {0}", t(goal.name))}
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
              <span style={{ width: `${progress}%` }} /></div>}
            <div className="subtle">{goal.unmeasured ? t("รอข้อมูลจากระบบงาน") : t("ผลจริง {0} {1}", number(goal.actual), t(goal.unit))}{" " + t("· เป้าหมาย") + " "}{number(goal.target)} {t(goal.unit)}</div>
          </div>
          <div className="actions"><span className={`pill ${complete ? "green" : "amber"}`}>
            {complete ? t("ข้อมูลครบ") : t("รอข้อมูลจากระบบงาน")}
          </span>{isSystemResult(goal) && <span className="pill blue">{t("จากระบบงานจำลอง")}</span>}</div>
        </li>;
      })}</ul>
    </Panel>}
  </>;
}

type Signal = { text: string; tone: "red" | "amber" };

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const personProgress = (person: Person) => average(person.goals.filter(goal => !goal.unmeasured && Number.isFinite(goal.actual)).map(goalProgress));
const lastUpdate = (person: Person) => person.goals.flatMap(goal => goal.updates ?? [])
  .map(update => update.recordedOn ?? "").filter(Boolean).sort().at(-1);

function signals(person: Person, cycle: Cycle, today: string): Signal[] {
  const found: Signal[] = [];
  if (cycle.status === "open" && employeeOverdue(person, cycle.employeeDue, today)) found.push({ text: t("เลยกำหนดส่งผลงาน"), tone: "red" });
  const behind = person.goals.filter(goal => !goal.unmeasured && Number.isFinite(goal.actual) && goalProgress(goal) < 80);
  if (behind.length) found.push({ text: t("KPI ต่ำกว่า 80% ของเป้า · {0}", behind.map(goal => t(goal.name)).join(", ")), tone: "amber" });
  return found;
}

export function ManagerDashboard({ people, cycle, team, managerId = team, onOpen, onFeedback, onReview }: {
  people: Person[]; cycle: Cycle; team: Team; managerId?: ManagerId; onOpen: (id: string) => void; onFeedback?: () => void;
  onReview?: (person: Person) => void;
}) {
  const [filter, setFilter] = useState("");
  const isOpen = cycle.status === "open";
  const isClosed = cycle.status === "closed";
  const hasStarted = cycle.status !== "draft";
  const today = bangkokDay();
  const queue = managerTasks(people, cycle, today);
  const reminder = isClosed ? undefined : reminderHistory(cycle, managerId, people)[0];
  const manager = managersForTeam(cycle, team).find(reviewer => reviewer.id === managerId);
  const teamProgress = average(people.map(personProgress).filter((value): value is number => value !== null));
  const published = people.filter(person => person.status === "published");
  const feedback = feedbackSummary(cycle, managerId);
  const accepted = people.filter(person => planState(person) === "active").length;
  const stages = milestoneCounts(people);
  const active = stages.find(stage => stage.filter === filter);
  const rows = active ? people.filter(person => active.states.includes(person.status)) : people;

  const items: TodoItem[] = queue.map(item => ({
    id: item.person.id, urgency: item.level === "late" ? "late" : item.level ? "soon" : "ready",
    title: t("{0} {1}", t(item.kind), item.person.name), detail: item.detail, due: item.due, people: [item.person],
    action: { label: item.action, onClick: () => onOpen(item.person.id) },
  }));
  if (isOpen) for (const person of people) {
    const pending = person.kpiIssues?.filter(issue => !issue.response);
    if (pending?.length) items.push({
      id: `kpi-issues-${person.id}`, urgency: "ready", title: t("ตรวจสอบข้อมูล KPI ของ {0}", person.name),
      detail: pending.map(issue => t(issue.goalName)).join(" · "),
      action: { label: t("ดูรายละเอียดทั้งหมด"), onClick: () => onOpen(person.id) },
    });
  }
  if (isOpen && feedback.self === null && onFeedback) items.push({
    id: "self-feedback", urgency: "ready", title: t("ประเมินวิธีให้คะแนนของตนเอง"), dueText: t("ภายในรอบนี้"),
    action: { label: t("เริ่มประเมิน"), onClick: onFeedback },
  });

  return <>
    <Heading title={t("ภาพรวมลูกทีม")} description={`${manager?.name ?? team} · ${manager?.title ?? team} · ${t(cycle.name)}`}
      actions={isClosed ? <CycleStatus status="closed" /> : isOpen && cycle.managerDue
        ? <DueChip label={t("กำหนดส่งของคุณ")} due={cycle.managerDue} today={today} /> : undefined} />
    <TodoBoard items={items} today={today}
      note={reminder && t("HR เตือนล่าสุด · {0} · {1}", reminder.text, dateTime(reminder.at))}
      empty={!hasStarted ? t("รอ HR เปิดรอบ ระหว่างนี้ติดตามความคืบหน้า KPI ของทีมได้") : undefined} />

    <Panel title={t("ลูกทีม")} description={t("{0} คน · มีแผน KPI แล้ว {1} คน · KPI เฉลี่ยเทียบเป้า {2}",
      people.length, accepted, teamProgress === null ? "—" : `${number(teamProgress)}%`)}>
      <div className="dashboard-stage-filters" role="group" aria-label={t("กรองตามขั้นตอน")}>
        <button type="button" aria-pressed={!filter} onClick={() => setFilter("")}>{t("ทั้งหมด {0}", people.length)}</button>
        {stages.map(stage => <button type="button" key={stage.filter} aria-pressed={filter === stage.filter} onClick={() => setFilter(stage.filter)}>
          {t(stage.filter === "stage-manager" ? "รอคุณประเมิน" : stage.label)} {stage.count}
        </button>)}
      </div>
      {rows.length ? <div className="scroll"><table className="dashboard-report-table"><thead><tr>
        <th scope="col">{t("พนักงาน")}</th><th scope="col">{t("ขั้นตอน")}</th><th scope="col">{t("KPI เทียบเป้า")}</th>
        <th scope="col">{t("อัปเดตล่าสุด")}</th><th scope="col"><span className="sr-only">{t("รายละเอียด")}</span></th>
      </tr></thead><tbody>{rows.map(person => {
        const progress = personProgress(person);
        const last = lastUpdate(person);
        const late = queue.find(item => item.person.id === person.id && item.level === "late");
        const plan = planState(person);
        return <tr key={person.id}>
          <td><PersonLabel person={person} /></td>
          <td><div className="dashboard-row-status">
            {hasStarted ? <Badge status={person.status} /> : <span className="pill amber">{t("ก่อนเปิดรอบ")}</span>}
            {late && <span className="pill red">{dueText({ daysLeft: late.daysLeft, late: true })}</span>}
            {!isClosed && plan === "none" && <PlanStatus person={person} />}
          </div></td>
          <td><div className="table-progress"><div className="kpi-bar" aria-hidden="true"><span style={{ width: `${progress ?? 0}%` }} /></div>
            <span>{progress === null ? "—" : `${number(progress)}%`}</span></div>
            {signals(person, cycle, today).map(signal => <div key={signal.text} className={`dashboard-kpi-signal ${signal.tone}`}>
              <Icon name="flag" size={14} /><span>{signal.text}</span>
            </div>)}
          </td>
          <td>{last ? date(last) : <span className="subtle">{t("ยังไม่มีบันทึก")}</span>}</td>
          <td><div className="actions">
            {onReview && canReviewBehavior(person, cycle) && <Button variant="secondary" onClick={() => onReview(person)}>{reviewActionLabel(person)}</Button>}
            <Button variant="text" onClick={() => onOpen(person.id)}>{t("เปิด")} <span aria-hidden="true">›</span></Button>
          </div></td>
        </tr>;
      })}</tbody></table></div> : <p className="empty">{t("ไม่พบพนักงานตามเงื่อนไขที่เลือก")}</p>}
    </Panel>
    {hasStarted && <section className="panel dashboard-feedback">
      <Icon name="feedback" size={22} />
      <div><h2>{t("Feedback จากลูกทีม")}</h2><p className="subtle">{t("ตอบแล้ว {0} จาก {1} คน", feedback.count, people.length)} · {feedback.teamMean === null
        ? t("ค่าเฉลี่ยจะแสดงเมื่อมีผู้ตอบอย่างน้อย {0} คน", minimumResponses)
        : t("ค่าเฉลี่ย {0}", `${number(feedback.teamMean)} / 5`)}</p></div>
      {onFeedback && <Button variant="text" onClick={onFeedback}>{t("ดูรายละเอียด")} <span aria-hidden="true">›</span></Button>}
    </section>}
    {published.length > 0 && <AfterPublish people={published} onOpen={onOpen} />}
  </>;
}

export function AfterPublish({ people, onOpen }: { people: Person[]; onOpen: (id: string) => void }) {
  const groups = [
    { label: t("สูงกว่าความคาดหวัง"), tone: "green", match: (level: number) => level >= 4 },
    { label: t("ตามความคาดหวัง"), tone: "blue", match: (level: number) => level === 3 },
    { label: t("ต่ำกว่าความคาดหวัง"), tone: "amber", match: (level: number) => level <= 2 },
  ].map(group => ({ ...group, count: people.filter(person => person.decision?.level && group.match(person.decision.level)).length }));
  const unacknowledged = people.filter(person => !person.acknowledged);
  const followUps = people.filter(person => person.decision?.followUp)
    .sort((a, b) => (a.decision?.followUp ?? "").localeCompare(b.decision?.followUp ?? ""));
  return <Panel title={t("หลังเผยแพร่ผล")} description={t("เผยแพร่แล้ว {0} คน", people.length)}>
    <div className="after-grid">
      <div>
        <h3>{t("การกระจายผล")}</h3>
        <ul className="distribution">{groups.map(group => <li key={group.label}>
          <span>{group.label}</span>
          <div className="kpi-bar"><span className={`bar-${group.tone}`} style={{ width: `${group.count / people.length * 100}%` }} /></div>
          <strong>{group.count}</strong>
        </li>)}</ul>
      </div>
      <div>
        <h3>{t("ต้องติดตาม")}</h3>
        <ul className="dashboard-list compact">
          {unacknowledged.map(person => <li key={`ack-${person.id}`}><span>{person.name}</span><span className="pill amber">{t("ยังไม่รับทราบผล")}</span></li>)}
          {!unacknowledged.length && <li><span className="subtle">{t("ทุกคนรับทราบผลแล้ว")}</span></li>}
        </ul>
      </div>
      <div>
        <h3>{t("วันติดตามผลที่ใกล้มาถึง")}</h3>
        <ul className="dashboard-list compact">{followUps.slice(0, 5).map(person => <li key={person.id}>
          <button type="button" className="link-button" onClick={() => onOpen(person.id)}>{person.name}</button>
          <span className="subtle">{date(person.decision?.followUp)}</span>
        </li>)}{!followUps.length && <li><span className="subtle">{t("ยังไม่มีวันติดตามผล")}</span></li>}</ul>
      </div>
    </div>
  </Panel>;
}

import { t } from "../i18n";
import { useEffect, useRef } from "react";
import { states } from "../config";
import { cyclePhase, emptyFilters, filterPeople, hrTasks, ownerLabels, planReadiness, reviewNextStep, summarizeTeams,
  type CyclePhase, type HrFilters, type HrTaskKind, type ManagerSummary } from "../domain/hr-overview";
import { category, goalLevel, score } from "../domain/kpi";
import { managerForPerson } from "../domain/managers";
import { milestoneCounts, milestones } from "../domain/review-stages";
import { bangkokDay, employeeOverdue } from "../domain/submission";
import type { Cycle, ManagerId, Person, Team } from "../types";
import { date, daysBetween, showLevel } from "../utils/format";
import { PlanStatus } from "./goal-plan";
import { CycleStatus } from "./overview";
import { DueChip, TodoBoard, todoUrgency, type TodoItem } from "./todo-board";
import { Badge, Button, Heading, Panel, PersonLabel, Stat } from "./ui";

function ManagerWorkload({ summary, closed }: { summary: ManagerSummary; closed: boolean }) {
  if (closed) return <p className="subtle">{t("ยังไม่เผยแพร่ {0} คน", summary.members.filter(person => person.status !== "published").length)}</p>;
  const counts = [
    [t("รออนุมัติ"), summary.members.filter(person => person.status === "approval").length],
    [t("รอให้คะแนน"), summary.members.filter(person => person.status === "manager").length],
    [t("ส่งกลับให้ทบทวน"), summary.members.filter(person => person.status === "returned").length],
  ] as const;
  return <dl className="hr-manager-summary">
    {counts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    <div><dt>{t("ครบกำหนดถัดไป")}</dt><dd>{date(summary.nextDue)}</dd></div>
    <div><dt>{t("เลยกำหนด")}</dt><dd>{summary.late ? <span className="pill red">{summary.late}{" " + t("รายการ")}</span> : "0"}</dd></div>
  </dl>;
}

const taskMeta: Record<HrTaskKind, { label: string; hint: string }> = {
  appeal: { label: "ตอบคำขอตรวจสอบผล", hint: "พนักงานขอให้ตรวจผลที่เผยแพร่แล้ว" },
  plan: { label: "ตอบคำถามเรื่องแผน KPI", hint: "พนักงานถามเรื่องเป้าหมาย น้ำหนัก หรือเกณฑ์" },
  second: { label: "บันทึกความเห็นผู้ทบทวนคนที่สอง", hint: "คะแนนมีเงื่อนไขที่ต้องให้อีกคนตรวจก่อนยืนยันระดับ" },
  kpi: { label: "ตรวจข้อมูล KPI จากระบบงาน", hint: "ดึงข้อมูลใหม่ หรือส่งให้ Manager ตรวจสอบ" },
  decide: { label: "ทบทวนและยืนยันระดับสุดท้าย", hint: "เทียบหลักฐานกับคนในกลุ่มงานเดียวกันก่อนยืนยัน" },
  publish: { label: "พร้อมเผยแพร่ผล", hint: "ยืนยันระดับและผ่านการทบทวนครบแล้ว" },
};

const phaseSteps: { phase: CyclePhase; label: string }[] = [
  { phase: "plan", label: "วางแผนและส่งผลงาน" },
  { phase: "review", label: "Manager ประเมิน" },
  { phase: "decide", label: "HR ตัดสินและเผยแพร่" },
  { phase: "after", label: "หลังเผยแพร่" },
];

export function HrDashboard({ people, cycle, filters, onFilters, onOpen, onExport, onSetup, onBacklog, onRemind, onAppeals, onCalibration }: {
  people: Person[]; cycle: Cycle; filters: HrFilters;
  onFilters: (filters: HrFilters) => void; onOpen: (id: string) => void; onExport: (people: Person[]) => void;
  onSetup: () => void; onBacklog: () => void; onRemind: (managerId: ManagerId) => void;
  onAppeals: () => void; onCalibration: () => void;
}) {
  const hasStarted = cycle.status !== "draft";
  const closed = cycle.status === "closed";
  const today = bangkokDay(cycle.closedAt ? new Date(cycle.closedAt) : undefined);
  const teams = summarizeTeams(people, cycle, today);
  const tasks = teams.flatMap(team => team.tasks);
  const team = teams.find(summary => summary.team === filters.team);
  const manager = team?.managers.find(summary => summary.id === filters.managerId);
  const showManagers = hasStarted && filters.view === "managers" && !!team;
  const showPeople = hasStarted && filters.view === "people";
  const viewHeading = useRef<HTMLDivElement>(null);
  const focusAfterDrill = useRef(false);
  useEffect(() => {
    if (focusAfterDrill.current) {
      viewHeading.current?.focus();
      focusAfterDrill.current = false;
    }
  }, [filters.view, filters.team, filters.managerId]);
  const drill = (next: HrFilters) => {
    focusAfterDrill.current = true;
    onFilters(next);
  };
  const set = <Key extends keyof HrFilters>(key: Key, value: HrFilters[Key]) => onFilters({ ...filters, [key]: value });
  const filtered = showPeople ? filterPeople(people, filters, cycle, tasks, today) : [];
  const phase = cyclePhase(people, cycle, today);
  const isOpen = cycle.status === "open";
  const overview = !showPeople && !showManagers;
  const preHr = people.some(person => ["employee", "approval", "manager", "returned"].includes(person.status));
  const drillState = (state: string) => drill({ ...emptyFilters, view: "people", state });
  const due = phase === "plan" ? { label: t("กำหนดส่งผลงานพนักงาน"), date: cycle.employeeDue }
    : phase === "review" || (phase === "decide" && preHr) ? { label: t("กำหนด Manager ประเมิน"), date: cycle.managerDue } : undefined;
  const openTeam = (name: Team) => drill({ ...emptyFilters, view: "managers", team: name });
  const items: TodoItem[] = [];
  const unacknowledged = people.filter(person => person.status === "published" && !person.acknowledged);
  const segments = milestoneCounts(people);
  if (overview && hasStarted) {
    const addDrill = (state: string, members: Person[], title: string, urgency: TodoItem["urgency"], deadline?: string, detail?: string) => {
      if (members.length) items.push({
        id: state, title, urgency, detail, people: members, due: deadline,
        action: { label: t("ดูรายชื่อ"), onClick: () => drillState(state) },
      });
    };
    if (isOpen) {
      const lateManagers = teams.flatMap(team => team.managers).filter(manager => manager.late > 0);
      if (lateManagers.length) {
        const [first] = lateManagers;
        const single = lateManagers.length === 1;
        items.push({
          id: "manager-overdue", urgency: "late", title: t("งาน Manager เลยกำหนด"),
          detail: lateManagers.map(manager => t("{0} · {1} ค้าง {2} งาน", manager.team, manager.name, manager.late)).join(" · "),
          people: lateManagers.flatMap(manager => manager.tasks.filter(task => task.level === "late").map(task => task.person)),
          due: single ? first.tasks.find(task => task.level === "late")?.due : undefined,
          action: single ? { label: t("ส่งเตือน Manager"), onClick: () => onRemind(first.id) }
            : { label: t("ดูงานค้างของ Manager"), onClick: onBacklog },
        });
      }
      const employeeLate = people.filter(person => person.status === "employee" && employeeOverdue(person, cycle.employeeDue, today));
      const employeeDue = cycle.employeeDue || undefined;
      const urgency = todoUrgency(employeeDue, false, today);
      addDrill("employee-overdue", employeeLate, t("พนักงานเลยกำหนดส่ง {0} คน", employeeLate.length), "late", employeeDue);
      const readiness = planReadiness(people);
      if (phase === "plan") {
        const waiting = people.filter(person => person.status === "employee");
        addDrill("not-submitted", waiting, t("พนักงานยังไม่ส่งผลงาน {0} คน", waiting.length), urgency, employeeDue,
          t("ส่งแล้ว {0} จาก {1} คน", readiness.submitted.length, people.length));
      }
      addDrill("plan-none", readiness.none, t("ยังไม่มีแผน KPI · {0} คน", readiness.none.length), urgency, employeeDue, t("HR ต้องจัดแผน"));
      addDrill("kpi-incomplete", readiness.incomplete, t("ข้อมูล KPI ยังไม่ครบ · {0} คน", readiness.incomplete.length), urgency, employeeDue);
    }

    for (const { kind, people: members } of hrTasks(people, cycle)) {
      const meta = taskMeta[kind];
      const action = kind === "appeal" ? { label: t("ไปหน้าคำขอตรวจสอบผล"), onClick: onAppeals }
        : kind === "decide" || kind === "publish" ? { label: t("ไปหน้าทบทวนมาตรฐานคะแนน"), onClick: onCalibration }
          : { label: t("เริ่มจากคนแรก"), onClick: () => onOpen(members[0].id) };
      items.push({ id: kind, urgency: kind === "appeal" ? "soon" : "ready", title: t("{0} · {1} คน", t(meta.label), members.length),
        detail: t(meta.hint), people: members, action });
    }
    if (phase === "after") {
      addDrill("unacknowledged", unacknowledged, t("ยังไม่รับทราบผล {0} คน", unacknowledged.length), "ready");
    }
    const currentDay = bangkokDay();
    for (const person of people) {
      const followUp = person.decision?.followUp;
      if (!followUp || followUp < currentDay || todoUrgency(followUp, false, currentDay) !== "soon") continue;
      items.push({ id: `follow-up-${person.id}`, urgency: "soon", title: t("ติดตามผล {0}", person.name), people: [person], due: followUp,
        action: { label: t("เปิดรายการ"), onClick: () => onOpen(person.id) } });
    }
  }

  const phaseLabel = phaseSteps.find(step => step.phase === phase)?.label;
  const description = overview && hasStarted
    ? ["HR", t(cycle.name), t(closed ? "ปิดรอบแล้ว" : "เปิดรอบแล้ว"), phaseLabel && t(phaseLabel)].filter(Boolean).join(" · ")
    : `HR · ${t(cycle.name)}`;
  const stageNotes = [
    t("กำหนดส่ง {0}", date(cycle.employeeDue)), t("กำหนดส่ง {0}", date(cycle.managerDue)), t("ทบทวน · ตัดสิน"),
    unacknowledged.length ? t("{0} คนยังไม่รับทราบผล", unacknowledged.length) : t("รับทราบครบแล้ว"),
  ];


  return <>
    <div className="dashboard-heading" ref={viewHeading} tabIndex={-1}>
      {(showPeople || showManagers) && <nav className="hr-path" aria-label={t("เส้นทางข้อมูล HR")}>
        <button type="button" onClick={() => drill(emptyFilters)}>{t("ทุกทีม")}</button>
        <span aria-hidden="true">›</span>
        {showPeople && team ? <button type="button" onClick={() => openTeam(team.team)}>{team.team}</button>
          : <span aria-current="page">{team?.team ?? t("พนักงานทุกทีม")}</span>}
        {showPeople && team && <><span aria-hidden="true">›</span><span aria-current="page">{manager?.name ?? t("พนักงานทั้งหมด")}</span></>}
      </nav>}
      <Heading title={showManagers ? t("Manager แผนก {0}", team.team) : showPeople
        ? (manager ? t("ลูกทีมของ {0}", manager.name) : team ? t("พนักงานทีม {0}", team.team) : t("พนักงานทุกทีม")) : t("ภาพรวมการประเมินผลงาน")}
        description={description}
        actions={overview && isOpen ? (due?.date && <DueChip label={due.label} due={due.date} today={today} />)
          : !overview || !hasStarted ? <div className="actions"><CycleStatus status={cycle.status} /></div> : undefined} />
    </div>

    {!hasStarted && <div className="stats">
      <Stat label={t("พนักงานที่เตรียมเข้ารอบ")}>{people.length}</Stat>
      <Stat label={t("ทีมที่เตรียมเข้ารอบ")}>{cycle.teams.length}</Stat>
    </div>}

    {!hasStarted ? <Panel title={t("รอบประเมินยังเป็นฉบับร่าง")} actions={<Button onClick={onSetup}>{t("เตรียมเปิดรอบประเมิน")}</Button>}>
      <p>{t("เลือกทีม ตรวจผู้ประเมิน และกำหนดวันส่งก่อนเปิดรอบ พนักงานดู KPI และผลจากระบบได้แล้ว")}</p>
    </Panel> : showManagers ? <Panel title={t("Manager ในแผนก")} description={t("เลือก Manager เพื่อดูเฉพาะพนักงานที่รับผิดชอบ")}
      actions={<Button variant="secondary" onClick={() => drill({ ...emptyFilters, view: "people", team: team.team })}>{t("ดูพนักงานทั้งแผนก")}</Button>}>
      <ul className="hr-team-grid">{team.managers.map(group => <li key={group.id}>
        <article className="hr-manager-card">
          <div className="actions"><h3>{group.name}</h3><span className="pill">{group.members.length}{" " + t("คน")}</span></div>
          <span className="subtle">{group.title}</span>
          <ManagerWorkload summary={group} closed={closed} />
          <Button onClick={() => drill({ ...emptyFilters, view: "people", team: team.team, managerId: group.id })}>{t("ดูลูกทีม")}</Button>
        </article>
      </li>)}</ul>
    </Panel> : !showPeople ? <>
      <TodoBoard items={items} summary={t("{0} งาน · {1} เลยกำหนด", items.length, items.filter(item => item.urgency === "late").length)}
        empty={t("ไม่มีงานรอ HR ตอนนี้")} />
      <Panel title={t("ความคืบหน้ารอบประเมิน")}
        actions={<Button variant="text" onClick={() => drill({ ...emptyFilters, view: "people" })}>{t("ดูพนักงานทั้งหมด")} <span aria-hidden="true">›</span></Button>}>
        <div className="cycle-track" aria-hidden="true">
          {segments.filter(segment => segment.count > 0).map(segment =>
            <span key={segment.filter} className={`phase-${segment.tone}`} style={{ flexGrow: segment.count }} />)}
        </div>
        <div className="hr-stage-grid">{segments.map((segment, index) =>
          <button key={segment.filter} type="button" onClick={() => drillState(segment.filter)}>
            <span><span className={`phase-dot phase-${segment.tone}`} aria-hidden="true" />{t(segment.label)}</span>
            <span><strong>{segment.count}</strong> {t("คน")}</span>
            <span className="subtle">{stageNotes[index]}</span>
          </button>)}</div>
      </Panel>
      <Panel title={t("ความคืบหน้ารายทีม")}>
        <div className="scroll"><table className="dashboard-team-table">
          <thead><tr>
            <th scope="col">{t("ทีม")}</th><th scope="col">{t("เผยแพร่แล้ว")}</th>
            {!closed && <><th scope="col">{t("งาน Manager ค้าง")}</th><th scope="col">{t("เลยกำหนด")}</th><th scope="col">{t("รอ HR")}</th></>}
            <th scope="col"><span className="sr-only">{t("รายละเอียด")}</span></th>
          </tr></thead>
          <tbody>{teams.map(group => <tr key={group.team}>
            <td><strong>{group.team}</strong><div className="subtle">{t("{0} คน · Manager {1} คน", group.members.length, group.managers.length)}</div></td>
            <td><div className="table-progress">
              <div className="kpi-bar" aria-hidden="true"><span style={{ width: `${group.members.length ? group.published / group.members.length * 100 : 0}%` }} /></div>
              <span>{group.published} / {group.members.length}</span>
            </div></td>
            {!closed && <><td>{group.tasks.length}</td><td>{group.late ? <strong className="dashboard-late">{group.late}</strong> : 0}</td><td>{group.hrPending}</td></>}
            <td><Button variant="text" onClick={() => openTeam(group.team)}>{t("ดูทีม")} <span aria-hidden="true">›</span></Button></td>
          </tr>)}</tbody>
        </table></div>
      </Panel>
    </> : <>
      {manager && <Panel title={manager.name} description={t("{0} · ลูกทีม {1} คน", manager.title, manager.members.length)}
        actions={manager.tasks.length > 0 && <Button variant="secondary" onClick={() => onRemind(manager.id)}>{t("บันทึกการเตือน")}</Button>}>
        <ManagerWorkload summary={manager} closed={closed} />
      </Panel>}
      <Panel title={t("รายการประเมิน")} description={t("แสดง {0} จาก {1} คน", filtered.length, manager?.members.length ?? team?.members.length ?? people.length)}
        actions={<Button variant="secondary" onClick={() => onExport(filtered)}>{t("ส่งออก CSV")}</Button>}>
        <div className="toolbar">
          <input type="search" aria-label={t("ค้นหาพนักงาน")} placeholder={t("ค้นหาชื่อหรือรหัสพนักงาน")} value={filters.query} onChange={event => set("query", event.target.value)} />
          <select aria-label={t("กรองทีม")} value={filters.team} onChange={event => {
            const name = event.target.value as Team | "";
            if (name) openTeam(name);
            else drill({ ...emptyFilters, view: "people" });
          }}>
            <option value="">{t("ทุกทีม")}</option>{cycle.teams.map(name => <option key={name}>{name}</option>)}
          </select>
          <select aria-label={t("กรองสถานะ")} value={filters.state} onChange={event => set("state", event.target.value)}>
            <option value="">{t("ทุกสถานะ")}</option>{Object.entries(states).map(([value, [label]]) => <option key={value} value={value}>{t(label)}</option>)}
            <optgroup label={t("ขั้นตอน")}>{milestones.map(stage =>
              <option value={stage.filter} key={stage.filter}>{t(stage.label)}</option>)}</optgroup>
            <option value="unacknowledged">{t("ยังไม่รับทราบผล")}</option>
            {!closed && <option value="overdue">{t("มีงาน Manager เลยกำหนด")}</option>}
            {isOpen && <optgroup label={t("ความพร้อม")}>
              <option value="plan-none">{t("ยังไม่มีแผน KPI")}</option>
              <option value="kpi-incomplete">{t("ข้อมูล KPI ยังไม่ครบ")}</option>
              <option value="not-submitted">{t("ยังไม่ส่งผลงาน")}</option>
            </optgroup>}
            <option value="employee-overdue">{t("พนักงานเลยกำหนดส่ง")}</option>
          </select>
          <select aria-label={t("กรองผลเผยแพร่")} value={filters.result} onChange={event => set("result", event.target.value)}>
            <option value="">{t("ทุกระดับผลงาน")}</option>{[4, 3, 2].map(level => <option key={level} value={category(level)}>{t(category(level))}</option>)}
          </select>
        </div>
        {filtered.length ? <div className="scroll"><table className="hr-people-table"><thead><tr>
          <th scope="col">{t("พนักงาน")}</th>{!manager && <th scope="col">{t("Manager / ตำแหน่ง")}</th>}
          <th scope="col">{t("แผน KPI / ข้อมูลครบ")}</th><th scope="col">{t("สถานะ")}</th><th scope="col">{t("ใครต้องทำต่อ")}</th>
          <th scope="col">{t("ผลลัพธ์งาน / ผลเผยแพร่")}</th><th scope="col">{t("รายละเอียด")}</th>
        </tr></thead><tbody>{filtered.map(person => {
          const next = reviewNextStep(person, cycle);
          const complete = person.goals.filter(goal => goalLevel(goal) !== null).length;
          const reviewer = managerForPerson(cycle, person);
          const late = next.owner === "manager" ? !!next.due && today > next.due
            : next.owner === "employee" && !!next.due && employeeOverdue(person, cycle.employeeDue, today);
          return <tr key={person.id}>
            <td><PersonLabel person={person} /></td>
            {!manager && <td>{reviewer.name}<div className="subtle">{reviewer.title}</div></td>}
            <td><PlanStatus person={person} />
              <div className="subtle">{complete} / {person.goals.length} KPI</div></td>
            <td><Badge status={person.status} /></td>
            <td className="hr-next-step">
              {next.owner && <strong>{ownerLabels[next.owner]}{next.owner === "manager" ? ` · ${reviewer.name}` : ""}</strong>}
              <div>{next.task}</div>
              {next.due && <span className={late ? "pill red" : "subtle"}>{late ? t("เลยกำหนด · ") : t("กำหนด ")}{date(next.due)}</span>}
            </td>
            <td><strong>{showLevel(score(person))}</strong>
              {person.status === "published" && person.decision?.level && <div className="subtle">{t(category(person.decision.level))}</div>}</td>
            <td><Button variant="text" onClick={() => onOpen(person.id)}>{t("เปิดรายการ")}</Button></td>
          </tr>;
        })}</tbody></table></div> : <p className="empty">{t("ไม่พบพนักงานตามเงื่อนไขที่เลือก")}</p>}
      </Panel>
    </>}
  </>;
}

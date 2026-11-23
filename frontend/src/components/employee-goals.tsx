import { t } from "../i18n";
import { goalCutoffs } from "../domain/goal-plan";
import { goalLevel, goalProgress } from "../domain/kpi";
import { isSystemResult, usesWorkRecords } from "../domain/work-sync";
import { workSourceFor } from "../services/work-source";
import type { Goal, Person } from "../types";
import { date, number } from "../utils/format";
import type { PersonAction } from "./person";
import { Button, Icon, Panel } from "./ui";
import { WorkDelivery } from "./work-delivery";

type OnAction = (action: PersonAction, index?: number) => void;

const evidenceId = (index: number) => `kpi-evidence-${index}`;
const amount = (value: number, unit: string) => unit === "%" ? `${number(value)}%` : `${number(value)} ${t(unit)}`;

export function KpiStatusBox({ person, lateDue, onAction }: { person: Person; lateDue?: string; onAction: OnAction }) {
  const waiting = person.goals.map((goal, index) => ({ goal, index })).filter(({ goal }) => goalLevel(goal) === null);
  const measured = person.goals.length - waiting.length;
  const ready = !waiting.length;
  const guidance = ready ? t("ข้อมูลครบแล้ว เขียนสรุปและส่งให้ Manager อนุมัติได้")
    : waiting.length === 1 ? t("รอข้อมูลจากระบบงานสำหรับ “{0}”", t(waiting[0].goal.name))
    : t("รอข้อมูลจากระบบงาน {0} KPI", waiting.length);
  const title = t("ข้อมูลครบ {0} จาก {1} KPI", measured, person.goals.length);
  return <section className="kpi-status-box">
    <div className="kpi-status-track">
      <h2>{title}</h2>
      <div className="kpi-blocks" role="img" aria-label={title}>
        {person.goals.map((_, index) => <span key={index} className={index < measured ? "kpi-block done" : "kpi-block"} />)}
      </div>
      <p>{guidance}</p>
      {!ready && <p className="subtle">{t("ถ้ามีงานตกหล่นหรือถูกนับผิดคน แจ้งหัวหน้าให้ตรวจสอบได้")}</p>}
      {lateDue && <p className="form-tip">{t("เลยกำหนดส่ง") + " "}{date(lateDue)}{" " + t("คุณยังส่งผลงานได้")}</p>}
      {person.returnReason && <p className="form-tip">{person.returnReason}</p>}
    </div>
    <div className="actions">
      {!ready && <>
        <a className="kpi-status-link" href={`#${evidenceId(waiting[0].index)}`}>{t("ดูหลักฐาน")}</a>
        <Button variant="secondary" onClick={() => onAction("report-kpi", waiting[0].index)}>{t("แจ้งข้อมูลตกหล่น")}</Button>
      </>}
      {ready
        ? <Button onClick={() => onAction("submit")}>{person.submission?.decision === "declined" ? t("ส่งสรุปให้ Manager อีกครั้ง") : t("ส่งสรุปให้ Manager อนุมัติ")}</Button>
        : <Button variant="secondary" disabled title={t("รอข้อมูลจากระบบงาน")}>{t("ส่งผลงานให้ Manager")}</Button>}
    </div>
  </section>;
}

function GoalIssues({ person, goal }: { person: Person; goal: Goal }) {
  const issues = person.kpiIssues?.filter(issue => issue.goalName === goal.name) ?? [];
  if (!issues.length) return null;
  return <div className="stack">{issues.map((issue, index) => <article className="item" key={index}>
    <h3>{t(issue.goalName)} · {date(issue.reportedOn)}</h3><p>{issue.detail}</p>
    {issue.response ? <p className="feedback">{t("ผลตรวจสอบ")} · {date(issue.reviewedOn)} · {issue.response}</p>
      : <div className="actions"><span className="pill amber">{t("รอหัวหน้าตรวจสอบ")}</span></div>}
  </article>)}</div>;
}

function GoalProgress({ goal, emptyLabel }: { goal: Goal; emptyLabel: string }) {
  const target = amount(goal.target, goal.unit);
  if (goal.unmeasured || !Number.isFinite(goal.actual)) return <div className="kpi-progress">
    <div className="kpi-bar-empty" aria-hidden="true" />
    <span className="subtle">{t("{0} / เป้า {1}", emptyLabel, target)}</span>
  </div>;
  const progress = goalProgress(goal);
  return <div className="kpi-progress">
    <div className="kpi-bar" role="progressbar" aria-label={t("ความคืบหน้า {0}", t(goal.name))}
      aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><span style={{ width: `${progress}%` }} /></div>
    <span className="subtle">{t("{0} / เป้า {1} · {2}%", amount(goal.actual, goal.unit), target, number(progress))}</span>
  </div>;
}

function GoalEvidence({ goal, id, emptyLabel, footer }: { goal: Goal; id: string; emptyLabel: string; footer: React.ReactNode }) {
  const complete = goalLevel(goal) !== null;
  return <div className="kpi-evidence" id={id} tabIndex={-1}>
    <div className="kpi-evidence-head">
      <div><strong>{isSystemResult(goal) ? t("หลักฐานจากระบบงานจำลอง") : t("หลักฐานที่บันทึกไว้")}</strong>
        {goal.period && <div className="subtle">{t("ช่วงที่วัด ·") + " "}{goal.period}</div>}</div>
    </div>
    {!complete ? <p className="subtle">{emptyLabel}</p>
      : isSystemResult(goal) ? <p>{t("ระบบบันทึกผล {0} จากข้อมูลช่วงนี้", amount(goal.actual, goal.unit))}</p>
      : <p className="feedback">{t(goal.evidence ?? "")}</p>}
    {footer && <div className="kpi-evidence-footer">{footer}</div>}
  </div>;
}

export function EmployeeKpiPanel({ person, closed, canReport, onAction }: {
  person: Person; closed: boolean; canReport: boolean; onAction: OnAction;
}) {
  const emptyLabel = closed ? t("ไม่มีข้อมูลในรอบนี้") : t("รอข้อมูลจากระบบงาน");
  return <Panel title={t("KPI ของฉัน")} description={t("{0} ตัว", person.goals.length)}>
    <div className="kpi-list">{person.goals.map((goal, index) => {
      const workRecords = usesWorkRecords(goal);
      const complete = goalLevel(goal) !== null;
      const reportRow = (question: string) => canReport && <>
        <span className="subtle">{question}</span>
        <Button variant="secondary" onClick={() => onAction("report-kpi", index)}><Icon name="flag" size={15} />{t("แจ้งข้อมูลคลาดเคลื่อน")}</Button>
      </>;
      return <article className="kpi-card" key={`${person.id}-${index}`}>
        <div className="kpi-heading">
          <div className="kpi-name"><h3>{t(goal.name)}</h3>{isSystemResult(goal) && <span className="pill blue">{t("จากระบบงานจำลอง")}</span>}</div>
          <span className={`pill ${complete ? "green" : "amber"}`}>{complete ? t("ข้อมูลครบ") : emptyLabel}</span>
        </div>
        {goal.responsibility && <p className="subtle">{t(goal.responsibility)}</p>}
        <div className="detail-data">
          <span>{t("น้ำหนัก") + " "}{goal.weight}%</span>
          <span>{goal.direction === "lower" ? t("ยิ่งต่ำยิ่งดี") : t("ยิ่งสูงยิ่งดี")}</span>
          {!workRecords && <span>{t("เกณฑ์ระดับ 2–5 · {0}", `${goalCutoffs(goal).map(number).join(" → ")} ${t(goal.unit)}`)}</span>}
        </div>
        <GoalProgress goal={goal} emptyLabel={emptyLabel} />
        {workRecords
          ? <WorkDelivery embedded id={evidenceId(index)} source={workSourceFor(person.id) ?? goal.workSource}
            linked={!!goal.workSource && !goal.unmeasured}
            recordedRate={goal.unmeasured ? undefined : goal.actual}
            footer={reportRow(t("พบงานตกหล่น หรือมีงานที่ถูกนับผิดคน?"))} />
          : <GoalEvidence goal={goal} id={evidenceId(index)} emptyLabel={emptyLabel} footer={reportRow(t("ผลนี้ไม่ตรงกับงานจริง?"))} />}
        <GoalIssues person={person} goal={goal} />
      </article>;
    })}</div>
  </Panel>;
}

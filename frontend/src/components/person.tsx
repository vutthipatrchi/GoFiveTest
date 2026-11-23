import { formatLocale, t } from "../i18n";
import { demoDate, rubric, states } from "../config";
import { needsGoalAssignment } from "../domain/goal-plan";
import { canReviewBehavior, category, goalLevel, overdue, proposal, reviewActionLabel, reviewReadyToSend, score } from "../domain/kpi";
import { awaitingSecondReview, hasCurrentSecondReview, secondReviewReasons } from "../domain/manager-feedback";
import { managerForPerson } from "../domain/managers";
import { approvalOverdue, bangkokDay, employeeOverdue } from "../domain/submission";
import { deliveryGoal } from "../domain/work";
import { isSystemResult, refreshMissingResults, usesWorkRecords } from "../domain/work-sync";
import { workSourceFor } from "../services/work-source";
import type { Cycle, Person, Role } from "../types";
import { date, showLevel } from "../utils/format";
import { GoalChart } from "./person-charts";
import { GoalTimeline } from "./tracking";
import { WorkDelivery } from "./work-delivery";
import { CalibrationHistory } from "./performance-results";
import { GoalPlanPanel, type GoalPlanAction } from "./goal-plan";
import { EmployeeKpiPanel, KpiStatusBox } from "./employee-goals";
import { DueChip } from "./todo-board";
import { Badge, Button, Heading, Panel, Stat } from "./ui";
import { CycleStatus } from "./overview";
import type { AppealAction } from "./appeal-actions";
import { AppealPanel } from "./appeals";

export type PersonAction = GoalPlanAction | AppealAction | "refresh-kpi" | "report-kpi" | "review-kpi" | "submit" | "approve" | "decline" | "review" | "return" | "second-review" | "decide" |
  "publish" | "acknowledge" | "remind" | "extend";

/** Employees see the result band and reasons. Numeric levels stay with managers and HR. */
export function ResultCard({ person, showLevel: showNumericLevel = true }: { person: Person; showLevel?: boolean }) {
  const result = person.decision;
  if (!result?.level) return result
    ? <><p className="feedback">{result.reason}</p><p className="muted">{t("ผลจากรอบเดิม ·") + " "}{result.kpi} · {result.fit}</p></>
    : <p className="empty">{t("ยังไม่มีผลที่ยืนยัน")}</p>;
  const tone = result.level >= 4 ? "green" : result.level <= 2 ? "amber" : "blue";
  const nextLabel = result.level >= 4 ? t("โอกาสต่อยอด") : result.level <= 2 ? t("การสนับสนุนและแผนพัฒนา") : t("ข้อเสนอแนะสำหรับรอบถัดไป");
  return <article className="item result-card">
    <span className={`pill ${tone}`}>{t(category(result.level))}</span>
    {showNumericLevel && <h3>{result.level} / 5 · {t(rubric[result.level - 1])}</h3>}
    <p className="feedback"><strong>{result.level <= 2 ? t("ช่องว่างและหลักฐาน") : t("เหตุผลและหลักฐาน")}</strong> · {result.reason}</p>
    <p className="feedback"><strong>{nextLabel}</strong> · {result.next}</p>
    {result.followUp && <p className="subtle">{t("ติดตามผล") + " "}{date(result.followUp)}</p>}
  </article>;
}

export function PersonDetails({ person, cycle, role, onBack, onAction }: {
  person: Person; cycle: Cycle; role: Role; onBack: () => void; onAction: (action: PersonAction, index?: number) => void;
}) {
  const readOnly = cycle.status === "closed";
  const isEmployee = role === "employee";
  const isManager = role === "manager";
  const editable = !readOnly && role === "employee" && person.status === "employee";
  const published = person.status === "published";
  const canSeeProposal = role !== "employee" || published;
  const canSeeScores = role !== "employee";
  const measuredGoals = person.goals.filter(goal => goalLevel(goal) !== null).length;
  const canReview = isManager && canReviewBehavior(person, cycle);
  const pending = !readOnly && role === "hr" && ["hr", "decided"].includes(person.status);
  const secondReasons = pending ? secondReviewReasons(person, cycle) : [];
  const needsSecond = pending && awaitingSecondReview(person, cycle);
  const readyToPublish = hasCurrentSecondReview(person, cycle);
  const proposed = proposal(person, cycle.resultWeight);
  const results = score(person);
  const late = overdue(person);
  const pendingApproval = person.status === "approval";
  const canDecideSubmission = !readOnly && isManager && pendingApproval;
  const submission = person.submission;
  const asOf = cycle.closedAt ? new Date(cycle.closedAt) : undefined;
  const today = bangkokDay(asOf);
  const lateApproval = approvalOverdue(person, today);
  const lateEmployee = employeeOverdue(person, cycle.employeeDue, today);
  const review = (isManager && person.reviewDraft) || person.review;
  const reviewer = managerForPerson(cycle, person).name;
  const managerStatus = person.status === "employee" ? t("รอพนักงานส่งผลงาน")
    : canReview && person.status === "manager" ? t("รอคุณประเมิน") : t(states[person.status][0]);
  const workResult = person.status !== "employee" && results !== null
    ? t("ผลลัพธ์งาน {0}", showLevel(results))
    : person.goals.length ? t("KPI ข้อมูลครบ {0} จาก {1} ข้อ", measuredGoals, person.goals.length)
    : t("ยังไม่มีแผน KPI");
  const waitingForPlan = editable && needsGoalAssignment(person);
  const missingPlan = waitingForPlan && <Panel title={t("รอ HR จัดแผน KPI")}>
    <p className="muted">{t("เมื่อ HR ส่งแผน KPI ผลงานจากระบบจะแสดงที่หน้านี้")}</p>
    <p className="subtle">{t("ผู้ประเมิน ·") + " "}{reviewer}</p>
  </Panel>;
  const deliveryKpi = person.goals.find(deliveryGoal);
  const linkedSource = deliveryKpi?.workSource;
  // The demo shows one work record per person in every round. Saved KPI results and decisions stay untouched.
  const source = workSourceFor(person.id) ?? linkedSource;
  // Employees see the evidence inside each system KPI, so the separate panel stays only when no KPI uses it.
  const work = source && (!isEmployee || !person.goals.some(usesWorkRecords)) && <WorkDelivery source={source} linked={!!linkedSource}
    recordedRate={deliveryKpi && !deliveryKpi.unmeasured ? deliveryKpi.actual : undefined} />;
  const goalPlan = <GoalPlanPanel person={person} cycle={cycle} role={role} onAction={onAction} readOnly={readOnly}
    reviewer={isEmployee && person.goals.length > 0 ? reviewer : undefined} />;
  const goals = person.goals.length > 0 && (isEmployee ? <EmployeeKpiPanel person={person} closed={readOnly}
    canReport={editable && cycle.status === "open"} onAction={onAction} /> : <Panel title={t("เป้าหมายและหลักฐาน")} description={t("กดส่วนของวงกลมหรือชื่อรายการเพื่อดูเกณฑ์และหลักฐาน")}>
    <div className="stack">{person.goals.map((goal, index) => <article className="item" key={`${person.id}-${index}`}>
      <div className="kpi-heading">
        <h3>{t(goal.name)}</h3>
        {isSystemResult(goal) && <span className="pill blue">{t("จากระบบงานจำลอง")}</span>}
      </div>
      {goal.responsibility && <p className="subtle">{t(goal.responsibility)}</p>}
      <div className="detail-data"><span>{t("น้ำหนัก") + " "}{goal.weight}%</span><span>{goal.direction === "lower" ? t("ยิ่งต่ำยิ่งดี") : t("ยิ่งสูงยิ่งดี")}</span>{canSeeScores && <span>{showLevel(goalLevel(goal))}</span>}</div>
      <GoalChart goal={goal} />
    </article>)}</div>
  </Panel>);
  // Employees read each report under its KPI. Reports for a KPI no longer in the plan stay in the list.
  const listedIssues = (person.kpiIssues ?? []).map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => !isEmployee || !person.goals.some(goal => goal.name === issue.goalName));
  const kpiColumn = isEmployee ? <>{goals}{work}</> : <>{work}{goals}</>;
  if (cycle.status === "draft") return <>
    <Heading title={person.name} description={`${person.id} · ${person.team} · ${person.title}`}
      actions={role === "employee" ? <span className="pill amber">{t("ก่อนเปิดรอบประเมิน")}</span> : <Button variant="secondary" onClick={onBack}>{t("กลับไปรายการ")}</Button>} />
    {missingPlan}
    {editable && person.goals.length > 0 && <p className="form-tip">{t("ตรวจ KPI และผลจากระบบได้ตลอด กดส่งผลงานให้ Manager ได้เมื่อ HR เปิดรอบ")}</p>}
    {goalPlan}
    <div className="split"><div>{kpiColumn}</div><div><GoalTimeline person={person} /></div></div>
  </>;
  return <>
    <Heading title={isEmployee ? t("KPI และผลงานของฉัน") : person.name}
      description={isEmployee ? `${person.name} · ${person.id} · ${person.title}` : `${person.id} · ${person.team} · ${person.title}`}
      actions={<div className="actions">
        {readOnly ? <CycleStatus status="closed" /> : isEmployee &&
          (editable && cycle.employeeDue ? <DueChip label={t("กำหนดส่งผลงาน")} due={cycle.employeeDue} today={today} /> : <Badge status={person.status} />)}
        {!isEmployee && <Button variant="secondary" onClick={onBack}>{t("กลับไปรายการ")}</Button>}
      </div>} />
    {editable && !waitingForPlan && person.goals.length > 0 &&
      <KpiStatusBox person={person} lateDue={!submission && lateEmployee ? cycle.employeeDue : undefined} onAction={onAction} />}
    {isManager ? <div className="manager-review-status">
      <p className="subtle"><strong>{managerStatus}</strong> · {workResult}
        {proposed && person.status !== "returned" && <> · {t("คะแนนรวมที่เสนอ {0}", `${proposed.overall.toFixed(2)} / 5`)}</>}
      </p>
      {canDecideSubmission && submission && <a className="btn" href="#submission-summary">{t("ตรวจสรุปผลงาน")}</a>}
      {canReview && <Button variant={reviewReadyToSend(person) ? "" : "secondary"} onClick={() => onAction("review")}>{reviewActionLabel(person)}</Button>}
    </div> : !isEmployee && <>
      <div className="stats">
        <Stat label={t("KPI ในรอบ")}>{person.goals.length}</Stat>
        <Stat label={t("ผลลัพธ์งาน")}>{showLevel(results)}</Stat>
        <Stat label={t("คะแนนรวมที่เสนอ")}>{proposed ? `${proposed.overall.toFixed(2)} / 5` : showLevel(null)}</Stat>
      </div>
      <p className="subtle">{t("ผู้ประเมิน ·") + " "}{reviewer}</p>
    </>}
    {submission && <Panel id={isManager ? "submission-summary" : undefined} title={t("สถานะสรุปผลงานปลายรอบ")} actions={canDecideSubmission && <div className="actions">
      <Button variant="secondary" onClick={() => onAction("decline")}>{t("ส่งกลับให้แก้ไข")}</Button>
      <Button onClick={() => onAction("approve")}>{t("อนุมัติสรุปผลงาน")}</Button>
    </div>}>
      <p>{t("พนักงานส่งวันที่") + " "}{date(submission.submittedOn)}{" " + t("· กำหนดอนุมัติ") + " "}{date(submission.approvalDue)}</p>
      <div className="actions">
        <span className={`pill ${lateEmployee ? "red" : "green"}`}>
          {lateEmployee ? (submission.decision === "declined" ? t("สรุปผลงานที่ส่งกลับเลยกำหนดแล้ว") : t("พนักงานส่งเลยกำหนด")) : t("พนักงานส่งทันกำหนด")}
        </span>
        {pendingApproval && <span className={`pill ${lateApproval ? "red" : "amber"}`}>
          {lateApproval ? t("Manager อนุมัติสรุปผลงานเลยกำหนด") : t("รอ Manager อนุมัติสรุปผลงาน")}
        </span>}
        {submission.decidedOn && <span className={`pill ${submission.decision === "approved" ? "green" : "amber"}`}>
          {submission.decision === "approved" ? t("อนุมัติแล้ว") : t("ส่งกลับให้แก้ไข")} · {date(submission.decidedOn)}
        </span>}
        {!readOnly && lateApproval && role === "hr" && <Button variant="text" onClick={() => onAction("remind")}>{t("บันทึกการเตือน")}</Button>}
      </div>
      {isManager && person.summary && <div className="submission-summary">
        <h3>{t("สรุปผลงานจากพนักงาน")}</h3><p className="feedback">{person.summary}</p>
      </div>}
      {lateApproval && role === "manager" && person.reminded && <p className="form-tip">{t("HR เตือนให้ตรวจสรุปผลงานปลายรอบ (จำลอง)")}</p>}
      {submission.reason && <p className="feedback">{submission.reason}</p>}
    </Panel>}
    {late && person.reminded && role === "manager" && <p className="form-tip">{t("HR ส่งการเตือนให้ดำเนินการประเมิน (จำลอง)")}</p>}
    {!readOnly && late && role !== "employee" && <Panel title={t("งานประเมินเลยกำหนด")} actions={role === "hr" && <div className="actions">
      <Button variant="secondary" onClick={() => onAction("remind")}>{t("บันทึกการเตือน")}</Button>
      <Button onClick={() => onAction("extend")}>{t("ขยายเวลา")}</Button>
    </div>}><p>{t("กำหนดส่ง") + " "}{date(person.due)}{" " + t("· เลยกำหนด") + " "}{(Date.parse(demoDate) - Date.parse(person.due)) / 86400000}{" " + t("วัน")}</p></Panel>}
    {!isEmployee && goalPlan}
    {missingPlan}
    {listedIssues.length > 0 && <Panel title={t("รายการแจ้งข้อมูลคลาดเคลื่อน")}>
      {listedIssues.map(({ issue, index }) => <article className="item" key={index}>
        <h3>{t(issue.goalName)} · {date(issue.reportedOn)}</h3><p>{issue.detail}</p>
        {issue.response ? <p className="feedback">{t("ผลตรวจสอบ")} · {date(issue.reviewedOn)} · {issue.response}</p>
          : <div className="actions"><span className="pill amber">{t("รอหัวหน้าตรวจสอบ")}</span>
            {!readOnly && role === "manager" && <Button onClick={() => onAction("review-kpi", index)}>{t("บันทึกผลตรวจสอบ")}</Button>}
          </div>}
      </article>)}
    </Panel>}
    {person.summary && (!isManager || !submission) && <Panel title={t("สรุปผลงานจากพนักงาน")}><p className="feedback">{person.summary}</p></Panel>}
    <div className="split">
      <div>{kpiColumn}</div>
      <div>
        {isEmployee && goalPlan}
        <GoalTimeline person={person} />
        <Panel title={canSeeScores ? t("ผลที่ Manager เสนอ") : t("ความเห็นจาก Manager")}>
          {person.returnReason && role !== "employee" && <p className="form-tip">{t("HR ส่งกลับให้ทบทวน ·") + " "}{person.returnReason}</p>}
          {review && canSeeProposal ? <div className="item">
            {isManager && person.reviewDraft && <span className="pill amber">{t("ยังไม่ส่ง HR")}</span>}
            {canSeeScores && <h3>{review.rating} / 5 · {t(rubric[review.rating - 1])}</h3>}<p className="feedback">{review.feedback}</p>
            <p><strong>{t("พัฒนาต่อ")}</strong> {review.next || t("ยังไม่มีข้อเสนอ")}</p>
          </div> : !person.returnReason && <p className="empty">{role === "employee"
            ? (readOnly ? t("รอบนี้ปิดแล้วและยังไม่มีผลเผยแพร่") : t("ผลประเมินจะแสดงเมื่อ HR เผยแพร่"))
            : t("ยังไม่มีผลประเมินจาก Manager")}</p>}
        </Panel>
        {role === "hr" && (secondReasons.length > 0 || person.secondReview || (pending && person.review)) &&
          <Panel title={t("ทบทวนคะแนนพฤติกรรมครั้งที่สอง")} actions={pending && person.review &&
            <Button variant="secondary" onClick={() => onAction("second-review")}>{person.secondReview ? t("แก้ไขความเห็น") : t("บันทึกความเห็นผู้ทบทวน")}</Button>}>
            {secondReasons.length > 0 && <ul className="audit">{secondReasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
            {person.secondReview ? <div className="item">
              <h3>{person.secondReview.reviewer} · {showLevel(person.secondReview.rating)}</h3>
              <p className="feedback">{person.secondReview.evidence}</p>
            </div> : <p className="empty">{needsSecond ? t("ต้องมีความเห็นผู้ทบทวนคนที่สองก่อนยืนยันระดับ") : t("ยังไม่มีความเห็นผู้ทบทวนคนที่สอง")}</p>}
          </Panel>}
        {canSeeProposal && <Panel title={t("ผลประเมินและแผนพัฒนา")} actions={published && <Badge status="published" />}>
          <ResultCard person={person} showLevel={canSeeScores} />
          {pending && !proposed && <p className="form-tip">{t("ยังประเมินไม่ได้ · ดึงข้อมูล KPI ใหม่ หรือส่งให้ Manager ตรวจสอบ")}</p>}
          {published && person.acknowledged && <p className="subtle">{t("พนักงานรับทราบผลแล้ว")}</p>}
          {published && <AppealPanel person={person} cycle={cycle} role={role} onAction={onAction} />}
          <div className="actions review-actions">
            {pending && proposed && !needsSecond && <Button onClick={() => onAction("decide")}>{t("ยืนยันหรือปรับระดับ")}</Button>}
            {pending && refreshMissingResults(person) !== person && <Button onClick={() => onAction("refresh-kpi")}>{t("ดึงข้อมูล KPI ใหม่")}</Button>}
            {pending && <Button variant="secondary" onClick={() => onAction("return")}>{t("ส่งกลับให้ Manager")}</Button>}
            {pending && person.status === "decided" && proposed && person.decision?.level && readyToPublish && <Button onClick={() => onAction("publish")}>{t("เผยแพร่ผล")}</Button>}
            {published && role === "employee" && !person.acknowledged && <Button onClick={() => onAction("acknowledge")}>{t("รับทราบผล")}</Button>}
          </div>
          {pending && person.status === "decided" && person.secondReview && !readyToPublish &&
            <p className="form-tip">{t("ยืนยันระดับสุดท้ายอีกครั้งหลังอ่านความเห็นผู้ทบทวนก่อนเผยแพร่")}</p>}
        </Panel>}
        {role === "hr" && <CalibrationHistory person={person} />}
        {role === "hr" && person.activity.length > 0 && <Panel title={t("ประวัติการดำเนินการ")}><ul className="audit">
          {person.activity.map((entry, index) => <li key={index}>{entry.role.toUpperCase()} · {t(entry.message)}{" "}
            <span className="subtle">{new Intl.DateTimeFormat(formatLocale(), {dateStyle: "short", timeStyle: "short", timeZone: "Asia/Bangkok"}).format(new Date(entry.at))}</span>
          </li>)}
        </ul></Panel>}
      </div>
    </div>
  </>;
}

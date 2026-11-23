import { t } from "../i18n";
import { useState, type FormEvent } from "react";
import { anchors, rubric } from "../config";
import { cycleClosure, newRoundName } from "../domain/cycle";
import { kpiTemplates, needsGoalAssignment, templateForTeam } from "../domain/goal-plan";
import { category, proposal, reviewFlag, score } from "../domain/kpi";
import { awaitingSecondReview } from "../domain/manager-feedback";
import { managerForPerson, managersForTeam } from "../domain/managers";
import { workDateTime } from "../domain/work";
import type { Cycle, Person, Role, Team } from "../types";
import { date, showLevel } from "../utils/format";
import { Button, Field, Heading, Panel, PersonLabel } from "./ui";

export const readField = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export function CycleStatus({ status }: { status: Cycle["status"] }) {
  const label = status === "open" ? t("เปิดรอบแล้ว") : status === "closed" ? t("ปิดรอบแล้ว") : t("ฉบับร่าง");
  return <span className={`pill ${status === "open" ? "green" : status === "draft" ? "amber" : ""}`}>{label}</span>;
}

export function CycleSetup({ cycle, people, onOpen, onClose, onCreate, onCriteria, onOverview, onAppeals, onTeamTemplate, onSendTeamPlans, onMissingPlans }: {
  cycle: Cycle; people: Person[]; onOpen: (form: FormData) => void; onClose: () => void;
  onCreate?: () => void; onCriteria: () => void; onOverview: () => void; onAppeals: () => void;
  onTeamTemplate?: (team: Team, templateId: string) => void; onSendTeamPlans?: () => void; onMissingPlans?: () => void;
}) {
  const teams = [...new Set(people.map(person => person.team))];
  const [selected, setSelected] = useState(cycle.teams);
  const draft = cycle.status === "draft";
  const closed = cycle.status === "closed";
  const includedTeams = draft ? selected : cycle.teams;
  const closure = cycleClosure(cycle, people);
  const templates = kpiTemplates(cycle);
  const missing = people.filter(person => includedTeams.includes(person.team) && needsGoalAssignment(person));
  const eligible = missing.filter(person => templateForTeam(cycle, person.team)).length;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onOpen(new FormData(event.currentTarget));
  }
  return <>
    <Heading title={t("ตั้งรอบประเมิน")} description={draft ? t("กำหนดช่วงเวลา ผู้ประเมิน และน้ำหนักคะแนนก่อนเปิดรอบ") : closed
      ? (cycle.closedAt ? t("ปิดรอบเมื่อ {0}", workDateTime(cycle.closedAt)) : t("ปิดรอบประเมินแล้ว"))
      : t("พนักงานและหัวหน้าเห็นเกณฑ์ของรอบนี้แล้ว")} actions={<div className="actions">
        <CycleStatus status={cycle.status} />
        {closed && onCreate && <Button onClick={onCreate}>{t("สร้างรอบใหม่")}</Button>}
      </div>} />
    {!closed && <Panel title={t("แม่แบบ KPI ของแต่ละทีม")} description={draft
      ? t("เมื่อเปิดรอบ ระบบส่งแผนจากแม่แบบของทีมให้พนักงานที่ยังไม่มีแผน")
      : t("เลือกแม่แบบแล้วส่งให้พนักงานที่ยังไม่มีแผน แผนที่ส่งแล้วไม่เปลี่ยนตาม")}>
      <div className="form-grid">{includedTeams.map(team => <Field key={team} label={team}>
        <select value={cycle.teamTemplates?.[team] ?? ""} disabled={!onTeamTemplate}
          onChange={event => onTeamTemplate?.(team, event.target.value)}>
          <option value="">{t("ยังไม่เลือกแม่แบบ")}</option>
          {templates.map(template => <option key={template.id} value={template.id}>{template.title}</option>)}
        </select>
      </Field>)}</div>
      {missing.length > 0 && <div className="actions">
        <span className="pill amber">{t("ยังไม่มีแผน KPI {0} คน", missing.length)}</span>
        {eligible > 0 && <span className="pill blue">{t("พร้อมรับแผนจากแม่แบบ {0} คน", eligible)}</span>}
        {!draft && eligible > 0 && onSendTeamPlans && <Button onClick={onSendTeamPlans}>{t("ส่งแผนจากแม่แบบ")}</Button>}
        {!draft && onMissingPlans && <Button variant="secondary" onClick={onMissingPlans}>{t("ดูคนที่ยังไม่มีแผน KPI")}</Button>}
      </div>}
    </Panel>}
    {!draft && <Panel title={t("การปิดรอบประเมิน")} actions={!closed &&
      <Button onClick={onClose}>{t("ปิดรอบประเมิน")}</Button>}>
      <div className="actions">
        <span className="pill progress-label">{t("เผยแพร่แล้ว {0}/{1} คน", closure.published, closure.total)}</span>
        {closure.unpublished > 0 && <span className="pill amber">{t("ยังไม่เผยแพร่ {0} คน", closure.unpublished)}</span>}
        <span className={`pill ${closure.openAppeals ? "amber" : ""}`}>{t("คำขอตรวจสอบค้าง {0} รายการ", closure.openAppeals)}</span>
      </div>
      <p className="subtle">{closed ? t("KPI หลักฐาน และผลประเมินถูกล็อกแล้ว HR ยังดูและส่งออกผลจากหน้าภาพรวมได้")
        : t("ในต้นแบบนี้ HR ปิดรอบได้ทันที รายการค้างจะถูกเก็บไว้ในสถานะเดิม")}</p>
      {(closed || closure.unpublished > 0 || closure.openAppeals > 0) && <div className="actions">
        {(closed || closure.unpublished > 0) && <Button variant="secondary" onClick={onOverview}>{t("ดูภาพรวม")}</Button>}
        {closure.openAppeals > 0 && <Button variant="secondary" onClick={onAppeals}>{t("คำขอตรวจสอบผล")}</Button>}
      </div>}
    </Panel>}
    <div className="setup-layout">
    <Panel title={draft ? t("รายละเอียดรอบ") : t(cycle.name)} description={draft ? t("พนักงานในทีมที่เลือกจะเข้าร่วมรอบนี้") : undefined}
      actions={<Button variant="secondary" onClick={onCriteria}>{t("ดูเกณฑ์กลาง")}</Button>}>
      {!draft ? <>
        <p>{t("พนักงานส่งภายใน") + " "}{date(cycle.employeeDue)}{" " + t("· หัวหน้าส่งภายใน") + " "}{date(cycle.managerDue)}</p>
        <p>{t("ผลลัพธ์งาน") + " "}{cycle.resultWeight}{t("% · พฤติกรรม") + " "}{100 - cycle.resultWeight}%</p>
        <ul>{cycle.teams.map(team => <li key={team}>{team} · {managersForTeam(cycle, team).map(manager => manager.name).join(" / ")}</li>)}</ul>
      </> : <form className="inline-form" onSubmit={submit}>
        <Field label={t("ชื่อรอบ")}><input name="name" defaultValue={cycle.name === newRoundName ? "" : cycle.name}
          placeholder={t(newRoundName)} maxLength={80} required /></Field>
        <div className="form-grid">
          <Field label={t("กำหนดส่งพนักงาน")}><input name="employeeDue" type="date" defaultValue={cycle.employeeDue} required /></Field>
          <Field label={t("กำหนดส่งหัวหน้า")}><input name="managerDue" type="date" defaultValue={cycle.managerDue} required /></Field>
        </div>
        <Field label={t("น้ำหนักผลลัพธ์งาน (%) ส่วนที่เหลือเป็นพฤติกรรม")}><input name="resultWeight" type="number" min={1} max={99} defaultValue={cycle.resultWeight} required /></Field>
        <fieldset className="team-fieldset"><legend>{t("ทีมที่เข้ารอบและผู้ประเมิน")}</legend><div className="stack">
          {teams.map(team => <div key={team} className="team-row">
            <label className="team-choice"><input type="checkbox" name="team" value={team} checked={selected.includes(team)}
              onChange={event => setSelected(event.target.checked ? [...selected, team] : selected.filter(name => name !== team))} /> {team}</label>
            <div className="form-grid">
              <Field label={t("Manager คนที่ 1 · {0}", team)}><input name={`reviewer-${team}`} defaultValue={managersForTeam(cycle, team)[0].name} maxLength={80} disabled={!selected.includes(team)} required /></Field>
              <Field label={t("Manager คนที่ 2 · {0}", team)}><input name={`reviewer-${team}-2`} defaultValue={managersForTeam(cycle, team)[1].name} maxLength={80} disabled={!selected.includes(team)} required /></Field>
            </div>
          </div>)}
        </div></fieldset>
        <div className="setup-footer"><Button type="submit">{t("เปิดรอบประเมิน")}</Button></div>
      </form>}
    </Panel>
    <Panel title={t("ผู้เข้าร่วมรอบ")}>
      <div className="participant-total"><strong>{people.filter(person => includedTeams.includes(person.team)).length}</strong><span>{t("คนจาก") + " "}{includedTeams.length}{" " + t("ทีม")}</span></div>
      <ul className="participant-list">{teams.filter(team => includedTeams.includes(team)).map(team =>
        <li key={team}><span>{team}</span><span className="pill">{people.filter(person => person.team === team).length}{" " + t("คน")}</span></li>
      )}</ul>
      {draft && selected.length === 0 && <p className="muted">{t("เลือกทีมที่จะเข้ารอบประเมิน")}</p>}
    </Panel>
    </div>
  </>;
}

export function Criteria({ cycle, roleTemplate }: { cycle: Cycle; roleTemplate?: React.ReactNode }) {
  return <>
    <Heading title={t("เกณฑ์การประเมิน")} description={t(cycle.name)} />
    {roleTemplate}
    <Panel title={t("ผลลัพธ์งานและพฤติกรรม")}><p>{t("ผลลัพธ์งาน") + " "}{cycle.resultWeight}{t("% · พฤติกรรม") + " "}{100 - cycle.resultWeight}%</p>
      <p>{t("เทียบผลจริงกับเกณฑ์ระดับ 1–5 ของแต่ละ KPI แล้วรวมตามน้ำหนัก กรณีหลักฐานไม่ครบจะพักผลไว้ HR ตรวจเหตุผลก่อนเผยแพร่")}</p>
    </Panel>
    <Panel title={t("พฤติกรรมที่สังเกตได้")}><div className="stack">
      {rubric.map((label, index) => <div className="item" key={label}><strong>{index + 1} / 5 · {t(label)}</strong><p>{t(anchors[index])}</p></div>)}
    </div></Panel>
  </>;
}

export function Calibration({ people, cycle, role, cohort, onCohort, onOpen, batch }: {
  people: Person[]; cycle: Cycle; role: Role; cohort: string; onCohort: (value: string) => void; onOpen: (id: string) => void;
  batch?: React.ReactNode;
}) {
  const groups = [...new Set(people.map(person => person.cohort))];
  const selected = groups.includes(cohort) ? cohort : groups[0] ?? "";
  return <>
    <Heading title={t("ทบทวนมาตรฐานคะแนน")} description={t("เทียบหลักฐานของพนักงานในกลุ่มงานและระดับใกล้กัน")} />
    {batch}
    <Panel title={t("กลุ่มเปรียบเทียบ")}>
      <div className="toolbar"><label htmlFor="cohort-filter">{t("กลุ่มงานและระดับ")}</label>
        <select id="cohort-filter" value={selected} onChange={event => onCohort(event.target.value)}>
          {groups.map(group => <option key={group} value={group}>{t(group)}</option>)}
        </select></div>
      <div className="scroll"><table><thead><tr>
        {[t("พนักงาน"), t("ผลลัพธ์งาน"), t("พฤติกรรม"), t("ระดับเสนอ"), t("ระดับยืนยัน"), t("สิ่งที่ต้องตรวจ"), t("หลักฐาน")].map(label => <th key={label}>{label}</th>)}
      </tr></thead><tbody>{people.filter(person => person.cohort === selected).map(person => <tr key={person.id}>
        <td><PersonLabel person={person} /><div className="subtle">{managerForPerson(cycle, person).name}</div></td>
        <td>{showLevel(score(person))}</td><td>{showLevel(person.review?.rating)}</td>
        <td>{showLevel(proposal(person, cycle.resultWeight)?.level)}</td>
        <td>{person.decision?.level ? `${person.decision.level} · ${t(category(person.decision.level))}` : "—"}</td>
        <td>{reviewFlag(person, cycle.resultWeight)}
          {role === "hr" && awaitingSecondReview(person, cycle) && <div><span className="pill amber">{t("ควรทบทวนเพิ่ม")}</span></div>}
          {role === "hr" && person.secondReview && <div className="subtle">{t("ผู้ทบทวนคนที่สอง") + " "}{showLevel(person.secondReview.rating)}</div>}
        </td>
        <td><Button variant="text" onClick={() => onOpen(person.id)}>{t("ดูหลักฐาน")}</Button></td>
      </tr>)}</tbody></table></div>
      <p className="muted">{role === "hr" ? t("เปิดรายบุคคลเพื่อเปรียบเทียบหลักฐาน ยืนยันคะแนน หรือส่งกลับให้เพิ่มข้อมูล") : t("คุณเห็นและทบทวนได้เฉพาะรายการในทีมที่รับผิดชอบ")}</p>
    </Panel>
  </>;
}

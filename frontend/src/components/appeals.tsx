import { t } from "../i18n";
import { rubric } from "../config";
import { appealGroundLabel, awaitingClarification, canRequestAppeal, isPendingAppeal, raisedOnAppeal } from "../domain/appeals";
import { category } from "../domain/kpi";
import { managerForPerson } from "../domain/managers";
import { bangkokDay } from "../domain/submission";
import type { Cycle, Person, Role } from "../types";
import { date } from "../utils/format";
import { appealDeadline } from "./appeal-actions";
import type { PersonAction } from "./person";
import { Button, Heading, Panel, PersonLabel, Stat } from "./ui";

/** Published results an employee asked HR to check and no reviewer has decided yet. */
export const pendingAppeals = (people: Person[]) => people.filter(isPendingAppeal);

function Outcome({ person, showResponse = true }: { person: Person; showResponse?: boolean }) {
  const appeal = person.appeal;
  if (!appeal?.response) return null;
  return <div className="item">
    <strong>{raisedOnAppeal(appeal)
      ? t("ปรับผลจาก {0} เป็น {1}", t(category(appeal.previousLevel)), t(category(appeal.finalLevel)))
      : t("ผลการตรวจสอบ · คงผลเดิม")}</strong>
    {showResponse && <p className="feedback">{appeal.response}</p>}
    {appeal.resolvedOn && <p className="subtle">{t("แจ้งผลเมื่อ {0}", date(appeal.resolvedOn))}</p>}
  </div>;
}

/** What each role may see of one person's appeal, plus the action that is theirs to take. */
export function AppealPanel({ person, cycle, role, onAction, today = bangkokDay() }: {
  person: Person; cycle: Cycle; role: Role; onAction: (action: PersonAction) => void; today?: string;
}) {
  const appeal = person.appeal;
  if (role === "manager") {
    if (!appeal) return null;
    const clarification = appeal.clarification;
    return <>
      {clarification && <div className="item">
        <strong>{t("คำถามจาก HR")}</strong>
        <p className="feedback">{clarification.question}</p>
        {clarification.response ? <p className="feedback"><strong>{t("คำชี้แจงของคุณ")}</strong> · {clarification.response}</p>
          : isPendingAppeal(person) && <div className="actions"><Button onClick={() => onAction("clarify-appeal")}>{t("ชี้แจงต่อ HR")}</Button></div>}
      </div>}
      {raisedOnAppeal(appeal) && <Outcome person={person} showResponse={appeal.ground !== "fairness"} />}
    </>;
  }
  if (!appeal) {
    if (role !== "employee" || !canRequestAppeal(person, cycle, today)) return null;
    const deadline = appealDeadline(person);
    return <div className="actions review-actions">
      <Button variant="secondary" onClick={() => onAction("appeal")}>{t("ขอตรวจสอบผล")}</Button>
      <span className="subtle">{deadline ? t("ยื่นได้ถึง {0} · แนะนำให้คุยกับ Manager ก่อน", date(deadline)) : t("แนะนำให้คุยกับ Manager ก่อน")}</span>
    </div>;
  }
  const ground = appealGroundLabel(appeal.ground);
  const pending = isPendingAppeal(person);
  return <div className="stack">
    <div className="item">
      <strong>{t("คำขอตรวจสอบ")}{ground && ` · ${t(ground)}`}</strong>
      <p className="feedback">{appeal.reason}</p>
      {appeal.evidence && <p className="feedback"><strong>{t("หลักฐาน ·")}</strong> {appeal.evidence}</p>}
      {appeal.submittedOn && <p className="subtle">{t("ยื่นเมื่อ {0}", date(appeal.submittedOn))}</p>}
    </div>
    {role === "hr" && appeal.clarification && <div className="item">
      <strong>{t("คำถามถึง Manager")}</strong>
      <p className="feedback">{appeal.clarification.question}</p>
      <p className="feedback">{appeal.clarification.response ?? t("รอ Manager ชี้แจง")}</p>
    </div>}
    {role === "hr" && appeal.reviewer && <p className="subtle">{t("ผู้พิจารณา ·") + " "}{appeal.reviewer}</p>}
    <Outcome person={person} />
    {pending && role === "employee" && <p className="form-tip">{t("ส่งคำขอแล้ว · HR ที่ไม่ได้ยืนยันผลเดิมกำลังพิจารณา")}</p>}
    {pending && role === "hr" && <div className="actions">
      {!appeal.clarification && <Button variant="secondary" onClick={() => onAction("request-clarification")}>{t("ขอคำชี้แจงจาก Manager")}</Button>}
      <Button onClick={() => onAction("resolve-appeal")}>{t("พิจารณาและแจ้งผล")}</Button>
    </div>}
  </div>;
}

export function AppealsQueue({ people, cycle, onOpen, otherRounds = [], onRound }: {
  people: Person[]; cycle: Cycle; onOpen: (id: string) => void;
  otherRounds?: { round: number; name: string; count: number }[]; onRound?: (round: number) => void;
}) {
  const closed = cycle.status === "closed";
  const pending = pendingAppeals(people);
  const answered = people.filter(person => person.appeal?.response);
  const pendingLabel = t("รอพิจารณา");
  return <>
    <Heading title={t("คำขอตรวจสอบผล")} description={closed ? t("รอบนี้ปิดแล้ว แต่คำขอที่ค้างยังพิจารณาต่อได้")
      : t("ผู้พิจารณาต้องเป็น HR คนละคนกับผู้ยืนยันผลเดิม · เปิดรายการเพื่อดูหลักฐานและแจ้งผล")} />
    {otherRounds.length > 0 && <Panel title={t("มีคำขอค้างในรอบอื่น")}>
      <div className="actions">{otherRounds.map(item => <Button key={item.round} variant="secondary" onClick={() => onRound?.(item.round)}>
        {t(item.name)} · {t("{0} รายการ", item.count)}
      </Button>)}</div>
    </Panel>}
    <div className="stats">
      <Stat label={pendingLabel}>{pending.length}</Stat>
      <Stat label={t("พิจารณาแล้ว")}>{answered.length}</Stat>
      <Stat label={t("ผลที่เผยแพร่แล้ว")}>{people.filter(person => person.status === "published").length}</Stat>
    </div>
    <Panel title={pendingLabel} description={t("ผลเดิมยังมีผลอยู่จนกว่าจะแจ้งผลการพิจารณา")}>
      {pending.length ? <ul className="inbox">{pending.map(person => {
        const level = person.decision?.level;
        const ground = appealGroundLabel(person.appeal?.ground);
        return <li key={person.id} className="soon">
          <span className="avatar">{person.initials}</span>
          <div className="inbox-body">
            <div className="inbox-title"><span className="inbox-kind">{ground ? t(ground) : t("ขอตรวจสอบ")}</span><strong>{person.name}</strong>
              <span className="subtle">{person.team} · {managerForPerson(cycle, person).name}</span></div>
            <div className="feedback">{person.appeal?.reason}</div>
            {level && <div className="subtle">{t("ผลที่เผยแพร่ ·") + " "}{level} / 5 {t(rubric[level - 1])} · {t(category(level))}
              {person.decision?.followUp && t(" · ติดตามผล {0}", date(person.decision.followUp))}</div>}
            {awaitingClarification(person) && <div className="subtle">{t("รอ Manager ชี้แจง")}</div>}
          </div>
          <div className="inbox-meta"><Button onClick={() => onOpen(person.id)}>{t("เปิดเพื่อพิจารณา")}</Button></div>
        </li>;
      })}</ul> : <p className="empty">{t("ไม่มีคำขอตรวจสอบที่รอพิจารณา")}</p>}
    </Panel>
    {answered.length > 0 && <Panel title={t("พิจารณาแล้ว")}>
      <div className="scroll"><table><thead><tr><th>{t("พนักงาน")}</th><th>{t("คำขอ")}</th><th>{t("ผลการพิจารณา")}</th><th>{t("รายละเอียด")}</th></tr></thead>
        <tbody>{answered.map(person => <tr key={person.id}>
          <td><PersonLabel person={person} /></td>
          <td className="wrap">{person.appeal?.reason}</td>
          <td className="wrap">{raisedOnAppeal(person.appeal) ? t("ปรับ {0} → {1}", person.appeal?.previousLevel, person.appeal?.finalLevel) : t("คงผลเดิม")}
            <div className="subtle">{person.appeal?.response}</div></td>
          <td><Button variant="text" onClick={() => onOpen(person.id)}>{t("เปิดรายการ")}</Button></td>
        </tr>)}</tbody></table></div>
    </Panel>}
  </>;
}

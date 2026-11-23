import { t } from "../i18n";
import { exceptionCases, publishableCases, routineCases } from "../domain/hr-batch";
import type { Cycle, Person, Team } from "../types";
import type { FormSpec } from "./actions";
import { readField } from "./overview";
import { Button, Field, Panel, PersonLabel } from "./ui";

export function HrBatchPanel({ people, cycle, onOpen, onConfirm, onPublish }: {
  people: Person[]; cycle: Cycle; onOpen: (id: string) => void; onConfirm: () => void; onPublish: () => void;
}) {
  const routine = routineCases(people, cycle);
  const exceptions = exceptionCases(people, cycle);
  const ready = publishableCases(people, cycle);
  if (!routine.length && !exceptions.length && !ready.length) return null;
  return <Panel title={t("ยืนยันและเผยแพร่เป็นกลุ่ม")} description={t("ยืนยันเคสปกติพร้อมกัน แล้วใช้เวลากับเคสที่ต้องอ่านรายคน")}>
    <div className="hr-batch-grid">
      <section>
        <h3>{t("เคสปกติ")}</h3><strong>{t("{0} คน", routine.length)}</strong>
        <p className="subtle">{t("ตามความคาดหวังและไม่มีข้อสังเกต")}</p>
        <Button disabled={!routine.length} variant={routine.length ? "" : "secondary"} onClick={onConfirm}>{t("ยืนยันตามระดับที่เสนอ")}</Button>
      </section>
      <section>
        <h3>{t("ต้องดูรายคน")}</h3><strong>{t("{0} คน", exceptions.length)}</strong>
        <p className="subtle">{t("High, Low หรือมีข้อสังเกตที่ต้องตรวจหลักฐาน")}</p>
      </section>
      <section>
        <h3>{t("พร้อมเผยแพร่")}</h3><strong>{t("{0} คน", ready.length)}</strong>
        <p className="subtle">{t("HR ยืนยันระดับแล้ว")}</p>
        <Button disabled={!ready.length} variant={ready.length ? "" : "secondary"} onClick={onPublish}>{t("เผยแพร่ผล")}</Button>
      </section>
    </div>
    {exceptions.length > 0 && <ul className="dashboard-list hr-batch-list">{exceptions.map(({ person, reasons }) => <li key={person.id}>
      <PersonLabel person={person} />
      <div className="actions">
        {reasons.map(reason => <span className="pill amber" key={reason}>{reason}</span>)}
        <Button variant="text" onClick={() => onOpen(person.id)}>{t("ดูหลักฐาน")}</Button>
      </div>
    </li>)}</ul>}
  </Panel>;
}

const names = (people: Person[]) => people.map(person => `${person.name} (${person.id})`).join(", ");

export function routineConfirmForm(people: Person[], onSave: (reviewer: string) => void): FormSpec {
  return {
    title: t("ยืนยันตามระดับที่เสนอ · {0} คน", people.length), label: t("ยืนยันทั้งกลุ่ม"),
    content: <>
      <p className="form-tip">{t("ระบบจะบันทึกชื่อผู้ยืนยัน ระดับ และหลักฐานของแต่ละคนไว้ในประวัติ ยังไม่เผยแพร่ให้พนักงาน")}</p>
      <p className="subtle">{names(people)}</p>
      <Field label={t("ชื่อผู้ยืนยันผล (HR)")}><input name="reviewer" maxLength={100} required /></Field>
    </>,
    validate: form => readField(form, "reviewer") ? undefined : t("ระบุชื่อผู้ยืนยันผล"),
    save: form => {
      const reviewer = readField(form, "reviewer");
      if (reviewer) onSave(reviewer);
    },
  };
}

export function publishForm(people: Person[], onSave: (team: Team | "") => void): FormSpec {
  const teams = [...new Set(people.map(person => person.team))];
  return {
    title: t("เผยแพร่ผลประเมิน"), label: t("ยืนยันเผยแพร่"),
    content: <>
      <p className="form-tip">{t("พนักงานจะเห็นผลทันที และเริ่มนับเวลาขอตรวจสอบผล")}</p>
      <Field label={t("เผยแพร่ให้")}><select name="team" defaultValue="">
        <option value="">{t("ทุกทีมที่พร้อม · {0} คน", people.length)}</option>
        {teams.map(team => <option key={team} value={team}>{t("{0} · {1} คน", team, people.filter(person => person.team === team).length)}</option>)}
      </select></Field>
    </>,
    save: form => onSave(readField(form, "team") as Team | ""),
  };
}

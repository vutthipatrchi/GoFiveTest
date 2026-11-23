import { t } from "../i18n";
import type { Person } from "../types";
import { PlanStatus } from "./goal-plan";
import { date, number } from "../utils/format";
import { Button, Heading, Panel, PersonLabel } from "./ui";

function history(person: Person) {
  return person.goals.flatMap(goal =>
    (goal.updates ?? []).map(update => ({ goal, update })));
}

export function GoalTimeline({ person }: { person: Person }) {
  const entries = history(person).sort((a, b) =>
    (b.update.recordedOn ?? "").localeCompare(a.update.recordedOn ?? ""));
  return <Panel title={t("ประวัติความคืบหน้า")} description={t("ผลจริง ช่วงเวลาที่วัด และหลักฐานจากแต่ละครั้งที่บันทึก")}>
    {entries.length ? <ol className="activity-timeline">
      {entries.map(({ goal, update }, index) => <li key={index}>
        <p className="subtle">{update.recordedOn ? <time dateTime={update.recordedOn}>{date(update.recordedOn)}</time> : t("ข้อมูลก่อนเริ่มติดตาม")}{update.period && ` · ${update.period}`}</p>
        <h3>{t(goal.name)}</h3>
        <p>{t("ผลจริง") + " "}<strong>{number(update.actual)} {t(goal.unit)}</strong></p>
        {update.evidence && <p className="feedback">{t("หลักฐาน ·") + " "}{t(update.evidence)}</p>}
        {update.note && <p className="feedback">{update.note}</p>}
      </li>)}
    </ol> : <p className="empty">{t("ยังไม่มีบันทึกความคืบหน้า")}</p>}
  </Panel>;
}

export function TeamTracking({ people, team, managerName, onOpen }: {
  people: Person[]; team: string; managerName?: string; onOpen: (id: string) => void;
}) {
  return <>
    <Heading title={t("ทีมของฉัน · {0}", team)} description={managerName ? t("ลูกทีมของ {0}", managerName) : t("ดูความคืบหน้า KPI และวันที่อัปเดตล่าสุดของสมาชิก")} />
    <Panel title={t("ความคืบหน้ารายบุคคล")}>
      <div className="scroll"><table><thead><tr>
        <th>{t("พนักงาน")}</th><th>{t("แผน KPI")}</th><th>{t("KPI ที่มีบันทึก")}</th><th>{t("อัปเดตล่าสุด")}</th><th>{t("รายละเอียด")}</th>
      </tr></thead><tbody>{people.map(person => {
        const lastDay = history(person).map(({ update }) => update.recordedOn ?? "").sort().at(-1);
        const tracked = person.goals.filter(goal => goal.updates?.some(update => update.recordedOn)).length;
        return <tr key={person.id}><td><PersonLabel person={person} /></td>
          <td><PlanStatus person={person} /></td>
          <td>{tracked} / {person.goals.length}</td><td>{lastDay ? date(lastDay) : t("ยังไม่มีบันทึก")}</td>
          <td><Button variant="text" onClick={() => onOpen(person.id)}>{t("ดู KPI และความคืบหน้า")}</Button></td>
        </tr>;
      })}</tbody></table></div>
    </Panel>
  </>;
}

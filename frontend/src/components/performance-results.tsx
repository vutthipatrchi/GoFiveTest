import { t } from "../i18n";
import { goalCutoffs } from "../domain/goal-plan";
import { currentCalibration, performanceBands, performanceResult, type PerformanceFilters } from "../domain/performance";
import { workDateTime } from "../domain/work";
import type { CalibrationRecord, Cycle, Person } from "../types";
import { date, number, showLevel } from "../utils/format";
import { CycleStatus } from "./overview";
import { Badge, Button, Heading, Panel, PersonLabel } from "./ui";
import { WorkDelivery } from "./work-delivery";

export function PerformanceResults({ people, cycle, filters, onFilters, onOpen }: {
  people: Person[];
  cycle: Cycle;
  filters: PerformanceFilters;
  onFilters: (filters: PerformanceFilters) => void;
  onOpen: (id: string) => void;
}) {
  const scoped = people.filter(person =>
    (!filters.team || person.team === filters.team) &&
    (!filters.title || person.title === filters.title) &&
    (!filters.cohort || person.cohort === filters.cohort));
  const results = scoped.map(person => performanceResult(person, cycle));
  const shown = results.filter(result => !filters.band || result.band === filters.band);
  const titles = [...new Set(people.map(person => person.title))].sort();
  const cohorts = [...new Set(people.map(person => person.cohort))];

  return <>
    <Heading title={t("ภาพรวมระดับผลงาน")} description={t(cycle.name)} actions={<CycleStatus status={cycle.status} />} />
    <Panel title={t("ผลตามเกณฑ์ของรอบ")} description={t("จัดกลุ่มตามระดับที่ HR ยืนยัน พร้อมสถานะการเผยแพร่")}>
      <div className="toolbar">
        <select aria-label={t("กรองทีม")} value={filters.team}
          onChange={event => onFilters({ ...filters, team: event.target.value as PerformanceFilters["team"] })}>
          <option value="">{t("ทุกทีม")}</option>
          {cycle.teams.map(team => <option key={team}>{team}</option>)}
        </select>
        <select aria-label={t("กรองตำแหน่ง")} value={filters.title}
          onChange={event => onFilters({ ...filters, title: event.target.value })}>
          <option value="">{t("ทุกตำแหน่ง")}</option>
          {titles.map(title => <option key={title}>{title}</option>)}
        </select>
        <select aria-label={t("กลุ่มงานและระดับ")} value={filters.cohort}
          onChange={event => onFilters({ ...filters, cohort: event.target.value })}>
          <option value="">{t("ทุกกลุ่มงานและระดับ")}</option>
          {cohorts.map(cohort => <option key={cohort} value={cohort}>{t(cohort)}</option>)}
        </select>
      </div>
      <div className="performance-bands" role="group" aria-label={t("กรองตามระดับผลงาน")}>
        {performanceBands.map(band => <button type="button" key={band.id} className="performance-band"
          aria-pressed={filters.band === band.id} onClick={() => onFilters({ ...filters, band: filters.band === band.id ? "" : band.id })}>
          <span>{t(band.label)}</span><strong>{number(results.filter(result => result.band === band.id).length)}</strong>
        </button>)}
      </div>
    </Panel>
    <Panel title={t("ผลและหลักฐานรายคน")} description={t("แสดง {0} จาก {1} คน", shown.length, results.length)}
      actions={filters.band && <Button variant="secondary" onClick={() => onFilters({ ...filters, band: "" })}>{t("แสดงทุกระดับ")}</Button>}>
      {shown.length ? <div className="scroll"><table className="performance-table"><thead><tr>
        <th scope="col">{t("พนักงาน")}</th>
        <th scope="col">{t("ผลที่ HR ยืนยัน")}</th>
        <th scope="col">{t("เหตุผลหลัก")}</th>
        <th scope="col">{t("KPI ที่มีผลมากที่สุด")}</th>
        <th scope="col">{t("ความครบถ้วนของหลักฐาน")}</th>
        <th scope="col">{t("แผนพัฒนาและติดตามผล")}</th>
        <th scope="col">{t("รายละเอียด")}</th>
      </tr></thead><tbody>{shown.map(({ person, band, level, driver, complete, total, record }) => {
        const info = performanceBands.find(item => item.id === band)!;
        return <tr key={person.id}>
          <td><PersonLabel person={person} /><div className="subtle">{person.team} · {t(person.cohort)}</div></td>
          <td>
            <span className={`pill ${info.tone}`}>{t(info.label)}</span>
            <div className="actions">{level !== undefined && <strong>{showLevel(level)}</strong>}<Badge status={person.status} /></div>
          </td>
          <td className="wrap">{level !== undefined ? person.decision?.reason : "—"}</td>
          <td className="wrap">{driver ? <>
            <strong>{t(driver.goal.name)}</strong>
            <div className="subtle">{t("ผลจริง {0} {1}", number(driver.goal.actual), t(driver.goal.unit))} · {showLevel(driver.level)}</div>
            <div className="subtle">{t("ผลต่างถ่วงน้ำหนักจากระดับ 3")} {driver.impact > 0 ? "+" : ""}{driver.impact.toFixed(2)}</div>
          </> : "—"}</td>
          <td><strong>{t("หลักฐานครบ {0}/{1} KPI", complete, total)}</strong>
            {record && <div className="subtle">{t("มีบันทึกการอ้างอิงของ HR")}</div>}
          </td>
          <td className="wrap">{level !== undefined && person.decision?.next ? <>
            {person.decision.next}
            {person.decision.followUp && <div className="subtle">{t("ติดตามผล")} {date(person.decision.followUp)}</div>}
          </> : "—"}</td>
          <td><Button variant="text" onClick={() => onOpen(person.id)}>{t("ดูหลักฐานและเหตุผล")}</Button></td>
        </tr>;
      })}</tbody></table></div> : <p className="empty">{t("ไม่มีผลตรงกับตัวกรอง")}</p>}
    </Panel>
  </>;
}

function CalibrationEvidence({ record }: { record: CalibrationRecord }) {
  return <div className="stack">
    <p className="feedback"><strong>{t("เหตุผลหลัก")}</strong> · {record.reason}</p>
    <p className="subtle">{t("กลุ่มเปรียบเทียบ")} · {t(record.cohort)}
      {record.template && <><br />{t("แม่แบบ {0} · ฉบับ {1}", record.template.title, record.template.version)}</>}</p>
    <p className="subtle">
      {t("ผลลัพธ์งาน")} {showLevel(record.workScore)} ({record.resultWeight}%) · {t("พฤติกรรม")} {showLevel(record.manager.rating)} ({100 - record.resultWeight}%)
      <br />{t("คะแนนเสนอ")} {record.proposed.overall.toFixed(2)} / 5
      {record.previousLevel !== undefined && <><br />{t("ระดับที่ HR ยืนยันก่อนหน้า")} {showLevel(record.previousLevel)}</>}
    </p>
    <div className="item">
      <div className="actions"><strong>{t("หลักฐานพฤติกรรมจาก Manager")} · {record.manager.name}</strong>
        {record.manager.cited && <span className="pill blue">{t("HR ใช้อ้างอิง")}</span>}</div>
      <p className="feedback">{record.manager.feedback || "—"}</p>
    </div>
    {record.secondReview && <div className="item">
      <div className="actions"><strong>{t("หลักฐานจากผู้ทบทวนคนที่สอง")} · {record.secondReview.reviewer} · {showLevel(record.secondReview.rating)}</strong>
        {record.secondReview.cited && <span className="pill blue">{t("HR ใช้อ้างอิง")}</span>}</div>
      <p className="feedback">{record.secondReview.evidence}</p>
    </div>}
    {record.kpis.map(({ goal, level, cited }, index) => <article className="item" key={index}>
      <div className="actions"><strong>{t(goal.name)}</strong>{cited && <span className="pill blue">{t("HR ใช้อ้างอิง")}</span>}</div>
      <p className="subtle">{t("ผลจริง {0} {1}", number(goal.actual), t(goal.unit))} · {showLevel(level)} · {t("น้ำหนัก")} {goal.weight}%</p>
      <p className="subtle">{t("เกณฑ์ระดับ 2 → 5 ·")} {goalCutoffs(goal).map(number).join(" → ")} {t(goal.unit)}</p>
      <p className="subtle">{t("ช่วงที่วัด ·")} {goal.period}</p>
      <p className="feedback">{t("หลักฐาน ·")} {t(goal.evidence ?? "")}</p>
      {goal.workSource && <details className="delivery-history">
        <summary>{t("ดูข้อมูลต้นทางที่ใช้คำนวณ")}</summary>
        <WorkDelivery source={goal.workSource} linked={false} />
      </details>}
    </article>)}
  </div>;
}

export function CalibrationHistory({ person }: { person: Person }) {
  const history = person.calibrationHistory ?? [];
  if (!history.length && !person.decision) return null;
  const current = currentCalibration(person);
  return <Panel title={t("ประวัติการยืนยันและปรับคะแนน")}>
    {!current && person.decision && <p className="subtle">{t("ผลปัจจุบันบันทึกไว้ก่อนมีประวัติการทบทวนแบบละเอียด")}</p>}
    {history.map((record, index) => <details key={record.id} className="calibration-record" open={index === 0}>
      <summary>
        <strong>{t("ระดับเสนอ {0} → ระดับสุดท้าย {1}", record.proposed.level, record.finalLevel)}</strong>
        <span className="subtle">{t("ผู้ยืนยันผล")} {record.reviewer} · {workDateTime(record.at)}</span>
      </summary>
      <CalibrationEvidence record={record} />
    </details>)}
  </Panel>;
}

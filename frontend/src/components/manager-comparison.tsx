import { useRef } from "react";
import { managerComparison, type ManagerComparisonFilters } from "../domain/manager-comparison";
import { t } from "../i18n";
import type { Cycle, Person } from "../types";
import { number, showLevel } from "../utils/format";
import { Button, Panel, PersonLabel } from "./ui";

function AverageBar({ label, value, tone }: { label: string; value: number; tone: "before" | "after" }) {
  return <div className="comparison-average">
    <span>{label}</span><strong>{value.toFixed(2)} / 5</strong>
    <span className="comparison-track" aria-hidden="true"><span className={tone} style={{ width: `${value / 5 * 100}%` }} /></span>
  </div>;
}

export default function ManagerComparison({ people, cycle, filters, onFilters, onOpen }: {
  people: Person[];
  cycle: Cycle;
  filters: ManagerComparisonFilters;
  onFilters: (filters: ManagerComparisonFilters) => void;
  onOpen: (id: string) => void;
}) {
  const { groups, selected, summaries, cases, shown } = managerComparison(people, cycle, filters);
  const caseList = useRef<HTMLDivElement>(null);
  const filterBy = (next: Omit<ManagerComparisonFilters, "group">) => {
    onFilters({ group: selected?.id ?? "", ...next });
    caseList.current?.focus();
  };
  const active = summaries.find(summary => summary.manager.id === filters.manager);
  return <>
    <Panel title={t("เปรียบเทียบการให้คะแนนของ Manager")}
      description={t("เลือกกลุ่มที่มีทีม ตำแหน่ง และระดับงานเดียวกัน แล้วเปิดเคสเพื่อเทียบหลักฐาน")}>
      {selected ? <>
        <div className="toolbar">
          <label htmlFor="manager-comparison-group">{t("กลุ่มเปรียบเทียบ")}</label>
          <select id="manager-comparison-group" value={selected.id} onChange={event => onFilters({ group: event.target.value, manager: "" })}>
            {groups.map(group => <option key={group.id} value={group.id}>{group.team} · {group.title} · {t(group.cohort)}</option>)}
          </select>
        </div>
        <div className="comparison-grid">{summaries.map(summary => {
          const { manager } = summary;
          return <article className="item comparison-card" key={manager.id}>
            <header>
              <h3>{manager.name}</h3>
              <p className="subtle">{t("ส่งคะแนนแล้ว {0}/{1} คน", number(summary.reviewed), number(summary.assigned))}</p>
            </header>
            <h4>{t("การกระจายคะแนนพฤติกรรม")}</h4>
            <p className="subtle">{t("ค่าเฉลี่ย {0}", showLevel(summary.behaviorMean))}</p>
            <div className="comparison-distribution" role="group" aria-label={t("คะแนนพฤติกรรมของ {0}", manager.name)}>
              {summary.distribution.map(({ level, count }) => {
                const share = summary.reviewed ? count / summary.reviewed * 100 : 0;
                return <button type="button" className="comparison-rating" key={level} disabled={!count}
                  aria-pressed={filters.manager === manager.id && filters.rating === level}
                  onClick={() => filterBy({ manager: manager.id, rating: level })}>
                  <span>{t("ระดับ")} {level}</span>
                  <span className="comparison-track" aria-hidden="true"><span style={{ width: `${share}%` }} /></span>
                  <span>{number(count)} {t("คน")} · {number(share)}%</span>
                </button>;
              })}
            </div>
            <div className="comparison-pair">
              <h4>{t("ระดับเฉลี่ยก่อน–หลัง HR ทบทวน")}</h4>
              {summary.beforeMean !== null && summary.afterMean !== null ? <>
                <p className="subtle">{t("มีทั้งระดับเสนอและระดับยืนยัน {0} เคส", number(summary.paired))}</p>
                <AverageBar label={t("ระดับเสนอ")} value={summary.beforeMean} tone="before" />
                <AverageBar label={t("ระดับที่ HR ยืนยัน")} value={summary.afterMean} tone="after" />
                {summary.adjusted > 0 && <Button variant="text" onClick={() => filterBy({ manager: manager.id, adjusted: true })}>
                  {t("ดู {0} เคสที่ปรับระดับ", number(summary.adjusted))}
                </Button>}
              </> : <p className="subtle">{t("ยังไม่มีเคสที่มีทั้งระดับเสนอและระดับยืนยัน")}</p>}
              {summary.raisedOnAppeal > 0 && <p className="subtle">{t("ปรับขึ้นหลังขอตรวจสอบ {0} เคส (แยกจากการทบทวนของ HR)", number(summary.raisedOnAppeal))}</p>}
              {summary.reviewed > 0 && <Button variant="text" onClick={() => filterBy({ manager: manager.id })}>{t("ดูเคสของ Manager คนนี้")}</Button>}
            </div>
          </article>;
        })}</div>
        <p className="subtle">{t("ใช้จำนวนเคสประกอบการอ่านกราฟ และเปิดดูหลักฐานก่อนสรุปเรื่องความเข้มหรือความผ่อนในการให้คะแนน")}</p>
      </> : <p className="empty">{t("ยังไม่มีกลุ่มพนักงานในรอบนี้")}</p>}
    </Panel>
    {selected && <div className="comparison-case-list" ref={caseList} tabIndex={-1}><Panel title={t("รายการประเมินในกลุ่ม")} description={active
      ? `${active.manager.name} · ${filters.adjusted ? t("เคสที่ปรับระดับ") : filters.rating === undefined
        ? t("ทุกระดับผลงาน") : `${t("พฤติกรรม")} · ${showLevel(filters.rating)}`}`
      : t("แสดง {0} จาก {1} คน", shown.length, cases.length)}
      actions={active && <Button variant="secondary" onClick={() => filterBy({ manager: "" })}>{t("ดูทุกเคสในกลุ่ม")}</Button>}>
      {shown.length ? <div className="scroll"><table><thead><tr>
        {[t("พนักงาน"), "Manager", t("ผลลัพธ์งาน"), t("พฤติกรรม"), t("ระดับเสนอ"), t("ระดับที่ HR ยืนยัน"),
          t("ผลต่าง"), t("หลักฐาน")].map(label => <th key={label} scope="col">{label}</th>)}
      </tr></thead><tbody>{shown.map(entry => <tr key={entry.person.id}>
        <td><PersonLabel person={entry.person} /></td>
        <td>{summaries.find(summary => summary.manager.id === entry.managerId)?.manager.name}</td>
        <td>{showLevel(entry.workScore)}</td><td>{showLevel(entry.managerRating)}</td>
        <td>{entry.before ?? "—"}</td><td>{entry.final ?? "—"}</td>
        <td>{entry.adjustment === undefined ? "—" : `${entry.adjustment > 0 ? "+" : ""}${entry.adjustment}`}</td>
        <td><Button variant="text" onClick={() => onOpen(entry.person.id)}>{t("ดูหลักฐานและเหตุผล")}</Button></td>
      </tr>)}</tbody></table></div> : <p className="empty">{t("ยังไม่มีคะแนนที่ส่งในกลุ่มนี้")}</p>}
    </Panel></div>}
  </>;
}

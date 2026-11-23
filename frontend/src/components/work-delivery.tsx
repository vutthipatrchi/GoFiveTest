import type { ReactNode } from "react";
import { t } from "../i18n";
import { deliveryMetrics, sourceDeliveryRate, workDateTime, workStatus } from "../domain/work";
import type { WorkSource } from "../types";
import { date, number } from "../utils/format";
import { Panel } from "./ui";

const timingLabels = {
  "on-time": "ส่งทัน", late: "ส่งช้า", overdue: "ยังไม่ส่งและเลยกำหนด", pending: "ยังไม่ส่ง",
};

function share(part: number, total: number) {
  return total ? t("{0}% · {1}/{2} งาน", number(part * 100 / total), part, total) : t("ยังไม่มีข้อมูล");
}

/** Inside a KPI card, also shows a waiting state when the source has nothing to measure yet. */
export function WorkDelivery({ source, linked, recordedRate, embedded = false, id, footer }: {
  source?: WorkSource; linked: boolean; recordedRate?: number; embedded?: boolean; id?: string; footer?: ReactNode;
}) {
  if (!source?.records.length) {
    if (!embedded && !source) return null;
    if (embedded) return <div className="kpi-evidence" id={id} tabIndex={-1}>
      <div className="kpi-evidence-head"><strong>{t("หลักฐานจากระบบงานจำลอง")}</strong></div>
      <p className="subtle">{t("รอข้อมูลจากระบบงาน")}</p>
      {footer && <div className="kpi-evidence-footer">{footer}</div>}
    </div>;
  }
  const loaded = source as WorkSource;
  const asOf = new Date(loaded.asOf);
  const metrics = deliveryMetrics(loaded.records, asOf);
  const sourceRate = sourceDeliveryRate(loaded);
  const differsFromRecord = recordedRate !== undefined && sourceRate !== null && Math.abs(recordedRate - sourceRate) > 0.001;
  const range = t("ข้อมูลตั้งแต่ {0} ถึง {1}", date(loaded.from), workDateTime(loaded.asOf));
  const linkedPill = linked && <span className="pill green">{t("ใช้เป็นผลจริงของ KPI แล้ว")}</span>;
  const body = <>
    {differsFromRecord && <p className="form-tip">{t("ผล KPI ที่บันทึกในรอบนี้คือ {0}% และคะแนนของรอบนี้ยังใช้ค่านี้", number(recordedRate))}</p>}
    {embedded && !metrics.timed && <p className="subtle">{t("รอข้อมูลจากระบบงาน")}</p>}
      <dl className="delivery-metrics">
        <div><dt>{t("ส่งทันกำหนด")}</dt><dd>{share(metrics.onTime, metrics.timed)}</dd>
          <span className="subtle">{t("นับจากงานที่ถึงกำหนดในช่วงที่วัด")}</span></div>
        <div><dt>{t("ผ่านการตรวจครั้งแรก")}</dt><dd>{share(metrics.firstPass, metrics.reviewed)}</dd>
          <span className="subtle">{t("จากงานที่ตรวจครั้งแรกแล้ว · รอผลจากระบบต้นทาง {0} งาน · ข้อมูลประกอบ", metrics.pendingReview)}</span></div>
      </dl>
      <details className="delivery-history">
        <summary>{t("ดูรายการต้นทาง {0} งาน", loaded.records.length)}</summary>
        <ul className="dashboard-list delivery-list">{loaded.records.map((item, index) => {
        const status = workStatus(item, asOf);
        const first = item.attempts[0];
        const timingTone = status.timeliness === "on-time" ? "green" : status.timeliness === "pending" ? "" : "red";
        return <li key={index}>
          <div className="delivery-item">
            <h3>{item.title}</h3>
            <p className="feedback">{t("เกณฑ์ผ่าน ·") + " "}{item.standard}</p>
            <p className="subtle">{t("กำหนดส่ง") + " "}{workDateTime(item.dueAt)}{first && t(" · ส่งครั้งแรก {0}", workDateTime(first.submittedAt))}</p>
            <div className="actions">
              <span className={`pill ${timingTone}`}>{t(timingLabels[status.timeliness])}</span>
              {!status.dueForMeasurement && <span className="pill">{t("ยังไม่ถึงกำหนด ณ วันที่ดึงข้อมูล")}</span>}
              {status.pendingReview && <span className="pill amber">{t("รอผลตรวจจากระบบต้นทาง")}</span>}
              {status.quality && <span className={`pill ${status.quality === "approved" ? "green" : "amber"}`}>{status.quality === "approved" ? t("ผ่านครั้งแรก") : t("ต้องแก้ไขหลังตรวจครั้งแรก")}</span>}
              {status.reviewedAfterChanges && <span className="pill green">{t("ผ่านหลังแก้ไข")}</span>}
            </div>
            {first && <details className="delivery-history"><summary>{t("ดูการส่งงานและผลตรวจ") + " "}{item.attempts.length}{" " + t("ครั้ง")}</summary>
              <ol>{item.attempts.map((attempt, attemptIndex) => <li key={attemptIndex}>
                <p className="subtle">{workDateTime(attempt.submittedAt)}</p>
                <p className="feedback">{t("หลักฐาน ·") + " "}{attempt.evidence}</p>
                {attempt.review && <p className="feedback">{attempt.review.decision === "approved" ? t("อนุมัติ") : t("ส่งกลับ")} · {attempt.review.notes}</p>}
              </li>)}</ol>
            </details>}
          </div>
        </li>;
      })}</ul>
      </details>
  </>;
  if (embedded) return <div className="kpi-evidence" id={id} tabIndex={-1}>
    <div className="kpi-evidence-head">
      <div><strong>{t("หลักฐานจากระบบงานจำลอง")}</strong><div className="subtle">{range}</div></div>
      {linkedPill}
    </div>
    {body}
    {footer && <div className="kpi-evidence-footer">{footer}</div>}
  </div>;
  return <Panel title={t("ผลงานจากระบบงานจำลอง")} description={range}>
    {linkedPill && <p>{linkedPill}</p>}
    {body}
  </Panel>;
}

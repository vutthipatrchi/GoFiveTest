import { t } from "../i18n";
import { useId, useState, type ReactNode } from "react";
import type { Goal } from "../types";
import { number } from "../utils/format";

interface Slice {
  id: string;
  label: string;
  value: number;
  text: string;
  color: string;
}

function sector(start: number, turn: number) {
  if (turn >= 1) return undefined;
  const steps = Math.ceil(turn * 120);
  const points = Array.from({ length: steps + 1 }, (_, index) => {
    const angle = (start + turn * index / steps) * 2 * Math.PI;
    return `${50 + 50 * Math.sin(angle)}% ${50 - 50 * Math.cos(angle)}%`;
  });
  return `polygon(50% 50%, ${points.join(", ")})`;
}

function PieChart({ label, slices, children }: {
  label: string; slices: Slice[]; children: (slice: Slice) => ReactNode;
}) {
  const [selection, setSelection] = useState<string>();
  const detailId = useId();
  const selected = slices.find(slice => slice.id === selection);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  let start = 0;
  const sectors = slices.filter(slice => slice.value > 0).map(slice => {
    const turn = slice.value / total;
    const clipPath = sector(start, turn);
    start += turn;
    return { ...slice, clipPath };
  });
  const toggle = (id: string) => setSelection(current => current === id ? undefined : id);

  return <div className="pie-chart" role="group" aria-label={label}>
    <div className="pie-layout">
      <div className="pie-disc">
        {sectors.map(slice => <button type="button" key={slice.id} className="pie-slice"
          style={{ backgroundColor: slice.color, clipPath: slice.clipPath }}
          aria-label={`${slice.label} ${slice.text}`} aria-controls={detailId}
          aria-expanded={selection === slice.id} onClick={() => toggle(slice.id)} />)}
        {!total && <span className="pie-empty">{t("ไม่มีรายการ")}</span>}
      </div>
      <ul className="pie-legend">
        {slices.map(slice => <li key={slice.id}>
          <button type="button" className="pie-legend-button" aria-expanded={selection === slice.id}
            aria-controls={detailId} onClick={() => toggle(slice.id)}>
            <span className="pie-swatch" style={{ backgroundColor: slice.color }} aria-hidden="true" />
            <span>{slice.label}</span><strong>{slice.text}</strong>
          </button>
        </li>)}
      </ul>
    </div>
    <div className="pie-detail" id={detailId} hidden={!selected}>{selected && children(selected)}</div>
  </div>;
}

export function GoalChart({ goal }: { goal: Goal }) {
  if (goal.unmeasured) return <>
    <p className="subtle">{t("ยังไม่บันทึกผลจริง · เป้าหมาย") + " "}{number(goal.target)} {t(goal.unit)}</p>
    {goal.cutoffs && <p className="subtle">{t("เกณฑ์ระดับ 2–5 ·") + " "}{goal.cutoffs.map(number).join(" / ")} {t(goal.unit)}</p>}
  </>;
  const lower = goal.direction === "lower";
  const ratio = lower
    ? (goal.actual <= goal.target ? 1 : goal.target / goal.actual)
    : (goal.target > 0 ? goal.actual / goal.target : 1);
  const reached = Math.min(100, Math.max(0, ratio * 100));
  const remaining = 100 - reached;
  const slices = [
    { id: "reached", label: t("สัดส่วนที่ทำได้"), value: reached, text: `${number(reached)}%`, color: "#d4520f" },
    { id: "remaining", label: t("ส่วนที่ยังไม่ถึงเป้า"), value: remaining, text: `${number(remaining)}%`, color: "#fbd9c2" },
  ];
  return <>
    <p className="subtle pie-comparison">{t("ผลจริง") + " "}<strong>{number(goal.actual)} {t(goal.unit)}</strong>{" " + t("· เป้าหมาย") + " "}<strong>{number(goal.target)} {t(goal.unit)}</strong></p>
    <PieChart label={t("ความคืบหน้า KPI · {0}", t(goal.name))} slices={slices}>
      {slice => <>
        <h4>{slice.label} · {slice.text}</h4>
        {slice.id === "remaining" && <p>{t("ห่างจากเป้าหมาย") + " "}{number(lower ? Math.max(0, goal.actual - goal.target) : Math.max(0, goal.target - goal.actual))} {t(goal.unit)}</p>}
        <p>{t("เกณฑ์เข้าแต่ละระดับ (2–5) ·") + " "}{(goal.cutoffs ?? [goal.target * .75, goal.target, goal.target * 1.1, goal.target * 1.25]).map(number).join(" / ")} {t(goal.unit)}</p>
        <p>{t("ช่วงที่วัด ·") + " "}{goal.period || t("ยังไม่ระบุ")}</p>
        <p>{t("หลักฐาน ·") + " "}{t(goal.evidence || "ยังไม่มีหลักฐานประกอบ")}</p>
      </>}
    </PieChart>
  </>;
}

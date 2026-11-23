import { t } from "../i18n";
import type { FormEvent, ReactNode } from "react";
import {
  feedbackGapThreshold, feedbackQuestions, feedbackSummary, minimumResponses, validRatings,
} from "../domain/manager-feedback";
import { managersInCycle, type Manager } from "../domain/managers";
import type { Cycle, FeedbackRatings, Role } from "../types";
import { number } from "../utils/format";
import { Button, Field, Heading, Panel } from "./ui";

export function ManagerFeedbackPage({ cycle, role, manager, employeeId, onSubmit, onCalibration, comparison }: {
  cycle: Cycle; role: Role; manager?: Manager; employeeId?: string;
  onSubmit: (ratings: FeedbackRatings) => void; onCalibration: () => void;
  comparison?: ReactNode;
}) {
  if (role === "hr") return <>
    <Heading title={t("ทบทวนวิธีประเมินของ Manager")} description={t(cycle.name)} />
    {comparison}
    <Panel title={t("สัญญาณที่ควรตรวจเพิ่ม")} description={t("แสดงคะแนนรวมเมื่อมีลูกทีมตอบอย่างน้อย {0} คน · ผลต่างตั้งแต่ {1} คะแนนขึ้นไปจะเปิดเคสทบทวน", minimumResponses, feedbackGapThreshold)}
      actions={<Button variant="secondary" onClick={onCalibration}>{t("ไปที่ทบทวนมาตรฐานคะแนน")}</Button>}>
      <div className="scroll"><table><thead><tr>
        <th>{t("ผู้ประเมิน / ตำแหน่ง")}</th><th>{t("จำนวนผู้ตอบ")}</th><th>{t("Manager ประเมินตนเอง")}</th><th>{t("ค่าเฉลี่ยลูกทีม")}</th><th>{t("ผลต่าง")}</th><th>{t("สถานะ")}</th>
      </tr></thead><tbody>{managersInCycle(cycle).map(reviewer => {
        const summary = feedbackSummary(cycle, reviewer.id);
        const label = summary.teamMean === null ? t("ข้อมูลลูกทีมไม่เพียงพอ")
          : summary.self === null ? t("รอ Manager ประเมินตนเอง")
            : summary.flagged ? t("ควรทบทวนเพิ่ม") : t("ผลต่างต่ำกว่าเกณฑ์");
        return <tr key={reviewer.id}>
          <td><strong>{reviewer.name}</strong><div className="subtle">{reviewer.title}</div></td>
          <td>{summary.count}{" " + t("คน")}</td><td>{summary.self === null ? "—" : `${number(summary.self)} / 5`}</td>
          <td>{summary.teamMean === null ? "—" : `${number(summary.teamMean)} / 5`}</td>
          <td>{summary.gap === null ? "—" : number(summary.gap)}</td>
          <td><span className={`pill ${summary.flagged ? "amber" : ""}`}>{label}</span></td>
        </tr>;
      })}</tbody></table></div>
      <p className="subtle">{t("ข้อมูลนี้ใช้เลือกกรณีที่ควรดูหลักฐานของพนักงานเพิ่ม โดยไม่มีผลต่อสูตรคะแนน")}</p>
    </Panel>
  </>;
  if (!manager || (role === "employee" && !employeeId)) return <Heading title={t("ยังไม่พบ Manager ของคุณ")} description={t("ตรวจสอบทีมที่เข้าร่วมรอบกับ HR")} />;
  const entry = cycle.managerFeedback?.[manager.id];
  const isSelf = role === "manager";
  const submitted = isSelf ? !!entry?.self : !!employeeId && entry?.respondedIds.includes(employeeId);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const ratings = feedbackQuestions.map((_, index) => Number(form.get(`rating-${index}`)));
    if (validRatings(ratings)) onSubmit(ratings);
  };
  return <>
    <Heading title={isSelf ? t("ประเมินวิธีให้คะแนนของตนเอง") : t("ให้ feedback ต่อ Manager")}
      description={`${manager.name} · ${manager.title}`} />
    <Panel title={t("การสื่อสารเกณฑ์ ข้อเสนอแนะ และหลักฐาน")}
      description={isSelf ? t("ประเมินพฤติกรรมของคุณในรอบนี้") : t("HR เห็นเฉพาะผลรวมเมื่อมีผู้ตอบอย่างน้อย {0} คน", minimumResponses)}>
      {submitted ? <p className="form-tip">{t("ส่งแบบประเมินสำหรับรอบนี้แล้ว")}</p>
        : cycle.status === "closed" ? <p className="empty">{t("ปิดรอบประเมินแล้ว")}</p>
        : <form className="inline-form" key={`${role}-${manager.id}-${employeeId ?? ""}`} onSubmit={submit}>
          <p className="subtle">{t("ให้คะแนนจากสิ่งที่สังเกตได้ในรอบนี้ ตั้งแต่ 1 = ไม่เคย ถึง 5 = สม่ำเสมอ")}</p>
          {feedbackQuestions.map((question, index) => <Field key={question} label={t(question)}>
            <select name={`rating-${index}`} defaultValue="" required>
              <option value="">{t("เลือกคำตอบ")}</option>
              {[t("ไม่เคย"), t("นาน ๆ ครั้ง"), t("บางครั้ง"), t("บ่อยครั้ง"), t("สม่ำเสมอ")].map((label, rating) =>
                <option value={rating + 1} key={label}>{rating + 1} · {label}</option>)}
            </select>
          </Field>)}
          <div className="actions"><Button type="submit">{t("ส่งแบบประเมิน")}</Button></div>
        </form>}
    </Panel>
  </>;
}

import { t } from "../i18n";
import { useState, type FormEvent, type ReactNode } from "react";
import { demoDate } from "../config";
import { canReviewBehavior, overdue, proposal, reviewFlag, reviewReadyToSend, score } from "../domain/kpi";
import { awaitingSecondReview, hasCurrentSecondReview } from "../domain/manager-feedback";
import { managerForPerson } from "../domain/managers";
import { reviewExceptions, routineNext, routineReason } from "../domain/hr-batch";
import { currentCalibration, snapshotCalibration } from "../domain/performance";
import { refreshMissingResults } from "../domain/work-sync";
import { approvalDays, approvalDue, approvalOverdue, bangkokDay } from "../domain/submission";
import type { Cycle, Person, Role } from "../types";
import { date, number, showLevel } from "../utils/format";
import { readField } from "./overview";
import { ResultCard, type PersonAction } from "./person";
import { Button, Field, LevelSelect, TextField } from "./ui";
import { goalPlanAction } from "./goal-plan";
import { appealAction, isAppealAction } from "./appeal-actions";

export interface FormSpec {
  title: string;
  label: string;
  content: ReactNode;
  validate?: (form: FormData) => string | undefined;
  save: (form: FormData) => void;
}

type Update = (message: string, change: (person: Person) => void) => void;

export function ActionForm({ spec, onClose }: { spec: FormSpec; onClose: () => void }) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    for (const control of event.currentTarget.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("textarea[required], input[required]")) {
      if (!control.value.trim()) {
        control.setCustomValidity(t("กรุณากรอกข้อมูล"));
        control.reportValidity();
        control.addEventListener("input", () => control.setCustomValidity(""), { once: true });
        return;
      }
    }
    const message = spec.validate?.(form);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    spec.save(form);
  }
  return <>
    <div className="modal-head"><h2 id="modal-title">{spec.title}</h2><Button variant="text" onClick={onClose}>{t("ปิด")}</Button></div>
    <form className="inline-form" onSubmit={submit}>
      {spec.content}{error && <p className="form-tip" role="alert">{error}</p>}<div className="actions">
        <Button type="submit">{spec.label}</Button><Button variant="secondary" onClick={onClose}>{t("ยกเลิก")}</Button>
      </div>
    </form>
  </>;
}

function DecisionFields({ routine, proposedLevel, initialLevel, children }: {
  routine: boolean; proposedLevel: number; initialLevel: number; children: ReactNode;
}) {
  const [level, setLevel] = useState(initialLevel);
  const detailed = !routine || level !== proposedLevel;
  return <div className="stack" onChange={event => {
    const control = event.target;
    if (control instanceof HTMLSelectElement && control.name === "level") setLevel(Number(control.value));
  }}>
    <Field label={t("ระดับสุดท้าย")}><LevelSelect value={initialLevel} /></Field>
    {detailed ? children : <p className="form-tip">{t("เคสปกติ · ยืนยันตามระดับที่เสนอได้เลย ถ้าเปลี่ยนระดับ ระบบจะถามเหตุผลเพิ่ม")}</p>}
  </div>;
}

export function personAction(person: Person, cycle: Cycle, role: Role, action: PersonAction, update: Update, index?: number, today = bangkokDay): FormSpec | undefined {
  if (isAppealAction(action)) return appealAction(person, cycle, role, action, update, today);
  if (cycle.status === "closed" && !(role === "employee" && action === "acknowledge")) return;
  if (action === "assign-goals" || action === "ask-plan" || action === "answer-plan-question") return goalPlanAction(person, cycle, role, action, update, today);
  if (cycle.status === "draft") return;
  if (action === "report-kpi" && role === "employee" && person.status === "employee" && person.goals.length) {
    return {
      title: t("แจ้งข้อมูลคลาดเคลื่อน"), label: t("ส่งให้หัวหน้าตรวจสอบ"),
      content: <>
        <Field label={t("KPI ที่ต้องการแจ้ง")}><select name="goal" defaultValue={index ?? ""} required>
          <option value="" disabled>{t("เลือก KPI")}</option>
          {person.goals.map((goal, i) => <option key={i} value={i}>{t(goal.name)}</option>)}
        </select></Field>
        <TextField name="detail" label={t("ระบุงานหรือข้อมูลที่ขาดหรือคลาดเคลื่อน")} />
      </>,
      save: form => {
        const selected = readField(form, "goal");
        const goal = person.goals[Number(selected)];
        const detail = readField(form, "detail");
        if (!selected || !goal || !detail) return;
        update(t("ส่งให้หัวหน้าตรวจสอบแล้ว"), next => {
          (next.kpiIssues ??= []).push({ goalName: goal.name, detail, reportedOn: today() });
        });
      },
    };
  }
  if (action === "review-kpi" && role === "manager" && index !== undefined) {
    const issue = person.kpiIssues?.[index];
    if (!issue || issue.response) return;
    return {
      title: t("บันทึกผลตรวจสอบ"), label: t("แจ้งผลให้พนักงาน"),
      content: <><p>{t(issue.goalName)} · {issue.detail}</p><TextField name="response" label={t("ผลตรวจสอบและการแก้ไขที่ต้นทาง")} /></>,
      save: form => {
        const response = readField(form, "response");
        if (response) update(t("บันทึกผลตรวจสอบแล้ว"), next => {
          const report = next.kpiIssues?.[index];
          if (report) Object.assign(report, { response, reviewedOn: today() });
        });
      },
    };
  }
  const results = score(person);
  const proposed = proposal(person, cycle.resultWeight);
  if (role === "employee") return employeeForm(person, action, update, today);
  const submission = person.submission;
  if (role === "manager" && person.status === "approval" && submission) {
    if (action === "approve") return {
      title: t("อนุมัติสรุปผลงานปลายรอบ"), label: t("ยืนยันอนุมัติ"),
      content: <p>{t("เมื่ออนุมัติแล้ว คุณจะให้คะแนนและส่งผลให้ HR ได้")}</p>,
      save: () => update(t("Manager อนุมัติสรุปผลงานแล้ว"), next => {
        next.submission = { ...submission, decision: "approved", decidedOn: today() };
        next.status = "manager";
        next.reminded = false;
      }),
    };
    if (action === "decline") return {
      title: t("ส่งสรุปผลงานกลับให้แก้ไข"), label: t("ยืนยันส่งกลับ"),
      content: <><p className="form-tip">{t("พนักงานแก้ไขและส่งสรุปใหม่ได้ภายใน {0} หากเลยวันดังกล่าว ระบบจะแสดงสถานะเลยกำหนด", date(cycle.employeeDue))}</p>
        <TextField name="reason" label={t("เหตุผลและสิ่งที่ต้องแก้ไข")} /></>,
      save: form => {
        const reason = readField(form, "reason");
        update(t("Manager ไม่อนุมัติและส่งกลับ · {0}", reason), next => {
          next.submission = { ...submission, decision: "declined", decidedOn: today(), reason };
          next.status = "employee";
          next.returnReason = reason;
          next.reminded = false;
        });
      },
    };
  }
  if (role === "manager" && action === "review" && canReviewBehavior(person, cycle)) {
    const saved = person.reviewDraft ?? person.review;
    const canSend = reviewReadyToSend(person);
    const entry = (form: FormData) => ({ rating: Number(readField(form, "level")), feedback: readField(form, "feedback"), next: readField(form, "next") });
    return {
      title: t("ประเมินพฤติกรรม"), label: canSend ? t("ส่งผลให้ HR") : t("บันทึกคะแนนพฤติกรรม"),
      content: <>
        <p className="form-tip">{t("ผลลัพธ์งาน") + " "}{showLevel(results)}{" " + t("· น้ำหนักพฤติกรรม") + " "}{100 - cycle.resultWeight}%</p>
        {!canSend && <p className="form-tip">{t("คะแนนนี้ยังไม่ส่งให้ HR เมื่อพนักงานส่งผลงานและคุณอนุมัติสรุปแล้ว จึงตรวจและส่งได้")}</p>}
        <Field label={t("พฤติกรรมตามเกณฑ์กลาง")}><LevelSelect value={saved?.rating} /></Field>
        <TextField name="feedback" label={t("เหตุการณ์ที่สังเกตได้และผลกระทบ")} value={saved?.feedback} />
        <TextField name="next" label={t("สิ่งที่ควรพัฒนาต่อ")} value={saved?.next} required={false} />
      </>,
      save: form => canSend
        ? update(t("ส่งผลประเมินให้ HR แล้ว"), next => {
          next.review = entry(form);
          delete next.reviewDraft;
          delete next.secondReview;
          next.status = "hr";
          delete next.returnReason;
        })
        : update(t("Manager บันทึกคะแนนพฤติกรรมไว้ก่อนส่ง HR"), next => { next.reviewDraft = entry(form); }),
    };
  }
  if (role !== "hr") return;
  const pending = ["hr", "decided"].includes(person.status);
  if (action === "second-review" && pending && person.review) {
    const manager = managerForPerson(cycle, person).name;
    return {
      title: t("บันทึกความเห็นผู้ทบทวนคนที่สอง"), label: t("บันทึกการทบทวน"),
      content: <>
        <p className="form-tip">{t("คะแนนพฤติกรรมจาก") + " "}{manager} · {showLevel(person.review.rating)}{" " + t("ให้ผู้ทบทวนอีกคนใช้เกณฑ์เดียวกันและตรวจหลักฐานรายบุคคล")}</p>
        <Field label={t("ชื่อผู้ทบทวนคนที่สอง")}><input name="reviewer" maxLength={100} defaultValue={person.secondReview?.reviewer} required /></Field>
        <Field label={t("คะแนนพฤติกรรมตามเกณฑ์กลาง")}><LevelSelect value={person.secondReview?.rating} /></Field>
        <TextField name="evidence" label={t("หลักฐานและเหตุผลประกอบคะแนน")} value={person.secondReview?.evidence} />
      </>,
      validate: form => readField(form, "reviewer").toLocaleLowerCase() === manager?.trim().toLocaleLowerCase()
        ? t("ผู้ทบทวนต้องเป็นคนละคนกับ Manager ที่ให้คะแนนเดิม") : undefined,
      save: form => {
        const reviewer = readField(form, "reviewer");
        const rating = Number(readField(form, "level"));
        const evidence = readField(form, "evidence");
        if (!reviewer || reviewer.toLocaleLowerCase() === manager?.trim().toLocaleLowerCase() ||
          ![1, 2, 3, 4, 5].includes(rating) || !evidence) return;
        update(t("ทบทวนพฤติกรรมครั้งที่สองโดย {0} · {1}/5 · {2}", reviewer, rating, evidence), next => {
          next.secondReview = { reviewer, rating, evidence, at: new Date().toISOString() };
        });
      },
    };
  }
  if (action === "refresh-kpi" && pending) {
    const refreshed = refreshMissingResults(person);
    if (refreshed !== person) update(t("ดึงข้อมูล KPI จากระบบงานแล้ว"), next => { next.goals = refreshed.goals; });
    return;
  }
  if (action === "return" && pending) {
    return {
      title: results === null ? t("ส่งให้ Manager ตรวจข้อมูล KPI") : t("ส่งกลับให้ Manager ทบทวน"), label: t("ส่งกลับ"),
      content: <TextField name="reason" label={t("ข้อมูลที่ต้องเพิ่มหรือเหตุผล")} />,
      save: form => {
        const reason = readField(form, "reason");
        update(t("ส่งกลับให้ทบทวน · {0}", reason), next => {
          next.returnReason = reason;
          next.status = "returned";
          delete next.decision;
          delete next.secondReview;
        });
      },
    };
  }
  const managerReview = person.review;
  if (action === "decide" && pending && proposed && results !== null && managerReview && !awaitingSecondReview(person, cycle)) {
    const prior = currentCalibration(person);
    const evidence = person.goals.map((goal, index) => ({
      id: `kpi-${index}`, label: t(goal.name), detail: t(goal.evidence ?? ""),
      checked: prior?.kpis.find(item => item.goal.name === goal.name)?.cited,
    }));
    if (managerReview.feedback?.trim()) evidence.push({
      id: "manager", label: t("หลักฐานพฤติกรรมจาก Manager"), detail: managerReview.feedback, checked: prior?.manager.cited,
    });
    if (person.secondReview?.evidence) evidence.push({
      id: "second-review", label: t("หลักฐานจากผู้ทบทวนคนที่สอง"), detail: person.secondReview.evidence, checked: prior?.secondReview?.cited,
    });
    const citedEvidence = (form: FormData) => {
      const selected = new Set(form.getAll("evidence-source"));
      return new Set(evidence.filter(item => selected.has(item.id)).map(item => item.id));
    };
    // A routine case confirmed at its proposed level needs only a name. Exceptions and changed levels need the full rationale.
    const routine = reviewExceptions(person, cycle).length === 0;
    const needsRationale = (form: FormData) => !routine || Number(readField(form, "level")) !== proposed.level;
    const validate = (form: FormData) => {
      if (!readField(form, "reviewer")) return t("ระบุชื่อผู้ยืนยันผล");
      if (![1, 2, 3, 4, 5].includes(Number(readField(form, "level")))) return t("เลือกระดับ");
      if (!needsRationale(form)) return;
      if (!citedEvidence(form).size) return t("เลือกหลักฐานประกอบการตัดสินใจอย่างน้อยหนึ่งรายการ");
      if (["reason", "next", "followUp"].some(field => !readField(form, field))) return t("กรุณากรอกข้อมูล");
    };
    return {
      title: t("ยืนยันหรือปรับระดับผลงาน"), label: t("บันทึกระดับสุดท้าย"),
      content: <>
        <p className="form-tip">{t("ผลลัพธ์งาน") + " "}{showLevel(results)}{" " + t("· พฤติกรรม") + " "}{showLevel(person.review?.rating)}<br />{t("คะแนนเสนอ") + " "}{proposed.overall.toFixed(2)}{" " + t("/ 5 · ระดับ") + " "}{proposed.level}<br />{reviewFlag(person, cycle.resultWeight)}</p>
        {person.secondReview && <p className="form-tip">{t("ผู้ทบทวนคนที่สองเสนอพฤติกรรม") + " "}{showLevel(person.secondReview.rating)} · {person.secondReview.evidence}</p>}
        <p className="subtle">{t("กลุ่มเปรียบเทียบ")} · {t(person.cohort)}</p>
        <Field label={t("ชื่อผู้ยืนยันผล (HR)")}><input name="reviewer" maxLength={100} defaultValue={prior?.reviewer} required /></Field>
        <DecisionFields routine={routine} proposedLevel={proposed.level} initialLevel={person.decision?.level ?? proposed.level}>
          <fieldset className="calibration-evidence">
            <legend>{t("หลักฐานที่ใช้อ้างอิง")}</legend>
            {evidence.map(item => <label key={item.id}>
              <input type="checkbox" name="evidence-source" value={item.id} defaultChecked={item.checked} />
              <span><strong>{item.label}</strong><span className="subtle">{item.detail}</span></span>
            </label>)}
          </fieldset>
          <TextField name="reason" label={t("เหตุผลอ้างอิงหลักฐานและผลกระทบ")} value={person.decision?.reason} />
          <TextField name="next" label={t("โอกาสต่อยอด หรือแผนสนับสนุนและพัฒนา")} value={person.decision?.next ?? person.review?.next} />
          <Field label={t("วันติดตามผล")}><input type="date" name="followUp" min={demoDate} defaultValue={person.decision?.followUp} required /></Field>
        </DecisionFields>
      </>,
      validate,
      save: form => {
        if (validate(form)) return;
        const detailed = needsRationale(form);
        const reason = detailed ? readField(form, "reason") : routineReason();
        const level = Number(readField(form, "level"));
        const reviewer = readField(form, "reviewer");
        const citations = detailed ? citedEvidence(form) : new Set(evidence.map(item => item.id));
        const record = snapshotCalibration(person, {
          id: String((person.calibrationHistory?.length ?? 0) + 1), at: new Date().toISOString(), reviewer, proposed,
          finalLevel: level, reason, resultWeight: cycle.resultWeight, workScore: results,
          manager: { name: managerForPerson(cycle, person).name, rating: managerReview.rating,
            feedback: managerReview.feedback, cited: citations.has("manager") },
        }, citations);
        const previous = person.decision?.level ? t(" (เดิม {0})", person.decision.level) : "";
        update(t("ทบทวนระดับเสนอ {0} → ระดับสุดท้าย {1}{2} · {3}", proposed.level, level, previous, reason), next => {
          next.decision = { level, proposed: proposed.level, reason,
            next: detailed ? readField(form, "next") : managerReview.next || routineNext(),
            ...(detailed && { followUp: readField(form, "followUp") }), secondReviewAt: person.secondReview?.at, calibrationId: record.id };
          next.calibrationHistory = [record, ...(next.calibrationHistory ?? [])];
          next.status = "decided";
        });
      },
    };
  }
  if (action === "publish" && person.status === "decided" && proposed && person.decision?.level && hasCurrentSecondReview(person, cycle)) {
    return {
      title: t("เผยแพร่ผลประเมิน"), label: t("ยืนยันเผยแพร่"), content: <ResultCard person={person} />,
      save: () => update(t("เผยแพร่ผลให้พนักงานแล้ว"), next => { next.status = "published"; next.publishedOn = today(); }),
    };
  }
  if ((overdue(person) || approvalOverdue(person, today())) && action === "remind") {
    update(t("บันทึกการเตือน {0} (จำลอง)", managerForPerson(cycle, person).name), next => { next.reminded = true; next.remindedAt = new Date().toISOString(); });
  }
  if (overdue(person) && action === "extend") {
    return {
      title: t("ขยายกำหนดส่ง"), label: t("บันทึกกำหนดส่ง"),
      content: <><Field label={t("กำหนดส่งใหม่")}><input type="date" name="due" min={demoDate} required /></Field><TextField name="reason" label={t("เหตุผล")} /></>,
      save: form => {
        const due = readField(form, "due");
        update(t("ขยายกำหนดจาก {0} เป็น {1} · {2}", date(person.due), date(due), readField(form, "reason")), next => { next.due = due; });
      },
    };
  }
}

function employeeForm(person: Person, action: PersonAction, update: Update, today: () => string): FormSpec | undefined {
  if (person.status === "published") {
    if (action === "acknowledge" && !person.acknowledged) {
      update(t("รับทราบผลแล้ว"), next => { next.acknowledged = true; });
    }
    return;
  }
  if (person.status !== "employee") return;
  if (action === "submit" && !person.goalAssignment && score(person) !== null) {
    return {
      title: t("ส่งสรุปผลงานให้ Manager"), label: t("ยืนยันการส่ง"),
      content: <><TextField name="summary" label={t("สรุปผลงาน จุดแข็ง และสิ่งที่อยากพัฒนา")} value={person.summary} />
        <p className="form-tip">{t("Manager มีเวลาอนุมัติ") + " "}{approvalDays}{" " + t("วันปฏิทินนับจากวันที่ส่ง")}</p></>,
      save: form => update(t("ส่งสรุปผลงานให้ Manager อนุมัติแล้ว"), next => {
        const submittedOn = today();
        next.summary = readField(form, "summary");
        next.submission = { submittedOn, approvalDue: approvalDue(submittedOn) };
        next.status = "approval";
        next.reminded = false;
        delete next.returnReason;
      }),
    };
  }
}

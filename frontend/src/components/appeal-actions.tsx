import { t } from "../i18n";
import { rubric } from "../config";
import { appealDue, appealGrounds, awaitingClarification, canRequestAppeal, isIndependentReviewer, isPendingAppeal, raisableLevels } from "../domain/appeals";
import { category } from "../domain/kpi";
import { managerForPerson } from "../domain/managers";
import type { AppealGround, Cycle, Person, Role } from "../types";
import { date } from "../utils/format";
import type { FormSpec } from "./actions";
import { readField } from "./overview";
import { Field, TextField } from "./ui";

export const appealActions = ["appeal", "request-clarification", "clarify-appeal", "resolve-appeal"] as const;
export type AppealAction = (typeof appealActions)[number];
type Update = (message: string, change: (person: Person) => void) => void;

export const isAppealAction = (action: string): action is AppealAction => appealActions.some(item => item === action);

function requestForm(person: Person, update: Update, today: () => string): FormSpec {
  const validate = (form: FormData) => {
    const ground = readField(form, "ground");
    if (!appealGrounds.some(item => item.id === ground)) return t("เลือกเหตุผลที่ขอตรวจสอบ");
    if (!readField(form, "reason") || !readField(form, "evidence")) return t("กรุณากรอกข้อมูล");
    if (ground !== "fairness" && form.get("discussed") !== "yes") return t("คุยผลกับ Manager แบบ 1:1 ก่อนส่งคำขอ");
  };
  return {
    title: t("ขอตรวจสอบผล"), label: t("ส่งคำขอ"),
    content: <>
      <p className="form-tip">{t("รับเฉพาะเรื่องที่ตรวจสอบได้ ยื่นได้ 1 ครั้งต่อรอบ ผลจะไม่ลดลงจากการยื่นคำขอ")}</p>
      <Field label={t("เหตุผลที่ขอตรวจสอบ")}><select name="ground" defaultValue="" required>
        <option value="">{t("เลือกเหตุผล")}</option>
        {appealGrounds.map(ground => <option key={ground.id} value={ground.id}>{t(ground.label)}</option>)}
      </select></Field>
      <TextField name="reason" label={t("ประเด็นที่ต้องการให้ตรวจ")} />
      <TextField name="evidence" label={t("หลักฐานหรือข้อมูลที่เกี่ยวข้อง")} />
      <label className="team-choice"><input type="checkbox" name="discussed" value="yes" /> {t("คุยผลกับ Manager แบบ 1:1 แล้ว")}</label>
      <p className="subtle">{t("หากเป็นเรื่องอคติหรือความไม่เป็นธรรม ไม่ต้องคุยกับ Manager ก่อน และ Manager จะไม่เห็นรายละเอียดคำขอ")}</p>
    </>,
    validate,
    save: form => {
      if (validate(form)) return;
      const ground = readField(form, "ground") as AppealGround;
      const appeal = {
        reason: readField(form, "reason"), evidence: readField(form, "evidence"), ground,
        discussedWithManager: form.get("discussed") === "yes", submittedOn: today(),
      };
      update(t("ส่งคำขอตรวจสอบผลแล้ว"), next => { next.appeal = appeal; });
    },
  };
}

function resolveForm(person: Person, cycle: Cycle, update: Update, today: () => string): FormSpec | undefined {
  const appeal = person.appeal;
  const level = person.decision?.level;
  if (!appeal || !level) return;
  const manager = managerForPerson(cycle, person).name;
  const options = raisableLevels(level);
  const validate = (form: FormData) => {
    if (!isIndependentReviewer(readField(form, "reviewer"), person, manager)) return t("ผู้พิจารณาต้องไม่ใช่ Manager เจ้าของคะแนนหรือ HR ที่ยืนยันผลเดิม");
    const outcome = readField(form, "outcome");
    if (outcome !== "kept" && outcome !== "raised") return t("เลือกผลการพิจารณา");
    if (outcome === "raised" && !options.includes(Number(readField(form, "level")))) return t("เลือกระดับใหม่ที่สูงกว่าระดับเดิม");
    if (!readField(form, "response")) return t("กรุณากรอกข้อมูล");
  };
  return {
    title: t("พิจารณาคำขอตรวจสอบ"), label: t("บันทึกและแจ้งผล"),
    content: <>
      <p className="form-tip">{t("ผลปัจจุบัน ·") + " "}{level} / 5 · {t(category(level))}</p>
      {awaitingClarification(person) && <p className="form-tip">{t("Manager ยังไม่ได้ชี้แจง หากบันทึกตอนนี้ คำถามจะปิดโดยไม่มีคำตอบ")}</p>}
      <Field label={t("ชื่อผู้พิจารณา (HR คนละคนกับผู้ยืนยันผลเดิม)")}><input name="reviewer" maxLength={100} required /></Field>
      <Field label={t("ผลการพิจารณา")}><select name="outcome" defaultValue="" required>
        <option value="">{t("เลือกผลการพิจารณา")}</option>
        <option value="kept">{t("คงผลเดิม")}</option>
        {options.length > 0 && <option value="raised">{t("ปรับผลขึ้น")}</option>}
      </select></Field>
      {options.length > 0 && <Field label={t("ระดับใหม่ (เฉพาะเมื่อปรับผลขึ้น)")}><select name="level" defaultValue="">
        <option value="">{t("เลือกระดับ")}</option>
        {options.map(option => <option key={option} value={option}>{option} · {t(rubric[option - 1])}</option>)}
      </select></Field>}
      <TextField name="response" label={t("ผลการตรวจสอบและเหตุผล")} />
    </>,
    validate,
    save: form => {
      if (validate(form)) return;
      const outcome = readField(form, "outcome") as "kept" | "raised";
      const finalLevel = outcome === "raised" ? Number(readField(form, "level")) : level;
      const resolved = {
        response: readField(form, "response"), reviewer: readField(form, "reviewer"), outcome,
        resolvedOn: today(), previousLevel: level, finalLevel,
      };
      update(outcome === "raised" ? t("ปรับผลจากคำขอตรวจสอบ {0} → {1}", level, finalLevel) : t("คงผลเดิมหลังตรวจสอบ"), next => {
        next.appeal = { ...appeal, ...resolved };
        if (outcome === "raised" && next.decision) {
          next.decision = { ...next.decision, level: finalLevel };
          next.acknowledged = false;
        }
      });
    },
  };
}

/** Appeal steps stay available after a round closes so a request is never stranded. */
export function appealAction(person: Person, cycle: Cycle, role: Role, action: AppealAction, update: Update, today: () => string): FormSpec | undefined {
  if (action === "appeal") return role === "employee" && canRequestAppeal(person, cycle, today()) ? requestForm(person, update, today) : undefined;
  if (!isPendingAppeal(person) || !person.appeal) return;
  const appeal = person.appeal;
  if (action === "request-clarification" && role === "hr" && !appeal.clarification) return {
    title: t("ขอคำชี้แจงจาก Manager"), label: t("ส่งคำถาม"),
    content: <>
      <p className="form-tip">{t("Manager จะเห็นเฉพาะคำถามนี้ ไม่เห็นข้อความในคำขอของพนักงาน")}</p>
      <TextField name="question" label={t("คำถามถึง Manager")} />
    </>,
    save: form => {
      const question = readField(form, "question");
      if (!question) return;
      update(t("HR ขอคำชี้แจงจาก Manager"), next => {
        next.appeal = { ...appeal, clarification: { question, requestedOn: today() } };
      });
    },
  };
  if (action === "clarify-appeal" && role === "manager" && appeal.clarification && !appeal.clarification.response) {
    const clarification = appeal.clarification;
    return {
      title: t("ชี้แจงต่อ HR"), label: t("ส่งคำชี้แจง"),
      content: <>
        <p className="feedback"><strong>{t("คำถามจาก HR")}</strong> · {clarification.question}</p>
        <p className="subtle">{t("ขอเมื่อ {0}", date(clarification.requestedOn))}</p>
        <TextField name="response" label={t("คำชี้แจงและหลักฐาน")} />
      </>,
      save: form => {
        const response = readField(form, "response");
        if (!response) return;
        update(t("Manager ชี้แจงต่อ HR แล้ว"), next => {
          next.appeal = { ...appeal, clarification: { ...clarification, response, respondedOn: today() } };
        });
      },
    };
  }
  if (action === "resolve-appeal" && role === "hr") return resolveForm(person, cycle, update, today);
}

export const appealDeadline = (person: Person) => person.publishedOn ? appealDue(person.publishedOn) : undefined;

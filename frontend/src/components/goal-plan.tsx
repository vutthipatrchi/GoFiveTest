import { t } from "../i18n";
import { useRef, useState } from "react";
import {
  currentPlan, goalCutoffs, goalProblem, matchesTemplateGoals,
  needsGoalAssignment, suggestedCutoffs, templateForTeam, toDefinition as goalDefinition, validateGoalPlan,
} from "../domain/goal-plan";
import { deliveryGoal } from "../domain/work";
import { applyPlan, canEditPlan, hasOpenPlanQuestion, planEditDue } from "../domain/plan-activation";
import { bangkokDay } from "../domain/submission";
import type { Cycle, GoalDefinition, GoalTemplateReference, KpiTemplate, Person, Role, Team } from "../types";
import { date, number } from "../utils/format";
import type { FormSpec } from "./actions";
import { readField } from "./overview";
import { Button, Field, Panel, TextField } from "./ui";

export type GoalPlanAction = "assign-goals" | "ask-plan" | "answer-plan-question";

interface Row {
  key: number; name: string; responsibility: string; unit: string; direction: "higher" | "lower";
  weight: string; target: string; level2: string; level4: string; level5: string;
  source: NonNullable<GoalDefinition["source"]>;
}

const text = (value?: number) => value === undefined || !Number.isFinite(value) ? "" : String(value);
const toRow = (goal: GoalDefinition | undefined, key: number): Row => {
  const [level2, , level4, level5] = goal ? goalCutoffs(goal) : [];
  return {
    key, name: goal?.name ?? "", responsibility: goal?.responsibility ?? "", unit: goal?.unit ?? "",
    direction: goal?.direction ?? "higher", weight: text(goal?.weight), target: text(goal?.target),
    level2: text(level2), level4: text(level4), level5: text(level5),
    source: goal && deliveryGoal(goal) ? "work-delivery" : "manual",
  };
};
const amount = (value: string) => value.trim() ? Number(value) : NaN;
const toDefinition = (row: Row): GoalDefinition => ({
  name: row.name.trim(), responsibility: row.responsibility.trim(), unit: row.unit.trim(), weight: amount(row.weight),
  direction: row.direction === "lower" ? "lower" : undefined, target: amount(row.target),
  source: row.source,
  cutoffs: [amount(row.level2), amount(row.target), amount(row.level4), amount(row.level5)],
});
const sum = (goals: GoalDefinition[]) => goals.reduce((total, goal) => total + (Number.isFinite(goal.weight) ? goal.weight : 0), 0);

function Ladder({ goal }: { goal: GoalDefinition }) {
  return <span className="subtle">{t("เกณฑ์ระดับ 2 → 5 ·") + " "}{goalCutoffs(goal).map(number).join(" → ")} {t(goal.unit)}</span>;
}

function sourceLabel(goal: GoalDefinition) {
  return deliveryGoal(goal) ? t("ระบบงาน · อัตราส่งทัน") : t("ระบบงาน · ผลตาม KPI");
}

function GoalEditor({ initial, intro, template, adjustmentReason }: {
  initial: GoalDefinition[]; intro: string;
  template?: KpiTemplate; adjustmentReason?: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => initial.length ? initial.map(toRow) : [toRow(undefined, 0)]);
  const [touched, setTouched] = useState<Set<number>>(() => new Set());
  const nextKey = useRef(Math.max(1, initial.length));
  const change = (key: number, patch: Partial<Row>) => {
    setRows(current => current.map(row => row.key === key ? { ...row, ...patch } : row));
    setTouched(current => new Set(current).add(key));
  };
  const total = sum(rows.map(toDefinition));
  const target = 100;
  const status = total === target ? "ok" : total > target ? "over" : "under";

  return <>
    {template && <div className="actions">
      <span className="pill blue">{t("แม่แบบ {0} · ฉบับ {1}", template.title, template.version)}</span>
      <Button variant="secondary" onClick={() => {
        setRows(template.goals.map(toRow));
        setTouched(new Set());
        nextKey.current = template.goals.length;
      }}>{t("ใช้แม่แบบกับแผนนี้")}</Button>
    </div>}
    <div className={`weight-meter ${status}`} role="status">
      <div className="weight-meter-head">
        <strong>{t("น้ำหนักรวม") + " "}{number(total)}% / 100%</strong>
        <span>{status === "ok" ? t("ครบ 100%") : total > target ? t("เกิน {0}%", number(total - target)) : t("ขาดอีก {0}%", number(target - total))}</span>
      </div>
      <div className="weight-track">
        <span className="weight-own" style={{ width: `${Math.max(0, Math.min(100, total))}%` }} />
      </div>
    </div>
    <p className="subtle">{intro}</p>

    <section className="goal-section">
      {rows.map((row, index) => {
        const id = row.key;
        const definition = toDefinition(row);
        const problem = touched.has(id) ? goalProblem(definition) : undefined;
        const canSuggest = Number.isFinite(definition.target) && definition.target > 0;
        const lower = row.direction === "lower";
        return <fieldset className="goal-card" key={id}>
          <legend className="sr-only">KPI {index + 1}</legend>
          <input type="hidden" name="goal-row" value={id} />
          <div className="goal-card-head">
            <span className="goal-index">{index + 1}</span>
            <label className="goal-name"><span className="sr-only">{t("ชื่อ KPI")}</span>
              <input name={`name-${id}`} value={row.name} onChange={event => change(id, { name: event.target.value })}
                placeholder={t("ชื่อ KPI")} maxLength={120} required /></label>
            <label className="goal-weight-input"><span>{t("น้ำหนัก")}</span>
              <input name={`weight-${id}`} type="number" min={1} max={100} value={row.weight}
                onChange={event => change(id, { weight: event.target.value })} required /><span>%</span></label>
            {rows.length > 1 && <Button variant="text" onClick={() => setRows(current => current.filter(item => item.key !== id))}>{t("ลบ")}</Button>}
          </div>
          <label className="field"><span>{t("หน้าที่ที่เกี่ยวข้องและหลักฐานที่จะใช้")}</span>
            <input name={`responsibility-${id}`} value={row.responsibility} onChange={event => change(id, { responsibility: event.target.value })}
              placeholder={t("เช่น รายงานจากระบบติดตามงานรายเดือน")} maxLength={240} required /></label>
          <div className="goal-meta">
            <label className="field goal-unit"><span>{t("หน่วย")}</span>
              <input name={`unit-${id}`} value={row.unit} onChange={event => change(id, { unit: event.target.value })}
                placeholder={t("%, รายการ, ชม.")} maxLength={20} required /></label>
            <div className="field"><span>{t("ทิศทาง")}</span>
              <div className="segmented" role="radiogroup" aria-label={t("ทิศทาง")}>
                {(["higher", "lower"] as const).map(value => <label key={value} className={row.direction === value ? "active" : undefined}>
                  <input type="radio" name={`direction-${id}`} value={value} checked={row.direction === value}
                    onChange={() => change(id, { direction: value })} />{value === "higher" ? t("ยิ่งสูงยิ่งดี") : t("ยิ่งต่ำยิ่งดี")}</label>)}
              </div>
            </div>
          </div>
          <label className="field"><span>{t("แหล่งข้อมูลผลจริง")}</span>
            <select name={`source-${id}`} value={row.source} onChange={event => change(id, {
              source: event.target.value === "work-delivery" ? "work-delivery" : "manual",
            })}>
              <option value="manual">{t("ระบบงาน · ผลตาม KPI")}</option>
              <option value="work-delivery">{t("ระบบงาน · อัตราส่งทัน")}</option>
            </select>
          </label>
          <div className="ladder">
            <div className="ladder-head"><span>{t("เกณฑ์แต่ละระดับ")}</span>
              <Button variant="text" onClick={() => {
                const [level2, , level4, level5] = suggestedCutoffs(definition.target, definition.direction, definition.unit);
                change(id, { level2: String(level2), level4: String(level4), level5: String(level5) });
              }}>{canSuggest ? t("ใช้ค่าแนะนำจากเป้าหมาย") : t("ใส่เป้าหมายก่อนเพื่อใช้ค่าแนะนำ")}</Button></div>
            <div className="ladder-row">
              {([["level2", t("ระดับ 2")], ["target", t("ระดับ 3 · เป้าหมาย")], ["level4", t("ระดับ 4")], ["level5", t("ระดับ 5")]] as const).map(([field, label], step) =>
                <label key={field} className={field === "target" ? "ladder-step target" : "ladder-step"}>
                  <span>{label}</span>
                  <input name={`${field}-${id}`} type="number" min={0} step="any" value={row[field]}
                    onChange={event => change(id, { [field]: event.target.value })} required />
                  {step < 3 && <i aria-hidden="true">{lower ? ">" : "<"}</i>}
                </label>)}
            </div>
            <p className={problem ? "ladder-hint error" : "ladder-hint"}>{problem ?? (lower
              ? t("ยิ่งต่ำยิ่งดี: ค่าน้อยกว่าได้ระดับสูงกว่า เช่น 36 → 24 → 16 → 8")
              : t("ยิ่งสูงยิ่งดี: ค่ามากกว่าได้ระดับสูงกว่า เช่น 80 → 95 → 98 → 100"))}</p>
          </div>
        </fieldset>;
      })}
      <Button variant="secondary" onClick={() => setRows(current => [...current, toRow(undefined, nextKey.current++)])}>{t("+ เพิ่ม KPI")}</Button>
    </section>
    {template && !matchesTemplateGoals(rows.map(toDefinition), template) &&
      <label className="field">{t("เหตุผลที่ปรับจากแม่แบบ")}
        <textarea name="template-reason" defaultValue={adjustmentReason} maxLength={500} required />
      </label>}
  </>;
}

function readGoals(form: FormData): GoalDefinition[] {
  return form.getAll("goal-row").map(id => {
    const value = (name: string) => readField(form, `${name}-${id}`);
    const numeric = (name: string) => value(name) ? Number(value(name)) : NaN;
    const target = numeric("target");
    const source = value("source");
    return {
      name: value("name"), responsibility: value("responsibility"), unit: value("unit"), weight: numeric("weight"),
      direction: value("direction") === "lower" ? "lower" : undefined,
      ...(source === "work-delivery" || source === "manual" ? { source } : {}),
      target, cutoffs: [numeric("level2"), target, numeric("level4"), numeric("level5")],
    };
  });
}

export function kpiTemplateForm(template: KpiTemplate | undefined, takenTitles: string[],
  onSave: (title: string, goals: GoalDefinition[]) => void): FormSpec {
  const taken = new Set(takenTitles.map(title => title.toLocaleLowerCase()));
  const validate = (form: FormData) => {
    const title = readField(form, "template-title");
    if (!title) return t("ระบุชื่อแม่แบบ");
    if (taken.has(title.toLocaleLowerCase())) return t("ชื่อแม่แบบนี้มีอยู่แล้ว");
    return validateGoalPlan(readGoals(form));
  };
  return {
    title: template ? t("แก้ไขแม่แบบ {0}", template.title) : t("เพิ่มแม่แบบ KPI"), label: t("บันทึกแม่แบบ"),
    content: <>
      <Field label={t("ชื่อแม่แบบ")}><input name="template-title" defaultValue={template?.title} maxLength={80} required /></Field>
      <GoalEditor initial={template?.goals ?? []} intro={t("เกณฑ์ฉบับนี้ใช้กับแผน KPI ที่ส่งหลังบันทึก")} />
    </>,
    validate,
    save: form => {
      if (!validate(form)) onSave(readField(form, "template-title"), readGoals(form));
    },
  };
}

export function goalPlanAction(person: Person, cycle: Cycle, role: Role, action: GoalPlanAction,
  update: (message: string, change: (person: Person) => void) => void, today: () => string): FormSpec | undefined {
  if (action === "ask-plan" && role === "employee" && person.status === "employee" && person.goals.length > 0 && !hasOpenPlanQuestion(person)) return {
    title: t("ถาม HR เรื่องแผน KPI"), label: t("ส่งคำถาม"),
    content: <>
      <p className="form-tip">{t("แผนนี้ยังใช้ระหว่างรอคำตอบ หาก HR ปรับแผน แผนใหม่จะแสดงที่หน้านี้")}</p>
      <TextField name="question" label={t("คำถามหรือข้อกังวลเกี่ยวกับเป้าหมาย น้ำหนัก หรือเกณฑ์")} />
    </>,
    save: form => {
      const question = readField(form, "question");
      if (!question) return;
      update(t("พนักงานส่งคำถามเรื่องแผน KPI"), next => { next.planQuestion = { question, askedOn: today() }; });
    },
  };
  if (action === "answer-plan-question" && role === "hr" && person.planQuestion && hasOpenPlanQuestion(person)) {
    const asked = person.planQuestion;
    return {
      title: t("ตอบคำถามเรื่องแผน KPI"), label: t("ส่งคำตอบ"),
      content: <>
        <p className="feedback"><strong>{t("คำถามจากพนักงาน")}</strong> · {asked.question}</p>
        <TextField name="response" label={t("คำตอบถึงพนักงาน")} />
      </>,
      save: form => {
        const response = readField(form, "response");
        if (!response) return;
        update(t("HR ตอบคำถามเรื่องแผน KPI แล้ว"), next => { next.planQuestion = { ...asked, response, respondedOn: today() }; });
      },
    };
  }
  if (person.status !== "employee") return;
  if (action === "assign-goals" && role === "hr") {
    if (!canEditPlan(person, cycle, today())) return;
    const template = templateForTeam(cycle, person.team);
    const previousTemplate = person.goalAssignment?.template ?? person.acceptedGoalTemplate;
    const initial = needsGoalAssignment(person) && template ? template.goals : currentPlan(person).map(goalDefinition);
    const validate = (goals: GoalDefinition[], reason: string) =>
      validateGoalPlan(goals) ?? (template && !matchesTemplateGoals(goals, template) && !reason ? t("ระบุเหตุผลที่ปรับจากแม่แบบ") : undefined);
    return {
      title: t("แผน KPI · {0}", person.name), label: t("ส่งแผนให้พนักงาน"),
      content: <GoalEditor initial={initial} template={template} adjustmentReason={previousTemplate?.adjustmentReason}
        intro={t("{0} · {1} · น้ำหนักรวมต้องได้ 100% และใช้เป้าหมายเป็นเกณฑ์ระดับ 3", person.title, person.team)} />,
      validate: form => validate(readGoals(form), readField(form, "template-reason")),
      save: form => {
        const goals = readGoals(form);
        const reason = readField(form, "template-reason");
        if (validate(goals, reason)) return;
        const adjustmentReason = template && !matchesTemplateGoals(goals, template) ? reason : undefined;
        update(t("HR ส่งแผน KPI ให้พนักงาน"), next => {
          next.goalAssignment = { goals, assignedOn: today(), assignedBy: "HR",
            ...(template && { template: { title: template.title, version: template.version, ...(adjustmentReason && { adjustmentReason }) } }),
          };
          applyPlan(next, today());
        });
      },
    };
  }
}

export type PlanState = "none" | "active" | "original";

export function planState(person: Person): PlanState {
  if (needsGoalAssignment(person)) return "none";
  return person.goalsAcceptedOn ? "active" : "original";
}

/** Badge for where a member's KPI plan stands; shared by the dashboard and the tracking page. */
export function PlanStatus({ person }: { person: Person }) {
  const state = planState(person);
  if (state === "none") return <span className="pill amber">{t("ยังไม่มีแผน KPI")}</span>;
  if (state === "active") return <span className="pill green">{t("มีแผนแล้ว")}</span>;
  return <span className="subtle">{t("ใช้เป้าหมายเดิม")}</span>;
}

function TemplateReference({ reference }: { reference: GoalTemplateReference }) {
  return <div>
    <p className="subtle">{t("แม่แบบ {0} · ฉบับ {1}", reference.title, reference.version)}</p>
    {reference.adjustmentReason && <p className="feedback"><strong>{t("เหตุผลที่ปรับจากแม่แบบ")}</strong> · {reference.adjustmentReason}</p>}
  </div>;
}

export function KpiTemplateLibrary({ templates, teamTemplates, onAdd, onEdit }: {
  templates: KpiTemplate[]; teamTemplates?: Cycle["teamTemplates"]; onAdd?: () => void; onEdit?: (template: KpiTemplate) => void;
}) {
  return <Panel title={t("คลังแม่แบบ KPI")} description={t("HR เลือกแม่แบบให้แต่ละทีมได้ที่หน้าตั้งรอบ")}
    actions={onAdd && <Button onClick={onAdd}>{t("+ เพิ่มแม่แบบ")}</Button>}>
    <div className="stack">{templates.map(template => {
      const teams = (Object.keys(teamTemplates ?? {}) as Team[]).filter(team => teamTemplates?.[team] === template.id);
      return <details className="delivery-history" key={template.id}>
        <summary>{t("แม่แบบ {0} · ฉบับ {1}", template.title, template.version)}{teams.length > 0 && ` · ${teams.join(", ")}`}</summary>
        {onEdit && <div className="actions"><Button variant="secondary" onClick={() => onEdit(template)}>{t("แก้ไขแม่แบบ")}</Button></div>}
        <ul className="dashboard-list">{template.goals.map(goal => <li key={goal.name}>
          <div>
            <strong>{t(goal.name)}</strong>
            <div className="subtle">{goal.responsibility && t(goal.responsibility)}</div>
            <div className="subtle">{sourceLabel(goal)}</div>
            <Ladder goal={goal} />
          </div>
          <span className="pill">{t("ระดับ 3 · เป้าหมาย")} {number(goal.target)} {t(goal.unit)}{" " + t("· น้ำหนัก") + " "}{goal.weight}%</span>
        </li>)}</ul>
      </details>;
    })}</div>
    <p className="subtle">{t("ระดับ 1 ใช้เมื่อผลไม่ผ่านเกณฑ์ระดับ 2")}</p>
  </Panel>;
}

export function GoalPlanPanel({ person, cycle, role, onAction, readOnly = false, reviewer }: {
  person: Person; cycle: Cycle; role: Role; onAction: (action: GoalPlanAction) => void; readOnly?: boolean; reviewer?: string;
}) {
  const pending = person.goalAssignment;
  const canAsk = !readOnly && role === "employee" && person.status === "employee" && person.goals.length > 0 && !hasOpenPlanQuestion(person);
  const question = person.planQuestion;
  const reference = pending ? pending.template : person.acceptedGoalTemplate;
  const atEmployeeStep = !readOnly && role === "hr" && person.status === "employee";
  const withinEditWindow = canEditPlan(person, cycle, bangkokDay());
  const editDue = planEditDue(person, cycle);
  const canAssign = atEmployeeStep && withinEditWindow;
  if (!canAssign && !pending && !person.goalsAcceptedOn && !reviewer) return null;
  return <Panel title={t("แผน KPI ตามหน้าที่")} description={`${person.title} · ${person.team}`}
    actions={canAssign ? <Button onClick={() => onAction("assign-goals")}>{person.goals.length ? t("แก้ไขแผน KPI") : t("มอบหมายแผน KPI")}</Button>
      : canAsk && <Button variant="secondary" onClick={() => onAction("ask-plan")}>{t("ถาม HR")}</Button>}>
    {reference && <TemplateReference reference={reference} />}
    {question && <div className="item">
      <strong>{t("คำถามเรื่องแผน KPI")}</strong>
      <p className="feedback">{question.question}</p>
      {question.response ? <p className="feedback"><strong>{t("คำตอบจาก HR")}</strong> · {question.response}</p>
        : role === "hr" && !readOnly ? <div className="actions"><Button onClick={() => onAction("answer-plan-question")}>{t("ตอบคำถาม")}</Button></div>
        : <p className="subtle">{t("รอ HR ตอบ")}</p>}
    </div>}
    {pending ? <>
      <p><span className="pill amber">{t("แผนที่ยังไม่เริ่มใช้")}</span> <span className="subtle">{t("มอบหมายโดย") + " "}{pending.assignedBy} · {date(pending.assignedOn)}</span></p>
      <ul className="dashboard-list">{pending.goals.map(goal => <li key={goal.name}>
        <div><div className="actions">{goal.scope === "team" && <span className="pill blue">{t("KPI ทีม")}</span>}<strong>{t(goal.name)}</strong></div>
          <div className="subtle">{goal.responsibility && t(goal.responsibility)}</div>
          <div className="subtle">{sourceLabel(goal)}</div><Ladder goal={goal} /></div>
        <span className="pill">{t("เป้าหมาย") + " "}{number(goal.target)} {t(goal.unit)}{" " + t("· น้ำหนัก") + " "}{goal.weight}% · {goal.direction === "lower" ? t("ยิ่งต่ำยิ่งดี") : t("ยิ่งสูงยิ่งดี")}</span>
      </li>)}</ul>
      <p className="subtle">{t("ระดับ 1 ใช้เมื่อผลไม่ผ่านเกณฑ์ระดับ 2")}</p>
    </> : (person.goalsAcceptedOn || canAssign) && <p className="subtle">{person.goalsAcceptedOn ? t("แผนที่ใช้อยู่มีผลเมื่อ {0}", date(person.goalsAcceptedOn))
      : t("กำหนด KPI ให้ตรงกับหน้าที่ แล้วส่งให้พนักงาน แผนจะมีผลทันที")}</p>}
    {reviewer && <p className="subtle">{t("ผู้ประเมิน ·") + " "}{reviewer}</p>}
    {atEmployeeStep && person.goals.length > 0 && editDue && <p className={withinEditWindow ? "subtle" : "form-tip"}>
      {withinEditWindow ? t("HR แก้แผนได้ถึง {0}", date(editDue)) : t("พ้นกำหนดแก้แผนเมื่อ {0}", date(editDue))}</p>}
    {!!person.previousGoalPlans?.length && <details className="delivery-history"><summary>{t("ดูแผน KPI ก่อนหน้า")}</summary>
      <ol>{person.previousGoalPlans.map((plan, index) => <li key={index}>
        <strong>{t("เปลี่ยนแผนเมื่อ") + " "}{date(plan.replacedOn)}</strong>
        {plan.template && <TemplateReference reference={plan.template} />}
        <ul>{plan.goals.map((goal, goalIndex) => <li key={goalIndex}>
          {t(goal.name)}{" " + t("· เป้าหมาย") + " "}{number(goal.target)} {t(goal.unit)}{" " + t("· น้ำหนัก") + " "}{goal.weight}%
          {!goal.unmeasured && <div className="subtle">{t("ผลจริงล่าสุด") + " "}{number(goal.actual)} {t(goal.unit)}{goal.evidence && ` · ${goal.evidence}`}</div>}
        </li>)}</ul>
      </li>)}</ol>
    </details>}
  </Panel>;
}

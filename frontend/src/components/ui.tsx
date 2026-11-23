import { t } from "../i18n";
import type { ReactNode } from "react";
import { anchors, rubric, states } from "../config";
import type { Person, Status } from "../types";

const iconPaths = {
  overview: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  results: "M4 4v16h16M8 16v-4m5 4V8m5 8V5",
  work: "M5 20V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v15zM8 8h8M8 12h8M8 16h4",
  tracking: "M4 20h16M6 16v-4m6 4V8m6 8V4",
  backlog: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  feedback: "M4 5h16v12H9l-5 3zM8 9h8M8 13h5",
  appeals: "M4 6h16v12H4zM4 7l8 6 8-6",
  setup: "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.8 1.7 1l.4 2.5h4l.4-2.5c.6-.2 1.2-.6 1.7-1l2.4 1 2-3.4z",
  criteria: "M9 5H6a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-3M9 3h6v4H9zM9 12l2 2 4-4M9 17h6",
  calibration: "M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3",
  flag: "M5 21V4m0 1c5-5 9 4 14-1v11c-5 5-9-4-14 1",
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof iconPaths; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

/** Shared Space logo: three overlapping squares (Employee, Manager, HR) meeting in one shared centre. */
export function BrandMark({ size = 24 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
    <rect x="20" y="20" width="8" height="8" fill="var(--accent-dark)" />
    <g fill="none" stroke="currentColor" strokeWidth={4}>
      <rect x="5" y="5" width="23" height="23" />
      <rect x="20" y="5" width="23" height="23" />
      <rect x="12.5" y="20" width="23" height="23" />
    </g>
  </svg>;
}

export function Button({ children, onClick, variant = "", type = "button", disabled, title }: {
  children: ReactNode; onClick?: () => void; variant?: string; type?: "button" | "submit"; disabled?: boolean; title?: string;
}) {
  return <button className={`btn ${variant}`} type={type} onClick={onClick} disabled={disabled} title={title}>{children}</button>;
}

export function Panel({ title, description, actions, children, id }: {
  title: string; description?: string; actions?: ReactNode; children: ReactNode; id?: string;
}) {
  return <section className="panel" id={id} tabIndex={id ? -1 : undefined}><div className="panel-head">
    <div><h2>{title}</h2>{description && <p className="panel-description">{description}</p>}</div>{actions}
  </div>{children}</section>;
}

export function Heading({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <div className="heading"><div><h1>{title}</h1><p className="muted">{description}</p></div>{actions}</div>;
}

export function Stat({ label, tone, children }: { label: string; tone?: "red" | "blue" | "green"; children: ReactNode }) {
  return <div className={tone ? `stat tone-${tone}` : "stat"}><span>{label}</span><strong>{children}</strong></div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field">{label}{children}</label>;
}

export function Badge({ status }: { status: Status }) {
  const [label, tone] = states[status];
  return <span className={`pill ${tone}`}>{t(label)}</span>;
}

export function PersonLabel({ person }: { person: Person }) {
  return <div className="person"><span className="avatar">{person.initials}</span><div>
    <strong>{person.name}</strong><div className="subtle">{person.id} · {person.title}</div>
  </div></div>;
}

export function LevelSelect({ value }: { value?: number }) {
  return <select name="level" defaultValue={value ?? ""} required>
    <option value="">{t("เลือกระดับ")}</option>
    {rubric.map((label, index) => <option key={label} value={index + 1}>{index + 1} · {t(label)} — {t(anchors[index])}</option>)}
  </select>;
}

export function TextField({ name, label, value = "", required = true }: {
  name: string; label: string; value?: string; required?: boolean;
}) {
  return <Field label={label}><textarea name={name} defaultValue={value} maxLength={600} required={required} /></Field>;
}

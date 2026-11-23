import { getLanguage, setLanguage, subscribeLanguage, t } from "./i18n";
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActionForm, personAction, type FormSpec } from "./components/actions";
import { Calibration, Criteria, CycleSetup, readField } from "./components/overview";
import { HrDashboard } from "./components/hr-dashboard";
import { PersonDetails, type PersonAction } from "./components/person";
import { EmployeeDashboard, ManagerDashboard } from "./components/role-dashboards";
import { ManagerFeedbackPage } from "./components/manager-feedback";
import { ManagerBacklog } from "./components/manager-backlog";
import { TeamTracking } from "./components/tracking";
import { AppealsQueue, pendingAppeals } from "./components/appeals";
import { PerformanceResults } from "./components/performance-results";
import { closeReviewCycle, createReviewRound, cycleClosure } from "./domain/cycle";
import { managerTasks } from "./domain/reminders";
import { kpiTemplateForm, KpiTemplateLibrary } from "./components/goal-plan";
import { HrBatchPanel, publishForm, routineConfirmForm } from "./components/hr-batch";
import { confirmRoutine, publishableCases, publishCases, routineCases } from "./domain/hr-batch";
import { assignTeamPlans, kpiTemplates, matchesTemplateGoals } from "./domain/goal-plan";
import { bangkokDay } from "./domain/submission";
import { emptyFilters, reviewCsv } from "./domain/hr-overview";
import { emptyPerformanceFilters } from "./domain/performance";
import { managerForPerson, managersForTeam, managersInCycle, personManagerId } from "./domain/managers";
import { BrandMark, Button, Heading, Icon } from "./components/ui";
import { overdue } from "./domain/kpi";
import { addManagerFeedback, feedbackSummary } from "./domain/manager-feedback";
import { emptyManagerComparisonFilters } from "./domain/manager-comparison";
import { activateAssignedPeople, activateAssignedPlans } from "./domain/plan-activation";
import { syncWorkspaceWork } from "./domain/work-sync";
import { readData } from "./services/storage";
import { loadWorkspace, saveWorkspace, WorkspaceConflict } from "./services/workspace-api";
import { parseWorkspacePath, reviewRoundAt, workspacePath, type Page, type WorkspaceRoute } from "./services/workspace-routing";
import type { Cycle, FeedbackRatings, KpiTemplate, ManagerId, Person, ReviewRound, Role, Team, Workspace } from "./types";

interface NavItem { page: Page; label: string; badge?: number | "!"; tone?: "red" | "amber"; locked?: boolean }
interface NavGroup { label?: string; items: NavItem[] }

const demoRoles = { hr: "HR", manager: "Manager", employee: "พนักงาน" } as const;
const ManagerComparison = lazy(() => import("./components/manager-comparison"));

export default function App() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  const [workspace, setWorkspace] = useState(readData);
  const [connection, setConnection] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const version = useRef<string | undefined>(undefined);
  const writeInProgress = useRef(false);
  const [pathname, setPathname] = useState(() => typeof window === "undefined" ? "/" : window.location.pathname);
  const managerPreference = useRef<ManagerId>("Operations");
  const employeePreference = useRef("E101");
  const history = workspace.history ?? [];
  const latestRound = history.length + 1;
  const route = parseWorkspacePath(pathname);
  const { role = "hr", page = "overview", person: opened } = route ?? {};
  const selectedRound = reviewRoundAt(workspace, route?.round ?? latestRound);
  const { cycle, people } = selectedRound?.data ?? workspace;
  const archiveIndex = selectedRound?.archiveIndex;
  const round = selectedRound ? route?.round ?? latestRound : latestRound;
  const [cohort, setCohort] = useState("");
  const [filters, setFilters] = useState(emptyFilters);
  const [resultFilters, setResultFilters] = useState(emptyPerformanceFilters);
  const [comparisonFilters, setComparisonFilters] = useState(emptyManagerComparisonFilters);
  const [form, setForm] = useState<FormSpec>();
  const [notice, setNotice] = useState("");
  const main = useRef<HTMLElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const waiting = connection !== "ready" || saving;

  useEffect(() => {
    const controller = new AbortController();
    loadWorkspace(readData, controller.signal).then(snapshot => {
      if (controller.signal.aborted) return;
      version.current = snapshot.version;
      setWorkspace(syncWorkspaceWork(activateAssignedPlans(snapshot.workspace)));
      setConnection("ready");
    }).catch(() => {
      if (!controller.signal.aborted) setConnection("error");
    });
    return () => controller.abort();
  }, [loadAttempt]);

  useEffect(() => {
    const onPopState = () => {
      setPathname(window.location.pathname);
      setForm(undefined);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (connection !== "ready" || pathname !== "/" || window.location.pathname !== "/") return;
    const path = workspacePath({ role: "hr", page: "overview", round: latestRound });
    window.history.replaceState(null, "", path + window.location.search + window.location.hash);
    setPathname(path);
  }, [connection, pathname, latestRound]);

  const actor = route?.actor;
  useEffect(() => {
    setFilters(emptyFilters);
    setResultFilters(emptyPerformanceFilters);
    setComparisonFilters(emptyManagerComparisonFilters);
    setCohort("");
  }, [role, round, actor]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.querySelector('meta[name="description"]')?.setAttribute("content",
      t("ต้นแบบระบบประเมินผลงานและติดตาม KPI สำหรับพนักงาน ผู้จัดการ และ HR"));
  }, [language]);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (form && !modal.open) modal.showModal();
    if (!form && modal.open) modal.close();
  }, [form]);

  const participants = people.filter(person => cycle.teams.includes(person.team));
  const cycleManagers = role === "manager" ? managersInCycle(cycle) : [];
  const requestedManager = cycleManagers.find(manager => manager.id === actor);
  const team = requestedManager?.team ?? cycle.teams[0] ?? "Operations";
  const manager = requestedManager ?? managersForTeam(cycle, team)[0];
  const employee = participants.find(person => person.id === actor);
  const visible = participants.filter(person => role === "hr" ||
    (role === "manager" ? personManagerId(person) === manager.id : person.id === employee?.id));
  const current = visible.find(person => person.id === (role === "employee" ? employee?.id : opened));
  const isOpen = cycle.status === "open";
  const isClosed = cycle.status === "closed";
  const hasStarted = cycle.status !== "draft";
  const feedbackPending = isOpen && !!employee && !cycle.managerFeedback?.[personManagerId(employee)]?.respondedIds.includes(employee.id);
  const pageIsLocked = !hasStarted && ["calibration", "feedback", "results"].includes(page);
  const routeUnavailable = (pathname !== "/" && !route) || !selectedRound || (role === "manager" && !requestedManager) ||
    (role === "employee" && !employee) || (!!opened && !current) || pageIsLocked;

  useEffect(() => {
    if (connection !== "ready" || routeUnavailable) return;
    if (role === "manager") managerPreference.current = manager.id;
    if (role === "employee" && employee) employeePreference.current = employee.id;
  }, [connection, routeUnavailable, role, manager.id, employee]);

  function notify(message: string) {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 4200);
  }

  function reloadWorkspace() {
    version.current = undefined;
    setConnection("loading");
    setLoadAttempt(attempt => attempt + 1);
  }

  async function persistWorkspace(data: Workspace, message: string, onSaved?: () => void) {
    const expected = version.current;
    if (!expected || writeInProgress.current) return;
    writeInProgress.current = true;
    setSaving(true);
    try {
      version.current = await saveWorkspace(data, expected);
      setWorkspace(data);
      setForm(undefined);
      if (pathname === window.location.pathname) onSaved?.();
      notify(message);
    } catch (error) {
      if (error instanceof WorkspaceConflict) {
        goToPath("/");
        reloadWorkspace();
        notify(t("ข้อมูลเปลี่ยนจากอีกแท็บหรือเครื่อง ระบบกำลังโหลดข้อมูลล่าสุด"));
      } else {
        notify(t("บันทึกบนเซิร์ฟเวอร์ไม่สำเร็จ ลองบันทึกอีกครั้ง"));
      }
    } finally {
      writeInProgress.current = false;
      setSaving(false);
    }
  }

  function persist(round: ReviewRound, message: string, onSaved?: () => void) {
    const data = archiveIndex === undefined
      ? { ...workspace, ...round }
      : { ...workspace, history: history.map((entry, index) => index === archiveIndex ? round : entry) };
    void persistWorkspace(data, message, onSaved);
  }

  function pathFor(next: Page, person?: string) {
    return workspacePath({ role, round, actor: role === "manager" ? manager.id : employee?.id ?? participants[0]?.id, page: next, person });
  }

  function goToPath(path: string) {
    setForm(undefined);
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
      setPathname(path);
    }
    main.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function navigate(next: Page, id?: string) {
    goToPath(pathFor(next, id));
  }

  function switchWorkspace(nextRole: Role, nextRound = round, preferredActor?: string) {
    const selected = reviewRoundAt(workspace, nextRound);
    if (!selected) return;
    let actor: string | undefined;
    if (nextRole === "manager") {
      const managers = managersInCycle(selected.data.cycle);
      actor = (managers.find(manager => manager.id === (preferredActor ?? managerPreference.current)) ?? managers[0])?.id;
    }
    if (nextRole === "employee") {
      const participants = selected.data.people.filter(person => selected.data.cycle.teams.includes(person.team));
      actor = (participants.find(person => person.id === (preferredActor ?? employeePreference.current)) ?? participants[0])?.id;
    }
    const role = nextRole !== "hr" && !actor ? "hr" : nextRole;
    goToPath(workspacePath({ role, actor, page: "overview", round: nextRound }));
  }

  function createRound() {
    if (role !== "hr" || archiveIndex !== undefined) return;
    const next = createReviewRound(workspace);
    if (!next) return;
    void persistWorkspace(next, t("สร้างรอบประเมินฉบับร่างแล้ว"), () => {
      goToPath(workspacePath({ role: "hr", page: "setup", round: (next.history?.length ?? 0) + 1 }));
    });
  }

  function openCycle(formData: FormData) {
    if (role !== "hr" || hasStarted) return;
    const selected = formData.getAll("team");
    const teams = cycle.teams.filter(name => selected.includes(name));
    const reviewers = Object.fromEntries(teams.map(name => [name, readField(formData, `reviewer-${name}`)]));
    const secondaryReviewers = Object.fromEntries(teams.map(name => [name, readField(formData, `reviewer-${name}-2`)]));
    const name = readField(formData, "name");
    const employeeDue = readField(formData, "employeeDue");
    const managerDue = readField(formData, "managerDue");
    const resultWeight = Number(readField(formData, "resultWeight"));
    if (!name || !teams.length || teams.some(team => !reviewers[team] || !secondaryReviewers[team])) {
      return notify(t("ระบุชื่อรอบ เลือกทีม และใส่ชื่อ Manager ทั้งสองคนของทุกทีมที่เลือก"));
    }
    if (teams.some(team => reviewers[team].toLowerCase() === secondaryReviewers[team].toLowerCase())) {
      return notify(t("Manager ทั้งสองคนของแต่ละทีมต้องใช้ชื่อที่แยกกันได้"));
    }
    if (!employeeDue || !managerDue || managerDue < employeeDue) return notify(t("กำหนดส่งหัวหน้าต้องไม่อยู่ก่อนกำหนดส่งพนักงาน"));
    if (!Number.isInteger(resultWeight) || resultWeight < 1 || resultWeight > 99) return notify(t("ระบุน้ำหนักผลลัพธ์เป็นจำนวนเต็ม 1–99%"));

    const nextPeople: Person[] = people.map(person => {
      if (!teams.includes(person.team)) return person;
      const updated = { ...person, due: overdue(person) ? person.due : managerDue, ...(person.goals.length ? { planIssuedOn: bangkokDay() } : {}) };
      if (resultWeight !== cycle.resultWeight && person.decision) {
        delete updated.decision;
        updated.status = "hr";
      }
      return updated;
    });
    const nextCycle: Cycle = { ...cycle, name, teams, reviewers, secondaryReviewers, employeeDue, managerDue, resultWeight, status: "open" };
    const now = new Date();
    const assignment = assignTeamPlans(nextCycle, nextPeople, bangkokDay(now), now.toISOString());
    persist({ people: activateAssignedPeople(assignment.people), cycle: nextCycle },
      assignment.sent ? t("เปิดรอบและส่งแผน KPI จากแม่แบบให้ {0} คนแล้ว", assignment.sent) : t("เปิดรอบประเมินแล้ว"),
      () => navigate("overview"));
  }

  function confirmCycleClosure() {
    if (role !== "hr" || !isOpen) return;
    const { unpublished, openAppeals } = cycleClosure(cycle, people);
    setForm({
      title: t("ปิดรอบประเมิน"),
      label: t("ยืนยันปิดรอบประเมิน"),
      content: <>
        <p>{t("หลังปิดรอบ ระบบจะล็อก KPI หลักฐาน และผลประเมิน พนักงานยังดูและรับทราบผลที่เผยแพร่แล้วได้")}</p>
        {(unpublished > 0 || openAppeals > 0) && <p className="form-tip">
          {t("ผลยังไม่เผยแพร่ {0} คน จะถูกเก็บไว้ในสถานะเดิม · คำขอตรวจสอบค้าง {1} รายการยังพิจารณาต่อได้หลังปิดรอบ", unpublished, openAppeals)}
        </p>}
      </>,
      save: () => {
        const closed = closeReviewCycle({ ...cycle, kpiTemplates: kpiTemplates(cycle) }, new Date().toISOString());
        if (closed) {
          setFilters(emptyFilters);
          persist({ cycle: closed, people }, t("ปิดรอบประเมินแล้ว"));
        }
      },
    });
  }

  function handleAction(action: PersonAction, index?: number) {
    if (current) actFor(current, action, index);
  }

  function actFor(target: Person, action: PersonAction, index?: number) {
    const spec = personAction(target, cycle, role, action, (message, apply) => {
      const updated = structuredClone(target);
      apply(updated);
      updated.activity.unshift({ role, message, at: new Date().toISOString() });
      persist({ cycle, people: people.map(person => person.id === updated.id ? updated : person) }, message);
    }, index);
    if (spec) setForm(spec);
  }

  const feedbackManager = role === "manager" ? manager : role === "employee" && employee ? managerForPerson(cycle, employee) : undefined;
  function submitFeedback(ratings: FeedbackRatings) {
    if (!isOpen || !feedbackManager || !cycle.teams.includes(feedbackManager.team)) return;
    const id = feedbackManager.id;
    const updated = addManagerFeedback(cycle.managerFeedback?.[id], ratings, role === "employee" ? employee?.id : undefined);
    if (!updated) return;
    persist({ people, cycle: { ...cycle, managerFeedback: { ...cycle.managerFeedback, [id]: updated } } }, t("ส่งแบบประเมินแล้ว"));
  }

  function exportCsv(rows: Person[]) {
    const csv = reviewCsv(rows, cycle);
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `performance-${bangkokDay()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(t("ส่งออกข้อมูลตามตัวกรองแล้ว"));
  }

  const listPage: Page = page === "tracking" || page === "backlog" || page === "appeals" ||
    page === "calibration" || page === "results" || page === "feedback" ? page : "overview";
  const openPerson = (id: string) => navigate(listPage, id);
  const templateLibrary = kpiTemplates(cycle);
  function editTemplate(template?: KpiTemplate) {
    if (role !== "hr" || isClosed) return;
    const otherTitles = templateLibrary.filter(item => item.id !== template?.id).map(item => item.title);
    setForm(kpiTemplateForm(template, otherTitles, (title, goals) => {
      if (template && title === template.title && matchesTemplateGoals(goals, template)) {
        setForm(undefined);
        return;
      }
      const saved = template ? { ...template, title, goals, version: template.version + 1 }
        : { id: `template-${Date.now()}`, title, goals, version: 1 };
      const library = template ? templateLibrary.map(item => item.id === template.id ? saved : item) : [...templateLibrary, saved];
      persist({ people, cycle: { ...cycle, kpiTemplates: library } }, t("บันทึกแม่แบบ KPI ฉบับ {0} แล้ว", saved.version));
    }));
  }
  function chooseTeamTemplate(team: Team, templateId: string) {
    if (role !== "hr" || isClosed) return;
    const teamTemplates = { ...cycle.teamTemplates };
    if (templateId) teamTemplates[team] = templateId;
    else delete teamTemplates[team];
    persist({ people, cycle: { ...cycle, kpiTemplates: templateLibrary, teamTemplates } }, t("บันทึกแม่แบบของทีม {0} แล้ว", team));
  }
  function sendTeamPlans() {
    if (role !== "hr" || !isOpen) return;
    const now = new Date();
    const assignment = assignTeamPlans(cycle, people, bangkokDay(now), now.toISOString());
    if (assignment.sent) persist({ cycle, people: activateAssignedPeople(assignment.people) }, t("ส่งแผน KPI จากแม่แบบให้ {0} คนแล้ว", assignment.sent));
  }
  function confirmRoutineCases() {
    if (role !== "hr" || !isOpen) return;
    setForm(routineConfirmForm(routineCases(visible, cycle), reviewer => {
      const result = confirmRoutine(people, cycle, reviewer, new Date().toISOString());
      if (result.count) persist({ cycle, people: result.people }, t("ยืนยันระดับแล้ว {0} คน", result.count));
      else setForm(undefined);
    }));
  }
  function publishReadyCases() {
    if (role !== "hr" || !isOpen) return;
    setForm(publishForm(publishableCases(visible, cycle), team => {
      const now = new Date();
      const result = publishCases(people, cycle, team, bangkokDay(now), now.toISOString());
      if (result.count) persist({ cycle, people: result.people }, t("เผยแพร่ผลแล้ว {0} คน", result.count));
      else setForm(undefined);
    }));
  }
  function remindManager(id: ManagerId) {
    const target = managersInCycle(cycle).find(person => person.id === id);
    if (role !== "hr" || !target || isClosed) return;
    const reminders = { ...cycle.managerReminders, [id]: [...(cycle.managerReminders?.[id] ?? []), new Date().toISOString()] };
    persist({ people, cycle: { ...cycle, managerReminders: reminders } }, t("บันทึกการเตือน {0} แล้ว (จำลอง)", target.name));
  }
  const roundsWithAppeals = [workspace, ...history].flatMap((entry, index) => {
    const count = pendingAppeals(entry.people.filter(person => entry.cycle.teams.includes(person.team))).length;
    return count ? [{ round: latestRound - index, name: entry.cycle.name, count }] : [];
  });
  const groups: NavGroup[] = [];
  if (role === "hr") {
    const lateTasks = managerTasks(visible, cycle).filter(task => task.level === "late").length;
    groups.push(
      { label: t("งานหลัก"), items: [
        { page: "overview", label: t("ภาพรวม") },
        { page: "calibration", label: t("ทบทวนมาตรฐานคะแนน"), badge: isOpen ? visible.filter(person => person.status === "hr").length : undefined, locked: !hasStarted },
        { page: "results", label: t("ภาพรวมระดับผลงาน"), locked: !hasStarted },
        { page: "appeals", label: t("คำขอตรวจสอบผล"), badge: roundsWithAppeals.reduce((total, entry) => total + entry.count, 0), tone: "red" },
      ] },
      { label: t("ติดตาม Manager"), items: [
        { page: "backlog", label: t("งานค้างของ Manager"), badge: lateTasks, tone: "red" },
        { page: "feedback", label: t("ทบทวนวิธีประเมิน Manager"), locked: !hasStarted },
      ] },
      { label: t("ตั้งค่าและอ้างอิง"), items: [
        { page: "setup", label: t("ตั้งรอบประเมิน"), badge: hasStarted ? undefined : "!" },
        { page: "criteria", label: t("เกณฑ์การประเมิน") },
      ] },
    );
  } else if (role === "manager") {
    const selfPending = isOpen && feedbackSummary(cycle, manager.id).self === null;
    const tasks = managerTasks(visible, cycle);
    groups.push(
      { label: t("งานของฉัน"), items: [{ page: "overview", label: t("ภาพรวมและกล่องงาน"), badge: tasks.length + (selfPending ? 1 : 0),
        tone: tasks.some(task => task.level === "late") ? "red" : "amber" }] },
      { label: t("ทีม"), items: [
        { page: "tracking", label: t("ทีมของฉัน") },
        { page: "calibration", label: t("เทียบคะแนนในทีม"), locked: !hasStarted },
      ] },
      { label: t("อ้างอิง"), items: [{ page: "criteria", label: t("เกณฑ์การประเมิน") }] },
    );
  } else if (employee) {
    const needsAction = (isOpen && employee.status === "employee") ||
      (employee.status === "published" && !employee.acknowledged);
    groups.push(
      { items: [
        { page: "overview", label: t("หน้าแรก"), badge: needsAction ? "!" : undefined },
        { page: "work", label: t("KPI และผลงานของฉัน") },
        { page: "feedback", label: t("ให้ feedback ต่อ Manager"), badge: feedbackPending ? 1 : undefined, locked: !hasStarted },
      ] },
      { label: t("อ้างอิง"), items: [{ page: "criteria", label: t("เกณฑ์การประเมิน") }] },
    );
  }
  const roleLabel = t(demoRoles[role]);

  let content;
  if (routeUnavailable) content = <Heading title={t("เปิดหน้านี้ไม่ได้")}
    description={t(pageIsLocked ? "เปิดใช้งานเมื่อ HR เริ่มรอบประเมิน" : "ตรวจสอบบทบาท รอบประเมิน และรหัสพนักงานในลิงก์")}
    actions={<Button variant="secondary" onClick={() => switchWorkspace("hr", latestRound)}>{t("ไปภาพรวมรอบล่าสุด")}</Button>} />;
  else if (page === "criteria") content = <Criteria cycle={cycle} roleTemplate={templateLibrary.length > 0 &&
    <KpiTemplateLibrary templates={templateLibrary} teamTemplates={cycle.teamTemplates}
      onAdd={role === "hr" && !isClosed ? () => editTemplate() : undefined}
      onEdit={role === "hr" && !isClosed ? editTemplate : undefined} />} />;
  else if (hasStarted && page === "feedback" && (role !== "hr" || !current)) content = <ManagerFeedbackPage cycle={cycle} role={role} manager={feedbackManager}
    employeeId={role === "employee" ? employee?.id : undefined} onSubmit={submitFeedback} onCalibration={() => navigate("calibration")}
    comparison={role === "hr" && <Suspense fallback={<p role="status">{t("กำลังโหลดกราฟคะแนน")}</p>}>
      <ManagerComparison people={visible} cycle={cycle} filters={comparisonFilters} onFilters={setComparisonFilters} onOpen={openPerson} />
    </Suspense>} />;
  else if (role === "hr" && page === "setup") content = <CycleSetup key={`${archiveIndex ?? "current"}-${cycle.status}`}
    cycle={cycle} people={people} onOpen={openCycle} onClose={confirmCycleClosure} onCreate={archiveIndex === undefined ? createRound : undefined}
    onTeamTemplate={role === "hr" && !isClosed ? chooseTeamTemplate : undefined} onSendTeamPlans={sendTeamPlans} onMissingPlans={() => {
      setFilters({ ...emptyFilters, view: "people", state: "plan-none" });
      navigate("overview");
    }} onCriteria={() => navigate("criteria")} onOverview={() => navigate("overview")} onAppeals={() => navigate("appeals")} />;
  else if (current && (role !== "employee" || page === "work")) content = <PersonDetails person={current} cycle={cycle} role={role}
    onBack={() => navigate(listPage)} onAction={handleAction} />;
  else if (hasStarted && page === "calibration" && role !== "employee") content = <Calibration people={visible} cycle={cycle} role={role} cohort={cohort} onCohort={setCohort} onOpen={openPerson}
    batch={role === "hr" && isOpen && <HrBatchPanel people={visible} cycle={cycle} onOpen={openPerson} onConfirm={confirmRoutineCases} onPublish={publishReadyCases} />} />;
  else if (hasStarted && role === "hr" && page === "results") content = <PerformanceResults people={visible} cycle={cycle}
    filters={resultFilters} onFilters={setResultFilters} onOpen={openPerson} />;
  else if (role === "hr" && page === "appeals") content = <AppealsQueue people={visible} cycle={cycle} onOpen={openPerson}
    otherRounds={roundsWithAppeals.filter(entry => entry.round !== round)}
    onRound={next => goToPath(workspacePath({ role: "hr", page: "appeals", round: next }))} />;
  else if (role === "hr" && page === "backlog") content = <ManagerBacklog people={visible} cycle={cycle} onOpen={openPerson} onRemind={remindManager} />;
  else if (role === "manager") content = page === "tracking" ? <TeamTracking people={visible} team={team} managerName={manager.name} onOpen={openPerson} />
    : <ManagerDashboard key={`${round}-${manager.id}`} people={visible} cycle={cycle} team={team} managerId={manager.id} onOpen={openPerson}
      onFeedback={() => navigate("feedback")} onReview={person => actFor(person, "review")} />;
  else if (role === "employee") content = current ? <EmployeeDashboard person={current} cycle={cycle}
    onWork={() => navigate("work")} onAction={handleAction} feedbackPending={feedbackPending} onFeedback={() => navigate("feedback")} />
    : <Heading title={t("ยังไม่มีรอบประเมินของคุณ")} description={t("ตรวจสอบทีมที่เข้าร่วมกับ HR")} />;
  else content = <HrDashboard people={visible} cycle={cycle} filters={filters} onFilters={setFilters}
    onOpen={openPerson} onExport={exportCsv} onSetup={() => navigate("setup")} onBacklog={() => navigate("backlog")} onRemind={remindManager}
    onAppeals={() => navigate("appeals")} onCalibration={() => navigate("calibration")} />;

  return <>
    <div className="shell">
      <aside className="rail" inert={waiting}>
        <div className="brand"><span className="brand-mark"><BrandMark size={44} /></span><div>Performance<span>Workspace</span></div></div>
        <nav aria-label={t("เมนูหลัก")}>
          {groups.map((group, groupIndex) => <div className="nav-group" key={group.label ?? groupIndex}>
            {group.label && <p className="nav-label">{group.label}</p>}
            {group.items.map(item => {
              const label = <>
                <span className="nav-icon"><Icon name={item.page} /></span>
                <span className="nav-text">{item.label}{item.locked && <small>{t("เปิดเมื่อเริ่มรอบ")}</small>}</span>
                {!item.locked && item.badge !== undefined && item.badge !== 0 &&
                  <span className={`nav-badge ${item.tone ?? "amber"}`} aria-label={item.badge === "!" ? t("มีสิ่งที่ต้องทำ") : t("{0} รายการ", item.badge)}>{item.badge}</span>}
              </>;
              if (item.locked) return <button key={item.page} type="button" disabled
                title={t("เปิดใช้งานเมื่อ HR เริ่มรอบประเมิน")}>{label}</button>;
              return <a key={item.page} href={pathFor(item.page)} aria-current={page === item.page && !routeUnavailable ? "page" : undefined}
                onClick={event => {
                  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                  event.preventDefault();
                  if (role === "hr" && item.page === "overview") setFilters(emptyFilters);
                  navigate(item.page);
                }}>{label}</a>;
            })}
          </div>)}
        </nav>
        <div className="rail-footer">
          <div className="workspace-toggle" role="group" aria-label={t("ภาษา")}>
            {(["th", "en"] as const).map(next => <button key={next} type="button" lang={next} aria-pressed={next === language}
              aria-label={t(next === "th" ? "ภาษาไทย" : "ภาษาอังกฤษ")} onClick={() => {
                setLanguage(next);
                setNotice("");
              }}>{next.toUpperCase()}</button>)}
          </div>
          <div className="rail-user"><span className="avatar">{{ hr: "HR", manager: "MA", employee: "EM" }[role]}</span>
            <div><strong>{roleLabel}</strong><span>{t(cycle.name)}</span></div></div>
          <p><span className="small-dot" />{" " + t("พื้นที่สาธิต · ข้อมูลสมมติ")}</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="top" inert={waiting}>
          <span className="crumbs">People Operations <span className="crumb-slash">/</span> <strong>Performance</strong></span>
          <div className="actions role-controls">
            <div className="workspace-toggle" role="group" aria-label={t("ทดลองในบทบาท")}>
              {(Object.keys(demoRoles) as Role[]).map(next => <button key={next} type="button" aria-pressed={next === role}
                onClick={() => { if (next !== role) switchWorkspace(next); }}>{t(demoRoles[next])}</button>)}
            </div>
            {role === "manager" && <label>{t("ดูในนาม")} <select value={manager.id}
              onChange={event => switchWorkspace("manager", round, event.target.value)}>
              {cycleManagers.map(person => <option key={person.id} value={person.id}>{person.name} · {person.team}</option>)}
            </select></label>}
            {role === "employee" && <label>{t("พนักงาน") + " "}<select value={employee?.id ?? ""}
              onChange={event => switchWorkspace("employee", round, event.target.value)}>
              {participants.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select></label>}
            {history.length > 0 && <label>{t("รอบประเมิน")} <select value={round}
              onChange={event => switchWorkspace(role, Number(event.target.value), actor)}>
              <option value={latestRound}>{t("รอบล่าสุด · {0}", t(workspace.cycle.name))}</option>
              {history.map(({ cycle: past }, index) => {
                const roundNumber = latestRound - index - 1;
                return <option key={roundNumber} value={roundNumber}>{t("รอบก่อนหน้า {0} · {1}", index + 1, t(past.name))}</option>;
              })}
            </select></label>}
          </div>
        </header>
        <main ref={main} tabIndex={-1}>
          {connection === "loading" && <p role="status">{t("กำลังโหลดข้อมูลจากเซิร์ฟเวอร์")}</p>}
          {connection === "error" && <div className="stack">
            <p role="alert">{t("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้")}</p>
            <div><Button onClick={reloadWorkspace}>{t("ลองเชื่อมต่ออีกครั้ง")}</Button></div>
          </div>}
          <div hidden={connection !== "ready"} inert={saving} aria-busy={saving}>{content}</div>
        </main>
      </div>
    </div>
    <dialog ref={dialog} aria-labelledby="modal-title" inert={saving}
      onCancel={event => { event.preventDefault(); if (!writeInProgress.current) setForm(undefined); }}>
      {form && <ActionForm spec={form} onClose={() => setForm(undefined)} />}
    </dialog>
    <div className="floating-actions">
      <div id="notice" role="status" aria-live="polite">{saving ? t("กำลังบันทึกข้อมูล") : notice}</div>
      <a className="btn part-two-link" href={`${import.meta.env.BASE_URL}Q2_ANS_Vutthipatr.pdf`}
        target="_blank" rel="noopener noreferrer">
        Part 2 — Questions (PDF)<span className="sr-only"> · {t("เปิดในแท็บใหม่")}</span>
      </a>
    </div>
  </>;
}

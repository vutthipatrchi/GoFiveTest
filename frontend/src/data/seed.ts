import type { Goal, Person, Review, Role, Status, Team } from "../types";

/** What each team's KPIs mean in practice, shown with every goal (required when a manager edits a plan). */
const responsibilities: Record<Team, Record<string, string>> = {
  Operations: {
    "ส่งมอบงานตามกำหนด": "ส่งมอบงานปฏิบัติการตามกำหนดที่ตกลงกับทีมผู้รับงาน วัดจากระบบติดตามงาน",
    "ปรับปรุงกระบวนการทำงาน": "เสนอและนำการปรับปรุงขั้นตอนงานไปใช้จริง โดยมีตัวเลขก่อน-หลังยืนยัน",
    "เวลาตอบกลับคำขอ": "ตอบกลับคำขอจากทีมอื่นภายในเวลาที่กำหนด วัดเฉลี่ยจากระบบรับคำขอ",
  },
  People: {
    "ส่งมอบงานตามกำหนด": "ดำเนินงานบริการพนักงานให้เสร็จตามกำหนดที่แจ้งผู้ขอ วัดจากระบบรับเรื่อง",
    "ปรับปรุงกระบวนการทำงาน": "ปรับปรุงขั้นตอนงานบุคคลให้พนักงานได้รับบริการเร็วขึ้น โดยมีผลวัดยืนยัน",
    "เวลาตอบกลับคำขอ": "ตอบกลับคำถามของพนักงานภายในเวลาที่กำหนด วัดเฉลี่ยจากระบบรับเรื่อง",
  },
  Finance: {
    "ส่งมอบงานตามกำหนด": "ส่งรายงานและงานปิดบัญชีตามปฏิทินการเงิน วัดจากบันทึกการส่งงาน",
    "ปรับปรุงกระบวนการทำงาน": "ลดขั้นตอนซ้ำในงานการเงินและทดสอบกับข้อมูลจริงก่อนใช้",
    "เวลาตอบกลับคำขอ": "ตอบกลับคำขอเบิกจ่ายและสอบถามยอดภายในเวลาที่กำหนด วัดจากระบบรับคำขอ",
  },
};

const makeGoals = (first: number, second: number): Goal[] => [
  { name: "ส่งมอบงานตามกำหนด", unit: "%", weight: 60, target: 95, actual: first, cutoffs: [80, 95, 98, 100] },
  { name: "ปรับปรุงกระบวนการทำงาน", unit: "รายการ", weight: 40, target: 4, actual: second, cutoffs: [2, 4, 5, 6] }
];
const demoReview: Review = { rating: 4, feedback: "ส่งงานตามแผนและมีหลักฐานการปรับปรุงกระบวนการชัดเจน", next: "ติดตามผลหลังนำกระบวนการใหม่ไปใช้" };
const demoDecision = { level: 3, proposed: 4, reason: "ส่งมอบได้ตามเป้าหมาย แต่ตัวอย่างที่แนบยังไม่แสดงผลกระทบเกินขอบเขตตำแหน่ง", next: "ทบทวนคุณภาพงานที่ส่งมอบในรอบถัดไป", followUp: "2026-12-15" };
type DemoPerson = Omit<Person, "activity" | "cohort" | "due"> & Partial<Pick<Person, "due">>;
const demoPeople: DemoPerson[] = [
  { id: "E101", name: "ณิชา สิริวัฒน์", initials: "NS", team: "Operations", title: "Operations Specialist", status: "employee", goals: makeGoals(93,3), due: "2026-11-25" },
  { id: "E102", name: "กิตติพงศ์ มีสุข", initials: "KM", team: "Operations", title: "Operations Analyst", status: "manager", goals: makeGoals(97,4), due: "2026-11-20" },
  { id: "E103", name: "ศิริพร วงศ์ดี", initials: "SW", team: "Operations", title: "Project Coordinator", status: "hr", goals: makeGoals(96,4), review: demoReview, due: "2026-11-25" },
  { id: "E201", name: "ธนากร ภูวดล", initials: "TP", team: "People", title: "People Partner", status: "employee", goals: makeGoals(91,2), due: "2026-11-25" },
  { id: "E202", name: "ภัทรา จันทร์งาม", initials: "PC", team: "People", title: "People Operations", status: "published", goals: makeGoals(100,4), review: demoReview, decision: demoDecision, due: "2026-11-25" },
  { id: "E301", name: "นที พัฒนกิจ", initials: "NP", team: "Finance", title: "Finance Analyst", status: "decided", goals: makeGoals(98,4), review: demoReview, decision: demoDecision, due: "2026-11-25" },
  { id: "E104", name: "ปรียา แสงทอง", initials: "PS", team: "Operations", title: "Operations Specialist", status: "hr", goals: makeGoals(100,6), review: { rating: 5, feedback: "สร้างคู่มือที่อีกสองทีมใช้ซ้ำ ลดเวลาส่งต่องาน", next: "นำโครงการปรับปรุงงานข้ามทีม" } },
  { id: "E105", name: "ภาคิน ตั้งใจ", initials: "PT", team: "Operations", title: "Operations Specialist", status: "hr", goals: makeGoals(78,2), review: { rating: 2, feedback: "พลาดกำหนดส่งงานสำคัญสองครั้ง ทีมต้องจัดคิวใหม่", next: "จับคู่กับพี่เลี้ยงและนัดติดตามทุกสัปดาห์" } },
  { id: "E204", name: "มนัสวี พรชัย", initials: "MP", team: "People", title: "People Specialist", status: "hr", goals: makeGoals(97,4), review: { ...demoReview, rating: 5 } },
  { id: "E205", name: "รมิดา วัฒนากุล", initials: "RW", team: "People", title: "People Specialist", status: "manager", goals: makeGoals(96,4) },
  { id: "E302", name: "ธันวา ใจดี", initials: "TJ", team: "Finance", title: "Finance Specialist", status: "employee", goals: makeGoals(96,4) },
  { id: "E303", name: "ลลิตา วงศ์ทอง", initials: "LW", team: "Finance", title: "Finance Specialist", status: "manager", goals: [
    { name: "เวลาตอบกลับคำขอ", unit: "ชม.", weight: 60, target: 24, actual: 15, direction: "lower", cutoffs: [36, 24, 16, 8] },
    makeGoals(95,4)[1]
  ] },
  { id: "E304", name: "มานพ ศรีสุข", initials: "MS", team: "Finance", title: "Finance Specialist", status: "hr", goals: makeGoals(96,4), review: demoReview },
  { id: "E106", name: "พิมพ์ชนก แก้วมณี", initials: "PK", team: "Operations", managerId: "Operations-2", title: "Operations Coordinator", status: "approval", goals: makeGoals(98,4),
    summary: "ลดงานค้างด้วยการจัดลำดับคำขอประจำวัน", submission: { submittedOn: "2026-11-21", approvalDue: "2026-11-28" } },
  { id: "E107", name: "รวิศ อุดมสุข", initials: "RU", team: "Operations", managerId: "Operations-2", title: "Operations Analyst", status: "employee", goals: makeGoals(90,2) },
  { id: "E108", name: "สิรินดา ภักดี", initials: "SP", team: "Operations", managerId: "Operations-2", title: "Operations Specialist", status: "decided", goals: makeGoals(99,5),
    review: { rating: 4, feedback: "ส่งมอบงานตรงเวลาและช่วยทดลองลดงานแก้ไขซ้ำในทีม", next: "ติดตามผลหลังนำไปใช้จริง" },
    decision: { level: 3, proposed: 4, reason: "ผลการลดงานแก้ไขมีหลักฐานเฉพาะช่วงทดลอง HR ยืนยันตามผลงานที่ตรวจสอบได้ในรอบนี้",
      next: "วัดจำนวนงานแก้ไขซ้ำต่อเนื่องหลังนำไปใช้จริง", followUp: "2026-12-15" } },
  { id: "E206", name: "จิราภรณ์ อารี", initials: "JA", team: "People", managerId: "People-2", title: "People Coordinator", status: "employee", goals: makeGoals(92,3) },
  { id: "E207", name: "ธนพล รุ่งเรือง", initials: "TR", team: "People", managerId: "People-2", title: "People Analyst", status: "approval", goals: makeGoals(96,4),
    summary: "จัดกลุ่มคำขอของพนักงานเพื่อให้รับเรื่องได้เร็วขึ้น", submission: { submittedOn: "2026-11-21", approvalDue: "2026-11-28" } },
  { id: "E208", name: "อัญชลี ปัญญาดี", initials: "AP", team: "People", managerId: "People-2", title: "People Specialist", status: "hr", goals: makeGoals(99,5), review: demoReview },
  { id: "E305", name: "วรพล อ่อนสกุล", initials: "WO", team: "Finance", managerId: "Finance-2", title: "Finance Analyst", status: "manager", goals: makeGoals(96,4) },
  { id: "E306", name: "รัชนี แสงเทียน", initials: "RS", team: "Finance", managerId: "Finance-2", title: "Finance Specialist", status: "employee", goals: makeGoals(94,3) },
  { id: "E307", name: "ปกรณ์ วงศ์ดี", initials: "PW", team: "Finance", managerId: "Finance-2", title: "Finance Coordinator", status: "approval", goals: makeGoals(97,4),
    summary: "ปรับแบบตรวจรายการกระทบยอดและทดสอบกับข้อมูลเดือนล่าสุด", submission: { submittedOn: "2026-11-22", approvalDue: "2026-11-29" } },
];

/** Work summaries for everyone who has already sent their results to a manager. */
const summaries: Record<string, string> = {
  E102: "ตรวจความครบถ้วนของรายงานรายวันจนข้อผิดพลาดลดลง และเพิ่มการแจ้งเตือนงานใกล้ครบกำหนด",
  E103: "ประสานโครงการย้ายระบบรับคำขอให้เสร็จตามแผน และสรุปบทเรียนให้ทีมใช้ต่อ",
  E104: "สร้างคู่มือส่งต่องานที่อีกสองทีมนำไปใช้ซ้ำ ลดเวลาส่งต่องานลงเกือบครึ่ง",
  E105: "ดูแลคำขอประจำวันของทีม แต่มีงานสำคัญสองชิ้นที่ส่งช้ากว่ากำหนด",
  E108: "ปรับขั้นตอนตรวจคุณภาพงานส่งมอบ ทำให้งานแก้ไขซ้ำลดลง",
  E202: "ปรับขั้นตอนรับเรื่องของพนักงานให้ตอบกลับได้เร็วขึ้นและติดตามสถานะได้",
  E204: "ออกแบบแบบสำรวจความพึงพอใจและนำผลไปปรับปรุงบริการ 3 เรื่อง",
  E205: "ปรับปรุงคู่มือพนักงานใหม่และสรุปผลอบรมประจำเดือน",
  E208: "จัดทำรายงานอบรมรายเดือนและลดเวลาเตรียมข้อมูลลงด้วยแบบฟอร์มกลาง",
  E301: "ส่งรายงานปิดบัญชีก่อนกำหนดทุกเดือน และปรับแบบฟอร์มลดขั้นตอนซ้ำ",
  E303: "ลดเวลาตอบกลับคำขอเบิกจ่ายจากเฉลี่ย 24 เหลือ 15 ชั่วโมง",
  E304: "กระทบยอดบัญชีธนาคารครบทุกเดือนและติดตามรายการค้างจนปิดได้",
  E305: "ตรวจเอกสารเบิกจ่ายตามนโยบายและสรุปค่าใช้จ่ายเทียบงบประมาณ",
};

const reached: Record<Status, number> = { employee: 0, approval: 1, manager: 2, returned: 2, hr: 3, decided: 4, published: 5 };
const stamp = (day: string, time = "10:00") => `${day}T${time}:00+07:00`;

/** Audit trail that matches how far each person has progressed. Newest first, like live entries. */
function history(person: DemoPerson, submittedOn: string): Person["activity"] {
  const step = reached[person.status];
  const entries: { role: Role; message: string; at: string }[] = [
    { role: "manager", message: "มอบหมายแผน KPI", at: stamp("2026-07-01", "09:30") },
    { role: "hr", message: "แผน KPI มีผล", at: stamp("2026-07-03", "14:10") },
    { role: "employee", message: "บันทึกความคืบหน้า KPI", at: stamp("2026-10-31", "16:45") },
  ];
  if (step >= 1) entries.push({ role: "employee", message: "ส่งสรุปผลงานให้ Manager", at: stamp(submittedOn, "17:20") });
  if (step >= 2) entries.push({ role: "manager", message: "อนุมัติผลงาน", at: stamp("2026-11-17", "11:00") });
  if (step >= 3) entries.push({ role: "manager", message: "ประเมินผลงานและส่ง HR", at: stamp("2026-11-19", "15:30") });
  if (step >= 4) entries.push({ role: "hr", message: "ยืนยันระดับสุดท้าย", at: stamp("2026-11-20", "13:00") });
  if (step >= 5) entries.push({ role: "hr", message: "เผยแพร่ผลให้พนักงานแล้ว", at: stamp("2026-11-21", "09:00") });
  return entries.reverse();
}

/** Two check-ins per KPI: the latest result and an earlier month-end reading a little short of it. */
function progressHistory(goal: Goal): Goal["updates"] {
  const earlier = goal.unit === "%" ? Math.max(0, goal.actual - 3)
    : goal.direction === "lower" ? Math.round(goal.actual * 1.25) : Math.max(0, goal.actual - 1);
  return [
    { recordedOn: "2026-11-14", actual: goal.actual, period: goal.period!, evidence: goal.evidence!, note: "ผลล่าสุดก่อนส่งสรุปผลงาน" },
    { recordedOn: "2026-10-31", actual: earlier, period: "ก.ค.–ต.ค. 2026", evidence: `รายงาน${goal.name}ประจำเดือนตุลาคม`, note: "บันทึกสิ้นเดือน" },
  ];
}

export const seed: Person[] = demoPeople.map(person => {
  const submittedOn = person.submission?.submittedOn ?? "2026-11-14";
  const passedApproval = reached[person.status] >= 2;
  return {
    due: "2026-11-25",
    cohort: person.id === "E201" ? "งานที่ปรึกษาบุคลากร · Partner"
      : person.team === "Finance" ? "งานการเงินระดับปฏิบัติการ"
      : "งานบริการและปฏิบัติการระดับ Specialist",
    goalsAcceptedOn: "2026-07-03",
    ...person,
    activity: history(person, submittedOn),
    summary: person.summary ?? summaries[person.id],
    submission: person.submission ?? (passedApproval
      ? { submittedOn, approvalDue: "2026-11-21", decision: "approved", decidedOn: "2026-11-17" } : undefined),
    goals: person.goals.map((goal, index) => {
      const measured: Goal = {
        ...goal,
        responsibility: responsibilities[person.team][goal.name],
        period: "ก.ค.–พ.ย. 2026",
        evidence: `รายงาน${goal.name}ของทีม ${person.team} บันทึกผลจริง ${goal.actual} ${goal.unit}`,
      };
      if (person.id !== "E102" || index !== 0) return { ...measured, updates: progressHistory(measured) };
      return { ...measured, updates: [
        { recordedOn: "2026-11-18", actual: measured.actual, period: measured.period!,
          evidence: measured.evidence!, note: "เริ่มแจ้งเตือนงานใกล้ครบกำหนดก่อนส่งมอบ" },
        { recordedOn: "2026-10-30", actual: 92, period: "ก.ค.–ต.ค. 2026",
          evidence: "รายงานกำหนดส่งงานเดือนตุลาคม", note: "งานบางรายการรอข้อมูลจากอีกทีม" },
      ] };
    }),
    decision: person.id === "E301" ? { ...person.decision!, level: 4, proposed: 4, reason: "ตรวจหลักฐานงานที่ส่งก่อนกำหนดและผลการปรับปรุงกระบวนการแล้ว" } : person.decision
  };
});

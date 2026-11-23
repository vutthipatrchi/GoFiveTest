import { deliveryMetrics } from "../domain/work";
import type { Team, WorkAttempt, WorkItem, WorkSource } from "../types";

const at = (day: number, time: string) => `2026-11-${String(day).padStart(2, "0")}T${time}:00+07:00`;
const reviewed = (day: number, time: string, decision: "approved" | "changes", notes: string) =>
  ({ at: at(day, time), decision, notes });
const attempt = (day: number, time: string, evidence: string, review?: WorkAttempt["review"]) =>
  ({ submittedAt: at(day, time), evidence, ...(review && { review }) });
const task = (title: string, standard: string, day: number, attempts: WorkAttempt[] = []): WorkItem =>
  ({ title, standard, dueAt: at(day, "17:00"), attempts, demo: true });

const samples: Record<string, WorkItem[]> = {
  E101: [
    task("สรุป KPI งานปฏิบัติการรายสัปดาห์", "เทียบผลจริงกับเป้าหมายครบ 3 KPI พร้อมอ้างอิงแหล่งข้อมูล", 16, [
      attempt(16, "15:20", "รายงาน KPI สัปดาห์ที่ 46 พร้อมตารางอ้างอิงจากระบบติดตามงาน",
        reviewed(17, "09:30", "approved", "ตัวเลขตรงกับแหล่งข้อมูลทั้ง 3 KPI และมีคำอธิบายรายการที่ต่ำกว่าเป้า")),
    ]),
    task("ปรับปรุงเช็กลิสต์ส่งต่องาน", "ระบุเจ้าของงาน กำหนดส่ง และขั้นตอนแจ้งปัญหาในทุกรายการ", 18, [
      attempt(18, "16:10", "เช็กลิสต์ฉบับแรกพร้อมตัวอย่างการส่งต่องาน",
        reviewed(19, "10:00", "changes", "เพิ่มชื่อผู้รับผิดชอบในขั้นตอนแจ้งปัญหา")),
      attempt(19, "13:40", "เช็กลิสต์ฉบับแก้ไขพร้อมระบุผู้รับผิดชอบครบ",
        reviewed(20, "09:10", "approved", "ผู้รับผิดชอบชัดเจนและใช้กับตัวอย่างงานจริงได้")),
    ]),
    task("ตรวจสอบรายการคำขอค้าง", "ระบุสาเหตุและแผนจัดการคำขอค้างครบทุกกรณี", 19, [
      attempt(20, "09:15", "รายงานคำขอค้าง 8 รายการ พร้อมเจ้าของและวันติดตาม",
        reviewed(20, "14:30", "approved", "แผนจัดการและวันติดตามครบทั้ง 8 รายการ")),
    ]),
    task("สรุปผลทดลองลดเวลาส่งต่องาน", "มีข้อมูลก่อนและหลังทดลองอย่างน้อย 5 รายการ", 24, [
      attempt(21, "14:25", "ตารางก่อนและหลังทดลองจาก 6 รายการ พร้อมข้อจำกัดของข้อมูล"),
    ]),
    task("จัดทำคู่มือส่งมอบงานประจำเดือน", "คู่มือระบุขั้นตอน ผู้รับผิดชอบ และวิธีตรวจความครบถ้วน", 25),
  ],
  E102: [
    task("ตรวจความครบถ้วนของรายงานรายวัน", "ตรวจข้อมูลครบ 10 รายการและระบุข้อผิดพลาดที่พบ", 20, [
      attempt(20, "15:45", "ใบตรวจรายงาน 10 รายการ พร้อมสรุปข้อผิดพลาดเพื่อให้ทีมแก้ไข"),
    ]),
  ],
  E201: [
    task("สรุปคำขอจากพนักงานประจำสัปดาห์", "สรุปคำขอตามประเภทและระบุผู้รับผิดชอบครบทุกเรื่อง", 19, [
      attempt(19, "16:30", "ตารางสรุปคำขอ 12 เรื่อง แยกประเภทและระบุผู้รับผิดชอบ",
        reviewed(20, "11:15", "approved", "ข้อมูลครบและทีมรับช่วงดำเนินการต่อได้")),
    ]),
  ],
  E302: [
    task("กระทบยอดค่าใช้จ่ายทีม", "จับคู่รายการกับหลักฐานครบและแยกรายการที่ต้องติดตาม", 20, [
      attempt(20, "16:40", "ตารางกระทบยอดค่าใช้จ่าย พร้อมรายการที่ยังต้องยืนยัน",
        reviewed(21, "10:20", "changes", "ระบุรายการที่ยอดต่างและแนบเอกสารอ้างอิงเพิ่มเติม")),
    ]),
  ],
};

type Template = [title: string, standard: string, evidence: string, approvedNote: string, changeNote: string];
const templates: Record<Team, Template[]> = {
  Operations: [
    ["สรุปงานค้างประจำสัปดาห์", "ระบุสาเหตุ เจ้าของงาน และวันปิดงานครบทุกรายการ", "ตารางงานค้างพร้อมเจ้าของงานและวันปิดงาน", "ครบทุกรายการและติดตามต่อได้ทันที", "เพิ่มสาเหตุของงานที่ค้างเกิน 3 วัน"],
    ["ตรวจคุณภาพงานส่งมอบ", "สุ่มตรวจอย่างน้อย 10 รายการและสรุปข้อผิดพลาดที่พบ", "ใบตรวจคุณภาพ 12 รายการพร้อมสรุปข้อผิดพลาด", "จำนวนตัวอย่างครบและสรุปชัดเจน", "แยกข้อผิดพลาดตามประเภทให้ชัดเจน"],
    ["ปรับขั้นตอนรับคำขอ", "มีขั้นตอนใหม่ ผู้รับผิดชอบ และตัวชี้วัดก่อน-หลัง", "แผนผังขั้นตอนใหม่และตัวเลขก่อน-หลังทดลอง 2 สัปดาห์", "เห็นผลลดเวลารอชัดเจน", "เพิ่มตัวเลขก่อนเริ่มทดลอง"],
    ["จัดทำรายงานส่งมอบรายเดือน", "ครอบคลุมงานทุกประเภทพร้อมอ้างอิงแหล่งข้อมูล", "รายงานส่งมอบเดือนตุลาคมพร้อมลิงก์ข้อมูล", "อ้างอิงครบและตรวจย้อนได้", "ระบุแหล่งข้อมูลของตารางสรุป"],
  ],
  People: [
    ["สรุปคำขอจากพนักงาน", "แยกประเภทคำขอและระบุผู้รับผิดชอบครบทุกเรื่อง", "ตารางคำขอ 15 เรื่อง แยกประเภทและผู้รับผิดชอบ", "ทีมรับช่วงดำเนินการต่อได้", "ระบุกำหนดตอบกลับของแต่ละเรื่อง"],
    ["จัดทำแบบสำรวจความพึงพอใจ", "คำถามไม่เกิน 10 ข้อและผ่านการทดสอบกับผู้ใช้ 5 คน", "แบบสำรวจฉบับทดสอบและผลทดสอบกับผู้ใช้ 5 คน", "คำถามชัดและผ่านการทดสอบครบ", "ลดคำถามที่ซ้ำกัน"],
    ["ปรับปรุงคู่มือพนักงานใหม่", "ครอบคลุมสัปดาห์แรกและมีผู้ติดต่อของแต่ละเรื่อง", "คู่มือฉบับปรับปรุงพร้อมรายชื่อผู้ติดต่อ", "พนักงานใหม่ใช้ได้ทันที", "เพิ่มขั้นตอนขอสิทธิ์ระบบ"],
    ["สรุปผลอบรมประจำเดือน", "มีจำนวนผู้เข้าอบรม คะแนนประเมิน และข้อเสนอแนะ", "สรุปผลอบรม 3 หลักสูตรพร้อมคะแนนประเมิน", "ข้อมูลครบและนำไปวางแผนต่อได้", "แนบข้อเสนอแนะจากผู้เข้าอบรม"],
  ],
  Finance: [
    ["กระทบยอดบัญชีธนาคาร", "จับคู่รายการครบและแยกรายการที่ต้องติดตาม", "ตารางกระทบยอดพร้อมรายการรอยืนยัน 3 รายการ", "ยอดตรงและมีแผนติดตามรายการค้าง", "แนบหลักฐานของรายการที่ยอดต่าง"],
    ["ตรวจเอกสารเบิกจ่าย", "ตรวจเอกสารครบทุกฉบับตามนโยบายการเบิกจ่าย", "บันทึกตรวจเอกสารเบิกจ่าย 40 ฉบับ", "ตรวจครบและระบุฉบับที่ต้องแก้", "ระบุข้อนโยบายที่ใช้ตัดสิน"],
    ["สรุปค่าใช้จ่ายเทียบงบประมาณ", "แยกตามหมวดและอธิบายรายการที่เกินงบเกิน 5%", "รายงานค่าใช้จ่ายเทียบงบเดือนตุลาคม", "คำอธิบายรายการเกินงบชัดเจน", "เพิ่มคำอธิบายหมวดที่เกินงบ"],
    ["ปรับแบบฟอร์มปิดบัญชีรายเดือน", "ลดขั้นตอนซ้ำและทดสอบกับข้อมูลจริง 1 เดือน", "แบบฟอร์มใหม่และผลทดสอบกับข้อมูลเดือนกันยายน", "ลดขั้นตอนได้จริงและผลทดสอบครบ", "ทดสอบกับข้อมูลจริงก่อนส่ง"],
  ],
};

const sourceFrom = "2026-07-01";
const sourceAsOf = at(22, "23:59");
/** Tasks due in the measured period. Fifty gives 2% steps, so one late task cannot swing a KPI by a whole level. */
const measuredTasks = 50;

/** Read-only records from the simulated work system, partitioned by employee. */
const roster: [id: string, team: Team, inProgress: boolean, lateTasks: number][] = [
  ["E101", "Operations", true, 3], ["E102", "Operations", true, 2], ["E103", "Operations", false, 2], ["E104", "Operations", false, 0],
  ["E105", "Operations", false, 11], ["E106", "Operations", true, 1], ["E107", "Operations", true, 5], ["E108", "Operations", true, 1],
  ["E201", "People", true, 4], ["E202", "People", false, 0], ["E204", "People", false, 2], ["E205", "People", true, 2],
  ["E206", "People", true, 4], ["E207", "People", true, 2], ["E208", "People", false, 1],
  ["E301", "Finance", false, 1], ["E302", "Finance", true, 2], ["E303", "Finance", true, 2], ["E304", "Finance", false, 2],
  ["E305", "Finance", true, 2], ["E306", "Finance", true, 3], ["E307", "Finance", true, 2],
];

/** A working day between July and October, so older tasks spread evenly across the period. */
function historyDay(index: number, count: number) {
  const day = new Date(Date.UTC(2026, 6, 1 + Math.floor(index * 122 / count)));
  const weekday = day.getUTCDay();
  if (weekday === 0 || weekday === 6) day.setUTCDate(day.getUTCDate() + (weekday === 6 ? 2 : 1));
  return day;
}
const stampOn = (day: Date, offset: number, time: string) => {
  const next = new Date(day);
  next.setUTCDate(next.getUTCDate() + offset);
  return `${next.toISOString().slice(0, 10)}T${time}:00+07:00`;
};

function historyTasks(pool: Template[], order: number, count: number, late: number): WorkItem[] {
  return Array.from({ length: count }, (_, index) => {
    const [title, standard, evidence, approvedNote, changeNote] = pool[(order + index) % pool.length];
    const day = historyDay(index, count);
    const isLate = Math.floor((index + 1) * late / count) > Math.floor(index * late / count);
    const submitted = isLate ? stampOn(day, 1, "10:15") : stampOn(day, 0, "15:10");
    const reviewedAt = stampOn(day, isLate ? 2 : 1, "10:00");
    const attempts: WorkAttempt[] = (order + index) % 5 === 0
      ? [{ submittedAt: submitted, evidence, review: { at: reviewedAt, decision: "changes", notes: changeNote } },
        { submittedAt: stampOn(day, isLate ? 2 : 1, "16:20"), evidence: evidence + " (ฉบับแก้ไข)",
          review: { at: stampOn(day, isLate ? 3 : 2, "09:40"), decision: "approved", notes: approvedNote } }]
      : [{ submittedAt: submitted, evidence, review: { at: reviewedAt, decision: "approved", notes: approvedNote } }];
    return { title, standard, dueAt: stampOn(day, 0, "17:00"), attempts, demo: true };
  }).reverse();
}

roster.forEach(([id, team, inProgress, lateTasks], order) => {
  const items = samples[id] ?? [];
  const pool = templates[team];
  for (let index = 0; items.length < 3; index++) {
    const [title, standard, evidence, approvedNote, changeNote] = pool[(order + index) % pool.length];
    const due = 10 + index * 4;
    const last = items.length === 2;
    const attempts = last && inProgress ? [attempt(due + 1, "14:30", evidence)]
      : index % 2 ? [attempt(due, "15:10", evidence, reviewed(due + 1, "10:00", "changes", changeNote)),
        attempt(due + 1, "16:20", evidence + " (ฉบับแก้ไข)", reviewed(due + 2, "09:40", "approved", approvedNote))]
      : [attempt(due - 1, "16:00", evidence, reviewed(due, "11:00", "approved", approvedNote))];
    items.push(task(title, standard, due + (last && inProgress ? 3 : 0), attempts));
  }
  const recent = deliveryMetrics(items, new Date(sourceAsOf));
  samples[id] = [...items, ...historyTasks(pool, order, measuredTasks - recent.timed, lateTasks - (recent.timed - recent.onTime))];
});

export function sampleWorkSource(personId: string): WorkSource | undefined {
  const items = Object.hasOwn(samples, personId) ? samples[personId] : undefined;
  if (items) return { from: sourceFrom, asOf: sourceAsOf, records: structuredClone(items) };
}

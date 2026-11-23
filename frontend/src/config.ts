import type { Status } from "./types";

export const key = "performance-workspace-v1";
export const demoDate = "2026-11-22";
export const states: Record<Status, [string, string]> = {
  employee: ["รอพนักงานส่ง", ""],
  approval: ["รอ Manager อนุมัติสรุปผลงาน", "amber"],
  manager: ["รอ Manager ประเมิน", "amber"],
  returned: ["รอ Manager ทบทวน", "red"],
  hr: ["รอ HR ตัดสิน", "blue"],
  decided: ["ตัดสินแล้ว", "blue"],
  published: ["เผยแพร่แล้ว", "green"]
};
export const rubric = ["ต้องปรับปรุงมาก", "ต่ำกว่าคาดหวัง", "ตามคาดหวัง", "สูงกว่าคาดหวัง", "โดดเด่น"];
export const anchors = [
  "ละเลยข้อตกลงสำคัญซ้ำแม้ได้รับการสนับสนุน",
  "ทำตามข้อตกลงได้บางส่วนและต้องติดตามบ่อย",
  "ทำตามข้อตกลง สื่อสารความเสี่ยง และส่งต่องานตามมาตรฐาน",
  "แก้ปัญหาเชิงรุกและช่วยให้ทีมส่งมอบงานได้ดีขึ้น",
  "สร้างวิธีทำงานที่ผู้อื่นนำไปใช้ซ้ำและมีหลักฐานว่าได้ผล"
];

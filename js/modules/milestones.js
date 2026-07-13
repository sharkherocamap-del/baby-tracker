import { renderRecordModule } from "./module-factory.js";
import { calculateAge, formatDate } from "../date-utils.js";
import { getState } from "../app-state.js";

const config = {
  title: "Mốc phát triển",
  icon: "emoji_events",
  singular: "Mốc phát triển",
  collection: "milestones",
  dateField: "achievedDate",
  orderByField: "achievedDate",
  recordTitle: "milestoneName",
  recordSubtitle: (record) => {
    const baby = getState().selectedBaby;
    return `${formatDate(record.achievedDate)} · Bé ${calculateAge(baby?.birthDate, record.achievedDate)}`;
  },
  fields: [
    { name: "milestoneName", label: "Tên mốc", type: "text", required: true, maxLength: 250, placeholder: "Biết cười, biết lẫy, nói từ đầu tiên..." },
    { name: "achievedDate", label: "Ngày đạt mốc", type: "datetime-local", required: true },
    { name: "category", label: "Nhóm", type: "select", required: true, defaultValue: "motor", options: [
      { value: "motor", label: "Vận động" }, { value: "language", label: "Ngôn ngữ" }, { value: "social", label: "Xã hội" }, { value: "cognitive", label: "Nhận thức" }, { value: "other", label: "Khác" }
    ] },
    { name: "mediaUrl", label: "URL ảnh/video", type: "url", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1500, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

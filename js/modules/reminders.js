import { renderRecordModule } from "./module-factory.js";
import { formatDateTime } from "../date-utils.js";

const config = {
  title: "Lịch & nhắc việc",
  icon: "notifications",
  singular: "Nhắc việc",
  collection: "reminders",
  dateField: "scheduledAt",
  orderByField: "scheduledAt",
  description: "Nhắc việc chỉ hiển thị khi website đang được mở; không có tiến trình server chạy nền.",
  recordTitle: "title",
  recordSubtitle: (record) => formatDateTime(record.scheduledAt),
  statusField: "completed",
  statusMap: { true: { label: "Hoàn thành", tone: "success" }, false: { label: "Chưa hoàn thành", tone: "warning" } },
  fields: [
    { name: "title", label: "Tiêu đề", type: "text", required: true, maxLength: 250 },
    { name: "reminderType", label: "Loại", type: "select", required: true, defaultValue: "vaccination", options: [
      { value: "vaccination", label: "Tiêm phòng" }, { value: "medical_visit", label: "Khám bệnh" }, { value: "follow_up", label: "Tái khám" },
      { value: "medication", label: "Thuốc" }, { value: "vitamin", label: "Vitamin" }, { value: "growth", label: "Đo cân nặng" }, { value: "other", label: "Sự kiện khác" }
    ] },
    { name: "scheduledAt", label: "Thời điểm", type: "datetime-local", required: true },
    { name: "completed", label: "Đã hoàn thành", type: "checkbox", defaultValue: false },
    { name: "linkedCollection", label: "Collection liên kết", type: "text", maxLength: 100, hideWhenEmpty: true },
    { name: "linkedRecordId", label: "Record ID liên kết", type: "text", maxLength: 200, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

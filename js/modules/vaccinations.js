import { renderRecordModule } from "./module-factory.js";
import { formatDate } from "../date-utils.js";

const statusOptions = [
  { value: "scheduled", label: "Đã lên lịch" }, { value: "upcoming", label: "Sắp đến hạn" },
  { value: "completed", label: "Đã tiêm" }, { value: "overdue", label: "Quá hạn" }, { value: "cancelled", label: "Đã hủy" }
];

const config = {
  title: "Tiêm phòng",
  singular: "Mũi tiêm",
  collection: "vaccinations",
  dateField: "scheduledDate",
  orderByField: "scheduledDate",
  searchFields: ["vaccineName", "diseasePrevention", "clinic", "provider"],
  searchPlaceholder: "Tìm vaccine, bệnh phòng ngừa, cơ sở...",
  filterField: "status",
  filterLabel: "Lọc trạng thái vaccine",
  filterAllLabel: "Tất cả trạng thái",
  filterOptions: statusOptions,
  medicalNote: "Lịch tiêm do người dùng nhập để ghi nhớ; không phải chỉ định y khoa bắt buộc.",
  recordTitle: "vaccineName",
  recordSubtitle: (record) => `Dự kiến: ${formatDate(record.scheduledDate)}${record.administeredDate ? ` · Đã tiêm: ${formatDate(record.administeredDate)}` : ""}`,
  statusField: "status",
  statusMap: {
    scheduled: { label: "Đã lên lịch", tone: "default" }, upcoming: { label: "Sắp đến hạn", tone: "warning" },
    completed: { label: "Đã tiêm", tone: "success" }, overdue: { label: "Quá hạn", tone: "danger" }, cancelled: { label: "Đã hủy", tone: "default" }
  },
  fields: [
    { name: "vaccineName", label: "Tên vaccine", type: "text", required: true, maxLength: 160 },
    { name: "diseasePrevention", label: "Phòng bệnh", type: "text", maxLength: 250, hideWhenEmpty: true },
    { name: "doseNumber", label: "Mũi số", type: "number", min: 1, max: 30, step: 1, required: true, defaultValue: 1 },
    { name: "scheduledDate", label: "Ngày dự kiến", type: "datetime-local", required: true },
    { name: "administeredDate", label: "Ngày tiêm thực tế", type: "datetime-local", hideWhenEmpty: true },
    { name: "status", label: "Trạng thái", type: "select", required: true, options: statusOptions, defaultValue: "scheduled" },
    { name: "clinic", label: "Cơ sở tiêm", type: "text", maxLength: 250, hideWhenEmpty: true },
    { name: "provider", label: "Người thực hiện", type: "text", maxLength: 160, hideWhenEmpty: true },
    { name: "batchNumber", label: "Số lô", type: "text", maxLength: 100, hideWhenEmpty: true },
    { name: "reactions", label: "Phản ứng sau tiêm", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "documentUrl", label: "URL chứng nhận", type: "url", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

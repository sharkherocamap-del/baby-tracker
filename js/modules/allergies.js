import { renderRecordModule } from "./module-factory.js";

const config = {
  title: "Dị ứng",
  icon: "allergies",
  singular: "Dị ứng",
  collection: "allergies",
  dateField: "discoveredAt",
  orderByField: "discoveredAt",
  recordTitle: "allergen",
  statusField: "severity",
  statusMap: { mild: { label: "Nhẹ", tone: "success" }, moderate: { label: "Vừa", tone: "warning" }, severe: { label: "Nghiêm trọng", tone: "danger" } },
  fields: [
    { name: "allergen", label: "Tác nhân dị ứng", type: "text", required: true, maxLength: 200 },
    { name: "allergyType", label: "Loại", type: "select", required: true, defaultValue: "food", options: [
      { value: "food", label: "Thực phẩm" }, { value: "medicine", label: "Thuốc" }, { value: "environment", label: "Môi trường" }, { value: "other", label: "Khác" }
    ] },
    { name: "discoveredAt", label: "Ngày phát hiện", type: "datetime-local", required: true },
    { name: "symptoms", label: "Biểu hiện", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "severity", label: "Mức độ", type: "select", required: true, defaultValue: "mild", options: [
      { value: "mild", label: "Nhẹ" }, { value: "moderate", label: "Vừa" }, { value: "severe", label: "Nghiêm trọng" }
    ] },
    { name: "treatment", label: "Xử trí đã thực hiện", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "confirmedByDoctor", label: "Đã được bác sĩ xác nhận", type: "checkbox", defaultValue: false },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

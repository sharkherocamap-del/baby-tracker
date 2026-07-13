import { renderRecordModule } from "./module-factory.js";
import { formatDateTime } from "../date-utils.js";
import { showToast } from "../toast.js";

const config = {
  title: "Nhiệt độ & triệu chứng",
  icon: "thermometer",
  singular: "Bản ghi triệu chứng",
  collection: "symptomRecords",
  dateField: "recordedAt",
  orderByField: "recordedAt",
  searchFields: ["symptoms", "otherSymptom", "notes"],
  medicalNote: "Ứng dụng không tự chẩn đoán. Khi tình trạng nghiêm trọng hoặc bạn lo lắng, hãy liên hệ cơ sở y tế phù hợp.",
  recordTitle: (record) => `Ghi nhận ${formatDateTime(record.recordedAt)}`,
  statusField: "severity",
  statusMap: { mild: { label: "Nhẹ", tone: "success" }, moderate: { label: "Vừa", tone: "warning" }, severe: { label: "Nghiêm trọng", tone: "danger" } },
  fields: [
    { name: "recordedAt", label: "Thời điểm ghi", type: "datetime-local", required: true },
    { name: "temperatureCelsius", label: "Nhiệt độ", type: "number", min: 30, max: 45, step: 0.1, suffix: "°C", hideWhenEmpty: true },
    { name: "symptoms", label: "Triệu chứng (ngăn cách bằng dấu phẩy)", type: "array", maxLength: 1000, full: true, help: "Ví dụ: Ho, Sổ mũi, Nghẹt mũi", hideWhenEmpty: true },
    { name: "otherSymptom", label: "Triệu chứng khác", type: "text", maxLength: 300, hideWhenEmpty: true },
    { name: "severity", label: "Mức độ", type: "select", required: true, defaultValue: "mild", options: [
      { value: "mild", label: "Nhẹ" }, { value: "moderate", label: "Vừa" }, { value: "severe", label: "Nghiêm trọng" }
    ] },
    { name: "startedAt", label: "Bắt đầu", type: "datetime-local", required: true },
    { name: "endedAt", label: "Kết thúc", type: "datetime-local", afterField: "startedAt", afterLabel: "thời điểm bắt đầu", hideWhenEmpty: true },
    { name: "active", label: "Triệu chứng còn hoạt động", type: "checkbox", defaultValue: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1500, full: true, hideWhenEmpty: true }
  ],
  beforeSave(payload) {
    if (payload.severity === "severe") showToast("Triệu chứng được đánh dấu nghiêm trọng. Hãy cân nhắc liên hệ cơ sở y tế.", "warning", 7000);
    return payload;
  }
};
export function render(container) { return renderRecordModule(container, config); }

import { renderRecordModule } from "./module-factory.js";
import { formatDate } from "../date-utils.js";

const config = {
  title: "Hồ sơ khám bệnh",
  icon: "stethoscope",
  singular: "Lần khám",
  collection: "medicalVisits",
  dateField: "visitDate",
  orderByField: "visitDate",
  searchFields: ["reason", "symptoms", "doctorName", "facility", "diagnosisByDoctor", "treatmentPlan"],
  searchPlaceholder: "Tìm bác sĩ, bệnh viện, triệu chứng, chẩn đoán...",
  medicalNote: "Chỉ ghi lại nội dung do cơ sở y tế hoặc người dùng cung cấp; ứng dụng không tự chẩn đoán.",
  recordTitle: (record) => record.reason || `Khám ngày ${formatDate(record.visitDate)}`,
  recordSubtitle: (record) => `${formatDate(record.visitDate)}${record.facility ? ` · ${record.facility}` : ""}`,
  fields: [
    { name: "visitDate", label: "Ngày khám", type: "datetime-local", required: true },
    { name: "reason", label: "Lý do khám", type: "text", required: true, maxLength: 300 },
    { name: "symptoms", label: "Triệu chứng", type: "textarea", maxLength: 1500, full: true, hideWhenEmpty: true },
    { name: "temperatureCelsius", label: "Nhiệt độ", type: "number", min: 30, max: 45, step: 0.1, suffix: "°C", hideWhenEmpty: true },
    { name: "weightKg", label: "Cân nặng", type: "number", min: 0.01, max: 100, step: 0.01, suffix: "kg", hideWhenEmpty: true },
    { name: "doctorName", label: "Bác sĩ", type: "text", maxLength: 160, hideWhenEmpty: true },
    { name: "facility", label: "Cơ sở y tế", type: "text", maxLength: 250, hideWhenEmpty: true },
    { name: "diagnosisByDoctor", label: "Chẩn đoán của bác sĩ", type: "textarea", maxLength: 1500, full: true, hideWhenEmpty: true },
    { name: "treatmentPlan", label: "Kế hoạch điều trị", type: "textarea", maxLength: 2000, full: true, hideWhenEmpty: true },
    { name: "followUpDate", label: "Ngày tái khám", type: "datetime-local", hideWhenEmpty: true },
    { name: "prescriptionUrl", label: "URL đơn thuốc", type: "url", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "testResultUrl", label: "URL kết quả xét nghiệm", type: "url", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1500, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

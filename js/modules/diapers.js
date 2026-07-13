import { renderRecordModule } from "./module-factory.js";
import { formatDateTime } from "../date-utils.js";

const config = {
  title: "Thay tã & tiêu hóa",
  icon: "baby_changing_station",
  singular: "Lần thay tã",
  collection: "diaperRecords",
  dateField: "changedAt",
  orderByField: "changedAt",
  recordTitle: (record) => `Thay tã lúc ${formatDateTime(record.changedAt)}`,
  fields: [
    { name: "changedAt", label: "Thời điểm", type: "datetime-local", required: true },
    { name: "diaperType", label: "Loại tã", type: "select", required: true, defaultValue: "wet", options: [
      { value: "wet", label: "Tã ướt" }, { value: "dirty", label: "Đi ngoài" }, { value: "both", label: "Cả hai" }, { value: "dry", label: "Tã khô" }
    ] },
    { name: "stoolColor", label: "Màu phân", type: "text", maxLength: 100, hideWhenEmpty: true },
    { name: "stoolConsistency", label: "Độ đặc", type: "text", maxLength: 100, hideWhenEmpty: true },
    { name: "abnormal", label: "Có điểm bất thường", type: "checkbox", defaultValue: false },
    { name: "abnormalDetails", label: "Mô tả bất thường", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ]
};
export function render(container) { return renderRecordModule(container, config); }

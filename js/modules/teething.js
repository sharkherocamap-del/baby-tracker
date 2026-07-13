import { renderRecordModule } from "./module-factory.js";
import { createElement } from "../ui.js";
import { formatDate } from "../date-utils.js";

let toothGrid = null;

const positions = ["U-R5","U-R4","U-R3","U-R2","U-R1","U-L1","U-L2","U-L3","U-L4","U-L5","L-R5","L-R4","L-R3","L-R2","L-R1","L-L1","L-L2","L-L3","L-L4","L-L5"];

const config = {
  title: "Mọc răng",
  icon: "dentistry",
  singular: "Bản ghi mọc răng",
  collection: "teethingRecords",
  dateField: "eruptedDate",
  orderByField: "eruptedDate",
  recordTitle: "toothPosition",
  recordSubtitle: (record) => `Nhú ngày ${formatDate(record.eruptedDate)}`,
  fields: [
    { name: "toothPosition", label: "Vị trí răng", type: "select", required: true, options: positions.map((value) => ({ value, label: value })) },
    { name: "symptomStartDate", label: "Bắt đầu biểu hiện", type: "datetime-local", hideWhenEmpty: true },
    { name: "eruptedDate", label: "Ngày nhú răng", type: "datetime-local", required: true },
    { name: "symptoms", label: "Biểu hiện", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  renderTop(container) {
    const card = createElement("section", { className: "card mb-2" });
    card.append(createElement("h3", { text: "Sơ đồ răng đơn giản" }), createElement("p", { className: "muted small mb-1", text: "U: hàm trên, L: hàm dưới; R/L: bên phải/trái." }));
    toothGrid = createElement("div", { className: "tooth-grid" });
    positions.forEach((position) => toothGrid.append(createElement("div", { className: "tooth", text: position, attrs: { "data-tooth": position } })));
    card.append(toothGrid); container.append(card);
  },
  afterRecordsRender(records) {
    const erupted = new Set(records.map((record) => record.toothPosition));
    toothGrid?.querySelectorAll("[data-tooth]").forEach((tooth) => tooth.classList.toggle("erupted", erupted.has(tooth.dataset.tooth)));
  },
  cleanup() { toothGrid = null; }
};
export function render(container) { return renderRecordModule(container, config); }

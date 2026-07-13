import { renderRecordModule } from "./module-factory.js";
import { formatDate } from "../date-utils.js";
import { createElement } from "../ui.js";
import { showToast } from "../toast.js";

let charts = [];
let chartCanvases = {};

const config = {
  title: "Theo dõi tăng trưởng",
  singular: "Bản ghi tăng trưởng",
  collection: "growthRecords",
  dateField: "measuredAt",
  orderByField: "measuredAt",
  emptyIcon: "📈",
  description: "Ghi cân nặng, chiều cao và vòng đầu; không tự đánh giá tình trạng phát triển.",
  medicalNote: "Biểu đồ chỉ thể hiện dữ liệu gia đình đã nhập. Ứng dụng không kết luận thiếu cân, thừa cân hoặc chậm phát triển.",
  recordTitle: (record) => `Đo ngày ${formatDate(record.measuredAt)}`,
  fields: [
    { name: "measuredAt", label: "Thời điểm đo", type: "datetime-local", required: true },
    { name: "weightKg", label: "Cân nặng", type: "number", min: 0.01, max: 100, step: 0.01, suffix: "kg", hideWhenEmpty: true },
    { name: "heightCm", label: "Chiều cao", type: "number", min: 0.1, max: 250, step: 0.1, suffix: "cm", hideWhenEmpty: true },
    { name: "headCircumferenceCm", label: "Vòng đầu", type: "number", min: 0.1, max: 100, step: 0.1, suffix: "cm", hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  beforeSave(payload) {
    if (![payload.weightKg, payload.heightCm, payload.headCircumferenceCm].some((value) => Number.isFinite(value) && value > 0)) {
      showToast("Hãy nhập ít nhất một chỉ số tăng trưởng.", "warning");
      return false;
    }
    return payload;
  },
  renderTop(container) {
    const card = createElement("section", { className: "card mb-2" });
    card.append(createElement("h3", { text: "Biểu đồ tăng trưởng" }));
    const grid = createElement("div", { className: "grid mt-2" });
    chartCanvases = {};
    [["weightKg", "Cân nặng (kg)"], ["heightCm", "Chiều cao (cm)"], ["headCircumferenceCm", "Vòng đầu (cm)"]].forEach(([key, label]) => {
      const wrapper = createElement("div", { className: "chart-container" });
      wrapper.append(createElement("h3", { text: label }));
      const canvas = createElement("canvas", { attrs: { "aria-label": label, role: "img" } });
      wrapper.append(canvas);
      chartCanvases[key] = { canvas, label };
      grid.append(wrapper);
    });
    card.append(grid);
    container.append(card);
  },
  afterRecordsRender(records) {
    charts.forEach((chart) => chart.destroy());
    charts = [];
    if (!window.Chart) return;
    const sorted = [...records].sort((a, b) => (a.measuredAt?.toMillis?.() || 0) - (b.measuredAt?.toMillis?.() || 0));
    Object.entries(chartCanvases).forEach(([key, meta]) => {
      const points = sorted.filter((record) => Number.isFinite(record[key]));
      charts.push(new window.Chart(meta.canvas, {
        type: "line",
        data: { labels: points.map((record) => formatDate(record.measuredAt)), datasets: [{ label: meta.label, data: points.map((record) => record[key]), tension: .25 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: false } } }
      }));
    });
  },
  cleanup() { charts.forEach((chart) => chart.destroy()); charts = []; }
};

export function render(container) { return renderRecordModule(container, config); }

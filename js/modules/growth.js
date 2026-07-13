import { renderRecordModule } from "./module-factory.js";
import { formatDate } from "../date-utils.js";
import { createElement } from "../ui.js";
import { showToast } from "../toast.js";

const charts = new Map();
let chartCanvases = {};
let lastChartSignature = "";

function destroyCharts() {
  charts.forEach((chart) => chart.destroy());
  charts.clear();
  lastChartSignature = "";
}

function recordTime(record) {
  return record.measuredAt?.toMillis?.() || record.measuredAt?.toDate?.()?.getTime?.() || 0;
}

function chartSignature(records) {
  return records.map((record) => [
    record.id,
    recordTime(record),
    record.weightKg ?? null,
    record.heightCm ?? null,
    record.headCircumferenceCm ?? null
  ].join(":")).join("|");
}

const config = {
  title: "Theo dõi tăng trưởng",
  icon: "monitoring",
  singular: "Bản ghi tăng trưởng",
  collection: "growthRecords",
  dateField: "measuredAt",
  orderByField: "measuredAt",
  emptyIcon: "monitoring",
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
    destroyCharts();
    const card = createElement("section", { className: "card mb-2" });
    card.append(createElement("h3", { text: "Biểu đồ tăng trưởng" }));
    const grid = createElement("div", { className: "grid growth-chart-grid mt-2" });
    chartCanvases = {};
    [["weightKg", "Cân nặng (kg)"], ["heightCm", "Chiều cao (cm)"], ["headCircumferenceCm", "Vòng đầu (cm)"]].forEach(([key, label]) => {
      const panel = createElement("section", { className: "chart-panel" });
      panel.append(createElement("h3", { text: label }));
      const viewport = createElement("div", { className: "chart-container" });
      const canvas = createElement("canvas", { attrs: { "aria-label": label, role: "img" } });
      viewport.append(canvas);
      panel.append(viewport);
      chartCanvases[key] = { canvas, label };
      grid.append(panel);
    });
    card.append(grid);
    container.append(card);
  },
  afterRecordsRender(records) {
    if (!window.Chart) return;
    const sorted = [...records].sort((a, b) => recordTime(a) - recordTime(b));
    const signature = chartSignature(sorted);
    if (signature === lastChartSignature) return;
    lastChartSignature = signature;

    Object.entries(chartCanvases).forEach(([key, meta]) => {
      const points = sorted.filter((record) => Number.isFinite(record[key]));
      const labels = points.map((record) => formatDate(record.measuredAt));
      const values = points.map((record) => record[key]);
      let chart = charts.get(key);

      if (chart && chart.canvas !== meta.canvas) {
        chart.destroy();
        charts.delete(key);
        chart = null;
      }

      if (!chart) {
        chart = new window.Chart(meta.canvas, {
          type: "line",
          data: {
            labels,
            datasets: [{ label: meta.label, data: values, tension: 0.25, pointRadius: 3, pointHoverRadius: 5 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            resizeDelay: 120,
            normalized: true,
            plugins: { legend: { display: false } },
            interaction: { mode: "nearest", intersect: false },
            scales: { y: { beginAtZero: false } }
          }
        });
        charts.set(key, chart);
        return;
      }

      chart.data.labels = labels;
      chart.data.datasets[0].data = values;
      chart.update("none");
    });
  },
  cleanup() {
    destroyCharts();
    chartCanvases = {};
  }
};

export function render(container) {
  return renderRecordModule(container, config);
}

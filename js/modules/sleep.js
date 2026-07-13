import { renderRecordModule } from "./module-factory.js";
import { createBabyRecord } from "../firestore-service.js";
import { getState } from "../app-state.js";
import { durationMinutes, formatDateTime, formatDuration } from "../date-utils.js";
import { createElement } from "../ui.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { setButtonContent } from "../icons.js";

let timerStart = null;
let timerInterval = null;
let timerValue = null;
let chart = null;
let chartCanvas = null;

function updateTimer() {
  if (timerStart && timerValue) timerValue.textContent = formatDuration((Date.now() - timerStart.getTime()) / 60000);
}

const config = {
  title: "Giấc ngủ",
  icon: "bedtime",
  singular: "Giấc ngủ",
  collection: "sleepRecords",
  dateField: "startedAt",
  orderByField: "startedAt",
  recordTitle: (record) => record.sleepType === "night" ? "Giấc ngủ đêm" : "Giấc ngủ ngày",
  recordSubtitle: (record) => `${formatDateTime(record.startedAt)} · ${formatDuration(durationMinutes(record.startedAt, record.endedAt))}`,
  fields: [
    { name: "startedAt", label: "Bắt đầu", type: "datetime-local", required: true },
    { name: "endedAt", label: "Kết thúc", type: "datetime-local", required: true, afterField: "startedAt", afterLabel: "thời điểm bắt đầu" },
    { name: "sleepType", label: "Loại giấc", type: "select", required: true, defaultValue: "night", options: [
      { value: "day", label: "Giấc ngày" }, { value: "night", label: "Giấc đêm" }
    ] },
    { name: "wakeCount", label: "Số lần thức", type: "number", min: 0, max: 100, step: 1, defaultValue: 0 },
    { name: "quality", label: "Chất lượng", type: "select", required: true, defaultValue: "good", options: [
      { value: "good", label: "Tốt" }, { value: "average", label: "Trung bình" }, { value: "poor", label: "Kém" }
    ] },
    { name: "location", label: "Nơi ngủ", type: "text", maxLength: 200, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  renderTop(container) {
    const banner = createElement("section", { className: "timer-banner" });
    const info = createElement("div");
    info.append(createElement("strong", { text: "Timer giấc ngủ" }));
    timerValue = createElement("div", { className: "timer-value", text: "0 phút" });
    info.append(timerValue);
    const actions = createElement("div", { className: "flex gap-1 flex-wrap" });
    const start = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(start, "bedtime", "Bắt đầu ngủ");
    const stop = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
    setButtonContent(stop, "wb_sunny", "Thức dậy & lưu");
    stop.disabled = true;
    start.addEventListener("click", () => {
      timerStart = new Date(); start.disabled = true; stop.disabled = false; updateTimer(); timerInterval = window.setInterval(updateTimer, 1000);
    });
    stop.addEventListener("click", async () => {
      if (!timerStart) return;
      stop.disabled = true;
      try {
        const end = new Date();
        await createBabyRecord(getState().selectedBabyId, "sleepRecords", {
          startedAt: timerStart, endedAt: end, sleepType: timerStart.getHours() >= 18 || timerStart.getHours() < 6 ? "night" : "day", wakeCount: 0, quality: "good", location: "", notes: "Ghi bằng timer"
        });
        showToast("Đã lưu giấc ngủ.", "success");
        timerStart = null; start.disabled = false; timerValue.textContent = "0 phút"; window.clearInterval(timerInterval);
      } catch (error) {
        console.error(error); showToast(friendlyErrorMessage(error, "Không thể lưu giấc ngủ."), "error"); stop.disabled = false;
      }
    });
    actions.append(start, stop); banner.append(info, actions); container.append(banner);

    const chartCard = createElement("section", { className: "card mb-2" });
    chartCard.append(createElement("h3", { text: "Thời lượng ngủ theo bản ghi" }));
    const wrapper = createElement("div", { className: "chart-container mt-2" });
    chartCanvas = createElement("canvas", { attrs: { role: "img", "aria-label": "Biểu đồ thời lượng ngủ" } });
    wrapper.append(chartCanvas); chartCard.append(wrapper); container.append(chartCard);
  },
  afterRecordsRender(records) {
    chart?.destroy();
    if (!window.Chart || !chartCanvas) return;
    const sorted = [...records].slice(0, 14).reverse();
    chart = new window.Chart(chartCanvas, {
      type: "bar",
      data: { labels: sorted.map((record) => formatDateTime(record.startedAt).slice(0, 10)), datasets: [{ label: "Phút", data: sorted.map((record) => durationMinutes(record.startedAt, record.endedAt)) }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
  },
  cleanup() { window.clearInterval(timerInterval); timerInterval = null; timerStart = null; chart?.destroy(); chart = null; }
};
export function render(container) { return renderRecordModule(container, config); }

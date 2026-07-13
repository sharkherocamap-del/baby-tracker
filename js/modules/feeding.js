import { renderRecordModule } from "./module-factory.js";
import { createBabyRecord } from "../firestore-service.js";
import { getState } from "../app-state.js";
import { formatDateTime, formatDuration } from "../date-utils.js";
import { createElement } from "../ui.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { setButtonContent } from "../icons.js";

let timerStart = null;
let timerInterval = null;
let timerValue = null;

const feedingTypes = [
  { value: "breastfeeding", label: "Bú mẹ" }, { value: "breast_milk_bottle", label: "Sữa mẹ bình" },
  { value: "formula", label: "Sữa công thức" }, { value: "solid_food", label: "Ăn dặm" },
  { value: "water", label: "Nước" }, { value: "other", label: "Khác" }
];

function updateTimer() {
  if (!timerStart || !timerValue) return;
  timerValue.textContent = formatDuration((Date.now() - timerStart.getTime()) / 60000);
}

const config = {
  title: "Ăn uống",
  icon: "restaurant",
  singular: "Cữ ăn",
  collection: "feedingRecords",
  dateField: "startedAt",
  orderByField: "startedAt",
  recordTitle: (record) => feedingTypes.find((item) => item.value === record.feedingType)?.label || "Cữ ăn",
  recordSubtitle: (record) => `${formatDateTime(record.startedAt)}${record.endedAt ? ` · ${formatDuration((record.endedAt.toMillis() - record.startedAt.toMillis()) / 60000)}` : ""}`,
  fields: [
    { name: "feedingType", label: "Loại", type: "select", required: true, defaultValue: "formula", options: feedingTypes },
    { name: "startedAt", label: "Bắt đầu", type: "datetime-local", required: true },
    { name: "endedAt", label: "Kết thúc", type: "datetime-local", afterField: "startedAt", afterLabel: "thời điểm bắt đầu", hideWhenEmpty: true },
    { name: "amount", label: "Lượng", type: "number", min: 0, max: 5000, step: 0.1, hideWhenEmpty: true },
    { name: "unit", label: "Đơn vị", type: "select", defaultValue: "ml", options: [
      { value: "ml", label: "ml" }, { value: "g", label: "gram" }, { value: "minute", label: "phút" }, { value: "portion", label: "khẩu phần" }
    ] },
    { name: "breastSide", label: "Bên bú", type: "select", options: [
      { value: "left", label: "Trái" }, { value: "right", label: "Phải" }, { value: "both", label: "Cả hai" }
    ], hideWhenEmpty: true },
    { name: "foodName", label: "Tên món ăn", type: "text", maxLength: 250, hideWhenEmpty: true },
    { name: "ingredients", label: "Thành phần", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "allergyReaction", label: "Có phản ứng dị ứng", type: "checkbox", defaultValue: false },
    { name: "reactionDetails", label: "Chi tiết phản ứng", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  renderTop(container) {
    const banner = createElement("section", { className: "timer-banner" });
    const info = createElement("div");
    info.append(createElement("strong", { text: "Timer bú mẹ" }));
    timerValue = createElement("div", { className: "timer-value", text: "0 phút" });
    info.append(timerValue);
    const actions = createElement("div", { className: "flex gap-1 flex-wrap" });
    const start = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(start, "play_arrow", "Bắt đầu");
    const stop = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
    setButtonContent(stop, "stop_circle", "Kết thúc & lưu");
    stop.disabled = true;
    start.addEventListener("click", () => {
      timerStart = new Date();
      start.disabled = true;
      stop.disabled = false;
      updateTimer();
      timerInterval = window.setInterval(updateTimer, 1000);
    });
    stop.addEventListener("click", async () => {
      if (!timerStart) return;
      stop.disabled = true;
      try {
        const end = new Date();
        await createBabyRecord(getState().selectedBabyId, "feedingRecords", {
          feedingType: "breastfeeding", startedAt: timerStart, endedAt: end, amount: Math.max(1, Math.round((end - timerStart) / 60000)), unit: "minute",
          breastSide: "both", foodName: "", ingredients: "", allergyReaction: false, reactionDetails: "", notes: "Ghi bằng timer"
        });
        showToast("Đã lưu cữ bú mẹ.", "success");
        timerStart = null;
        start.disabled = false;
        timerValue.textContent = "0 phút";
        window.clearInterval(timerInterval);
      } catch (error) {
        console.error(error);
        showToast(friendlyErrorMessage(error, "Không thể lưu timer bú mẹ."), "error");
        stop.disabled = false;
      }
    });
    actions.append(start, stop);
    banner.append(info, actions);
    container.append(banner);
  },
  cleanup() { window.clearInterval(timerInterval); timerInterval = null; timerStart = null; timerValue = null; }
};
export function render(container) { return renderRecordModule(container, config); }

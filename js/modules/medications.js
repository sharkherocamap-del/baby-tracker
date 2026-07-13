import { renderRecordModule } from "./module-factory.js";
import { createBabyRecord, getBabySubcollection, subscribeToCollection } from "../firestore-service.js";
import { getState } from "../app-state.js";
import { formatDate, formatDateTime } from "../date-utils.js";
import { clearElement, createElement, renderEmptyState } from "../ui.js";
import { friendlyErrorMessage, showToast } from "../toast.js";

let unsubscribeLogs = null;
let logsContainer = null;

const config = {
  title: "Thuốc & vitamin",
  singular: "Thuốc hoặc vitamin",
  collection: "medications",
  dateField: "startDate",
  orderByField: "startDate",
  medicalNote: "Ứng dụng không tính hoặc đề xuất liều. Chỉ nhập liều dùng theo hướng dẫn của bác sĩ hoặc chuyên gia y tế.",
  recordTitle: "name",
  recordSubtitle: (record) => `${record.dosage || "Chưa nhập liều"}${record.frequency ? ` · ${record.frequency}` : ""}`,
  statusField: "active",
  statusMap: { true: { label: "Đang dùng", tone: "success" }, false: { label: "Đã ngừng", tone: "default" } },
  fields: [
    { name: "name", label: "Tên thuốc / vitamin", type: "text", required: true, maxLength: 250 },
    { name: "category", label: "Nhóm", type: "select", required: true, defaultValue: "vitamin", options: [
      { value: "vitamin", label: "Vitamin" }, { value: "medicine", label: "Thuốc" }, { value: "supplement", label: "Bổ sung" }, { value: "other", label: "Khác" }
    ] },
    { name: "dosage", label: "Liều theo chỉ định", type: "text", required: true, maxLength: 160 },
    { name: "unit", label: "Đơn vị", type: "text", maxLength: 80, hideWhenEmpty: true },
    { name: "route", label: "Đường dùng", type: "text", maxLength: 120, hideWhenEmpty: true },
    { name: "frequency", label: "Tần suất", type: "text", maxLength: 200, hideWhenEmpty: true },
    { name: "scheduledTimes", label: "Giờ dự kiến (ngăn cách dấu phẩy)", type: "array", maxLength: 500, full: true, hideWhenEmpty: true },
    { name: "startDate", label: "Ngày bắt đầu", type: "datetime-local", required: true },
    { name: "endDate", label: "Ngày kết thúc", type: "datetime-local", afterField: "startDate", afterLabel: "ngày bắt đầu", hideWhenEmpty: true },
    { name: "prescribedBy", label: "Người chỉ định", type: "text", maxLength: 200, hideWhenEmpty: true },
    { name: "reason", label: "Lý do", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true },
    { name: "active", label: "Đang sử dụng", type: "checkbox", defaultValue: true },
    { name: "notes", label: "Ghi chú", type: "textarea", maxLength: 1000, full: true, hideWhenEmpty: true }
  ],
  renderTop(container) {
    const card = createElement("section", { className: "card mb-2" });
    card.append(createElement("h3", { text: "Lịch sử ghi nhận đã dùng" }));
    logsContainer = createElement("div", { className: "activity-list mt-2" });
    card.append(logsContainer);
    container.append(card);
    const { selectedBabyId } = getState();
    unsubscribeLogs?.();
    unsubscribeLogs = subscribeToCollection(getBabySubcollection(selectedBabyId, "medicationLogs"), { orderByField: "takenAt", orderDirection: "desc", limit: 20 }, (logs) => {
      clearElement(logsContainer);
      if (!logs.length) { renderEmptyState(logsContainer, { icon: "💊", title: "Chưa có lịch sử dùng thuốc", message: "Bấm “Ghi đã dùng” ở một thuốc hoặc vitamin." }); return; }
      logs.forEach((log) => {
        const item = createElement("div", { className: "activity-item" });
        item.append(createElement("span", { text: "✓" }), createElement("div", { text: `${formatDateTime(log.takenAt)} · ${log.notes || "Đã dùng"}` }));
        logsContainer.append(item);
      });
    }, (error) => { console.error(error); logsContainer.textContent = "Không thể tải lịch sử dùng thuốc."; });
  },
  customCardActions(record, actions) {
    const taken = createElement("button", { className: "button button-primary", text: "Ghi đã dùng", attrs: { type: "button" } });
    taken.addEventListener("click", async () => {
      taken.disabled = true;
      try {
        const now = new Date();
        await createBabyRecord(getState().selectedBabyId, "medicationLogs", {
          medicationId: record.id, scheduledAt: now, takenAt: now, status: "taken", reaction: "", notes: `${record.name} · ${record.dosage}`
        });
        showToast("Đã ghi nhận dùng thuốc/vitamin.", "success");
      } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể ghi nhận."), "error"); }
      finally { taken.disabled = false; }
    });
    actions.append(taken);
  },
  cleanup() { unsubscribeLogs?.(); unsubscribeLogs = null; logsContainer = null; }
};
export function render(container) { return renderRecordModule(container, config); }

import { getState } from "../app-state.js";
import { Timestamp, getBabySubcollection, getCollection } from "../firestore-service.js";
import { calculateAge, durationMinutes, formatDate, formatDateTime, formatDuration, startOfLocalDay, toDate } from "../date-utils.js";
import { friendlyErrorMessage } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderErrorState, renderLoading, safeImage, statusBadge } from "../ui.js";
import { createIcon } from "../icons.js";

const todayStart = () => startOfLocalDay(new Date());
const isToday = (value) => { const date = toDate(value); return date && date >= todayStart(); };

function statCard(icon, label, value, detail = "") {
  const card = createElement("article", { className: "card stat-card" });
  const iconBox = createElement("div", { className: "stat-icon" });
  iconBox.append(createIcon(icon, { size: 22, filled: true }));
  card.append(iconBox, createElement("div", { className: "stat-value", text: value }), createElement("div", { className: "stat-label", text: detail ? `${label} · ${detail}` : label }));
  return card;
}

function quickAction(icon, label, route) {
  const button = createElement("button", { className: "quick-action", attrs: { type: "button" } });
  button.append(createIcon(icon, { size: 27, className: "quick-action-icon", filled: true }), createElement("strong", { text: label }));
  button.addEventListener("click", () => { window.location.hash = `#/${route}`; });
  return button;
}

async function fetchDashboardData(babyId) {
  const dayStart = todayStart();
  const now = new Date();
  const active = (name, orderByField, orderDirection = "desc", limit = 100, where = []) =>
    getCollection(getBabySubcollection(babyId, name), {
      orderByField, orderDirection, limit, deletedMode: "active", where
    });
  const [
    growth, vaccines, visits, feeding, sleep, diapers, symptoms, activeSymptoms,
    activeMedications, medicationLogs, allergies, reminders
  ] = await Promise.all([
    active("growthRecords", "measuredAt", "desc", 10),
    active("vaccinations", "scheduledDate", "asc", 30, [
      { field: "scheduledDate", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ]),
    active("medicalVisits", "followUpDate", "asc", 30, [
      { field: "followUpDate", operator: ">=", value: Timestamp.fromDate(now) }
    ]),
    active("feedingRecords", "startedAt", "desc", 500, [
      { field: "startedAt", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ]),
    active("sleepRecords", "startedAt", "desc", 200, [
      { field: "startedAt", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ]),
    active("diaperRecords", "changedAt", "desc", 500, [
      { field: "changedAt", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ]),
    active("symptomRecords", "recordedAt", "desc", 20),
    active("symptomRecords", "recordedAt", "desc", 100, [
      { field: "active", operator: "==", value: true }
    ]),
    active("medications", "startDate", "desc", 100, [
      { field: "active", operator: "==", value: true }
    ]),
    active("medicationLogs", "takenAt", "desc", 500, [
      { field: "takenAt", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ]),
    active("allergies", "discoveredAt", "desc", 100),
    active("reminders", "scheduledAt", "asc", 100, [
      { field: "scheduledAt", operator: ">=", value: Timestamp.fromDate(dayStart) }
    ])
  ]);
  return {
    growth, vaccines, visits, feeding, sleep, diapers, symptoms, activeSymptoms,
    medications: activeMedications, medicationLogs, allergies, reminders
  };
}

export async function render(container) {
  clearElement(container);
  const { selectedBabyId, selectedBaby } = getState();
  if (!selectedBabyId) {
    renderEmptyState(container, { icon: "child_care", title: "Bắt đầu với hồ sơ em bé", message: "Tạo hồ sơ để Dashboard có thể tổng hợp dữ liệu.", actionLabel: "Tạo hồ sơ", onAction: () => { window.location.hash = "#/babies"; } });
    return () => {};
  }
  renderLoading(container);
  try {
    const data = await fetchDashboardData(selectedBabyId);
    clearElement(container);
    const profile = createElement("section", { className: "card mb-2" });
    const profileRow = createElement("div", { className: "flex items-center gap-1" });
    const avatar = createElement("img", { attrs: { alt: `Ảnh ${selectedBaby.name}`, width: "84", height: "84" } });
    avatar.style.borderRadius = "22px"; avatar.style.objectFit = "cover"; safeImage(avatar, selectedBaby.avatarUrl);
    const text = createElement("div"); text.append(createElement("p", { className: "eyebrow", text: "ĐANG THEO DÕI" }), createElement("h2", { text: selectedBaby.nickname || selectedBaby.name }), createElement("p", { className: "muted", text: `${selectedBaby.name} · ${calculateAge(selectedBaby.birthDate)}` }));
    if (selectedBaby.allergiesSummary) text.append(statusBadge(`Dị ứng: ${selectedBaby.allergiesSummary}`, "warning"));
    profileRow.append(avatar, text); profile.append(profileRow); container.append(profile);

    const latestWeight = data.growth.find((item) => Number.isFinite(item.weightKg));
    const latestHeight = data.growth.find((item) => Number.isFinite(item.heightCm));
    const latestHead = data.growth.find((item) => Number.isFinite(item.headCircumferenceCm));
    const latestTemp = data.symptoms.find((item) => Number.isFinite(item.temperatureCelsius));
    const now = new Date();
    const nextVaccine = data.vaccines.find((item) => toDate(item.scheduledDate) >= now && !["completed", "cancelled"].includes(item.status));
    const nextVisit = data.visits[0];
    const todayFeeding = data.feeding.filter((item) => isToday(item.startedAt));
    const milkMl = todayFeeding.filter((item) => ["formula","breast_milk_bottle"].includes(item.feedingType) && item.unit === "ml").reduce((sum,item) => sum + (Number(item.amount) || 0), 0);
    const todaySleep = data.sleep.filter((item) => isToday(item.startedAt));
    const sleepMinutes = todaySleep.reduce((sum,item) => sum + durationMinutes(item.startedAt, item.endedAt), 0);
    const todayDiapers = data.diapers.filter((item) => isToday(item.changedAt));
    const wetCount = todayDiapers.filter((item) => ["wet","both"].includes(item.diaperType)).length;
    const dirtyCount = todayDiapers.filter((item) => ["dirty","both"].includes(item.diaperType)).length;
    const activeSymptoms = data.activeSymptoms;
    const activeMedications = data.medications;
    const pendingReminders = data.reminders.filter((item) => !item.completed && toDate(item.scheduledAt) >= todayStart());

    const stats = createElement("section", { className: "grid dashboard-grid mb-2" });
    stats.append(
      statCard("monitor_weight", "Cân nặng gần nhất", latestWeight?.weightKg ? `${latestWeight.weightKg} kg` : "—", latestWeight ? formatDate(latestWeight.measuredAt) : "chưa có"),
      statCard("height", "Chiều cao gần nhất", latestHeight?.heightCm ? `${latestHeight.heightCm} cm` : "—", latestHeight ? formatDate(latestHeight.measuredAt) : "chưa có"),
      statCard("radio_button_unchecked", "Vòng đầu gần nhất", latestHead?.headCircumferenceCm ? `${latestHead.headCircumferenceCm} cm` : "—", latestHead ? formatDate(latestHead.measuredAt) : "chưa có"),
      statCard("thermometer", "Nhiệt độ gần nhất", latestTemp ? `${latestTemp.temperatureCelsius}°C` : "—", latestTemp ? formatDateTime(latestTemp.recordedAt) : "chưa có"),
      statCard("local_drink", "Sữa hôm nay", `${milkMl} ml`, `${todayFeeding.length} cữ ăn`),
      statCard("bedtime", "Ngủ hôm nay", formatDuration(sleepMinutes), `${todaySleep.length} giấc`),
      statCard("baby_changing_station", "Thay tã hôm nay", String(todayDiapers.length), `${wetCount} ướt · ${dirtyCount} đi ngoài`),
      statCard("sick", "Triệu chứng hoạt động", String(activeSymptoms.length), activeSymptoms[0]?.symptoms?.join(", ") || "không có"),
      statCard("medication", "Thuốc/vitamin đang dùng", String(activeMedications.length), `${data.medicationLogs.filter((item) => isToday(item.takenAt)).length} lần đã ghi hôm nay`),
      statCard("notifications", "Việc chưa hoàn thành", String(pendingReminders.length), pendingReminders[0] ? formatDateTime(pendingReminders[0].scheduledAt) : "không có")
    );
    container.append(stats);

    const columns = createElement("section", { className: "grid two-column-grid mb-2" });
    const upcoming = createElement("div", { className: "card" }); upcoming.append(createElement("h3", { text: "Sắp tới" }));
    const upcomingList = createElement("div", { className: "activity-list mt-1" });
    [["vaccines", nextVaccine ? `${nextVaccine.vaccineName} · ${formatDateTime(nextVaccine.scheduledDate)}` : "Chưa có lịch tiêm sắp tới"], ["stethoscope", nextVisit ? `Tái khám · ${formatDateTime(nextVisit.followUpDate)}` : "Chưa có lịch tái khám"], ["notifications", pendingReminders[0] ? `${pendingReminders[0].title} · ${formatDateTime(pendingReminders[0].scheduledAt)}` : "Chưa có nhắc việc"]].forEach(([icon,label]) => { const item=createElement("div",{className:"activity-item"}); item.append((() => { const box=createElement("span",{className:"activity-icon"}); box.append(createIcon(icon,{size:20,filled:true})); return box; })(),createElement("div",{text:label})); upcomingList.append(item); });
    upcoming.append(upcomingList);

    const allergies = createElement("div", { className: "card" }); allergies.append(createElement("h3", { text: "Dị ứng quan trọng" }));
    const allergyList = createElement("div", { className: "activity-list mt-1" });
    if (!data.allergies.length) allergyList.append(createElement("p", { className: "muted", text: selectedBaby.allergiesSummary || "Chưa ghi nhận dị ứng." }));
    data.allergies.slice(0,5).forEach((item) => { const row=createElement("div",{className:"activity-item"}); row.append((() => { const box=createElement("span",{className:"activity-icon"}); box.append(createIcon("allergies",{size:20,filled:true})); return box; })(),createElement("div",{text:`${item.allergen} · ${item.severity}` })); allergyList.append(row); });
    allergies.append(allergyList); columns.append(upcoming, allergies); container.append(columns);

    const quick = createElement("section", { className: "card mb-2" }); quick.append(createElement("h3", { text: "Thao tác nhanh" }));
    const quickGrid = createElement("div", { className: "quick-actions mt-1" });
    [["restaurant","Thêm cữ bú","feeding"],["bedtime","Bắt đầu giấc ngủ","sleep"],["baby_changing_station","Thêm lần thay tã","diapers"],["thermometer","Ghi nhiệt độ","symptoms"],["monitor_weight","Thêm cân nặng","growth"],["medication","Ghi nhận thuốc","medications"],["stethoscope","Thêm lịch khám","medical-visits"],["vaccines","Thêm lịch tiêm","vaccinations"]].forEach((args) => quickGrid.append(quickAction(...args)));
    quick.append(quickGrid); container.append(quick);

    const recent = createElement("section", { className: "card" }); recent.append(createElement("h3", { text: "Hoạt động gần đây" }));
    const activities = [
      ...data.feeding.slice(0,3).map((item) => ({ icon:"restaurant", date:item.startedAt, text:`Cữ ăn ${item.amount ?? ""} ${item.unit || ""}` })),
      ...data.sleep.slice(0,3).map((item) => ({ icon:"bedtime", date:item.startedAt, text:`Giấc ngủ ${formatDuration(durationMinutes(item.startedAt,item.endedAt))}` })),
      ...data.diapers.slice(0,3).map((item) => ({ icon:"baby_changing_station", date:item.changedAt, text:`Thay tã: ${item.diaperType}` })),
      ...data.growth.slice(0,2).map((item) => ({ icon:"monitor_weight", date:item.measuredAt, text:`Tăng trưởng: ${item.weightKg ?? "—"} kg` }))
    ].sort((a,b) => toDate(b.date)-toDate(a.date)).slice(0,8);
    const activityList = createElement("div", { className: "activity-list mt-1" });
    if (!activities.length) activityList.append(createElement("p", { className: "muted", text: "Chưa có hoạt động." }));
    activities.forEach((item) => { const row=createElement("div",{className:"activity-item"}); const detail=createElement("div"); detail.append(createElement("strong",{text:item.text}),createElement("div",{className:"muted small",text:formatDateTime(item.date)})); { const box=createElement("span",{className:"activity-icon"}); box.append(createIcon(item.icon,{size:20,filled:true})); row.append(box,detail); }; activityList.append(row); });
    recent.append(activityList); container.append(recent);
  } catch (error) {
    console.error(error);
    renderErrorState(container, friendlyErrorMessage(error, "Không thể tải Dashboard."), () => render(container));
  }
  return () => {};
}

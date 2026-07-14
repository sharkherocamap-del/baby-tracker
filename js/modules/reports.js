import { getState } from "../app-state.js";
import { getBabySubcollection, getAllPagesResult } from "../firestore-service.js";
import { exportCsv, exportJson } from "../export-utils.js";
import { formatDate, formatDateTime } from "../date-utils.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderLoading } from "../ui.js";
import { createIcon, setButtonContent } from "../icons.js";
import { closeModal, openModal } from "../modal.js";
import {
  BACKUP_SCHEMA_VERSION,
  MAX_BACKUP_BYTES,
  importBackupAsNewBaby,
  sanitizeBackupRecord,
  validateBackupPayload
} from "../backup-service.js";

const modules = [
  ["growthRecords","Tăng trưởng","measuredAt"],["vaccinations","Tiêm phòng","scheduledDate"],["medicalVisits","Khám bệnh","visitDate"],
  ["feedingRecords","Ăn uống","startedAt"],["sleepRecords","Giấc ngủ","startedAt"],["diaperRecords","Thay tã","changedAt"],
  ["symptomRecords","Triệu chứng","recordedAt"],["medications","Thuốc & vitamin","startDate"],["medicationLogs","Lịch sử dùng thuốc","takenAt"],
  ["allergies","Dị ứng","discoveredAt"],["milestones","Mốc phát triển","achievedDate"],["teethingRecords","Mọc răng","eruptedDate"],["reminders","Nhắc việc","scheduledAt"]
];

async function loadAll(babyId) {
  const entries = await Promise.all(modules.map(async ([name, label, dateField]) => {
    const result = await getAllPagesResult(getBabySubcollection(babyId, name), {
      deletedMode: "active",
      orderByField: dateField,
      orderDirection: "desc",
      pageSize: 100,
      maxRecords: 10000
    });
    if (result.truncated) throw new Error(`${label} có hơn 10.000 bản ghi; không xuất backup thiếu dữ liệu. Hãy xuất theo khoảng thời gian hoặc chia dữ liệu.`);
    return [name, result.items];
  }));
  return Object.fromEntries(entries);
}

const columnLabels = {
  measuredAt:"Thời điểm đo",weightKg:"Cân nặng (kg)",heightCm:"Chiều cao (cm)",headCircumferenceCm:"Vòng đầu (cm)",notes:"Ghi chú",
  vaccineName:"Tên vaccine",diseasePrevention:"Phòng bệnh",doseNumber:"Mũi số",scheduledDate:"Ngày dự kiến",administeredDate:"Ngày thực tế",status:"Trạng thái",clinic:"Cơ sở",provider:"Người thực hiện",batchNumber:"Số lô",reactions:"Phản ứng",documentUrl:"URL tài liệu",
  visitDate:"Ngày khám",reason:"Lý do",symptoms:"Triệu chứng",temperatureCelsius:"Nhiệt độ (°C)",doctorName:"Bác sĩ",facility:"Cơ sở y tế",diagnosisByDoctor:"Chẩn đoán bác sĩ",treatmentPlan:"Kế hoạch điều trị",followUpDate:"Ngày tái khám",prescriptionUrl:"URL đơn thuốc",testResultUrl:"URL xét nghiệm",
  feedingType:"Loại ăn",startedAt:"Bắt đầu",endedAt:"Kết thúc",amount:"Lượng",unit:"Đơn vị",breastSide:"Bên bú",foodName:"Tên món",ingredients:"Thành phần",allergyReaction:"Phản ứng dị ứng",reactionDetails:"Chi tiết phản ứng",
  sleepType:"Loại giấc",wakeCount:"Số lần thức",quality:"Chất lượng",location:"Địa điểm",changedAt:"Thời điểm thay",diaperType:"Loại tã",stoolColor:"Màu phân",stoolConsistency:"Độ đặc",abnormal:"Bất thường",abnormalDetails:"Chi tiết bất thường",
  recordedAt:"Thời điểm ghi",otherSymptom:"Triệu chứng khác",severity:"Mức độ",active:"Đang hoạt động",name:"Tên",category:"Nhóm",dosage:"Liều",route:"Đường dùng",frequency:"Tần suất",scheduledTimes:"Giờ dự kiến",startDate:"Ngày bắt đầu",endDate:"Ngày kết thúc",prescribedBy:"Người chỉ định",
  medicationId:"ID thuốc",takenAt:"Thời điểm dùng",reaction:"Phản ứng",allergen:"Tác nhân",allergyType:"Loại dị ứng",discoveredAt:"Ngày phát hiện",treatment:"Xử trí",confirmedByDoctor:"Bác sĩ xác nhận",milestoneName:"Tên mốc",achievedDate:"Ngày đạt",mediaUrl:"URL media",toothPosition:"Vị trí răng",symptomStartDate:"Bắt đầu biểu hiện",eruptedDate:"Ngày nhú",title:"Tiêu đề",reminderType:"Loại nhắc",completed:"Hoàn thành",linkedCollection:"Collection liên kết",linkedRecordId:"ID liên kết",createdByUid:"UID người tạo",createdByEmail:"Email người tạo",createdAt:"Ngày tạo",updatedAt:"Ngày cập nhật",isDeleted:"Đã xóa mềm",deletedAt:"Ngày xóa"
};

function genericColumns(records) {
  const keys = [...new Set(records.flatMap((record) => Object.keys(record).filter((key) => !key.startsWith("__") && key !== "id")))];
  return [{key:"id",label:"ID"}, ...keys.map((key) => ({key,label:columnLabels[key] || key}))];
}

function summarySection(title, lines) {
  const section = createElement("section", { className: "card mb-2" }); section.append(createElement("h3", { text:title }));
  const list = createElement("div", { className:"activity-list mt-1" });
  if (!lines.length) list.append(createElement("p",{className:"muted",text:"Chưa có dữ liệu."}));
  lines.forEach((line) => { const row=createElement("div",{className:"activity-item"}); const iconBox=createElement("span",{className:"activity-icon"}); iconBox.append(createIcon("chevron_right",{size:20})); row.append(iconBox,createElement("div",{text:line})); list.append(row); });
  section.append(list); return section;
}

function backupPayload(state, data) {
  const baby = sanitizeBackupRecord(state.selectedBaby);
  const collections = Object.fromEntries(Object.entries(data).map(([name, records]) => [name, records.map(sanitizeBackupRecord)]));
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    app: "Baby Tracker",
    exportedAt: new Date(),
    workspace: { id: state.currentWorkspaceId, name: state.currentWorkspace?.name || "" },
    baby,
    collections
  };
}

function openImportPreview(validation, fileName, onImported) {
  const content = createElement("div");
  content.append(
    createElement("p", { text: `File: ${fileName}` }),
    createElement("p", { text: `Hồ sơ: ${validation.normalized.baby.name}` }),
    createElement("p", { text: `Tổng bản ghi: ${validation.normalized.totalRecords}` }),
    createElement("p", { className: "medical-note", text: "Dữ liệu sẽ được nhập thành một hồ sơ mới, không ghi đè hồ sơ hiện tại. URL Firebase Storage trong backup bị loại bỏ vì file ảnh không nằm trong JSON." })
  );
  if (validation.warnings?.length) {
    const warningBox = createElement("div", { className: "import-warning-list mt-1" });
    warningBox.append(createElement("strong", { text: `${validation.warnings.length} cảnh báo không chặn import:` }));
    validation.warnings.slice(0, 8).forEach((warning) => warningBox.append(createElement("p", { className: "muted small", text: `• ${warning}` })));
    content.append(warningBox);
  }
  const actions = createElement("div", { className: "form-actions mt-2" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } }); setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "button" } }); setButtonContent(submit, "upload", "Nhập backup");
  cancel.addEventListener("click", closeModal);
  submit.addEventListener("click", async () => {
    submit.disabled = true; cancel.disabled = true;
    try {
      const result = await importBackupAsNewBaby(validation.normalized);
      showToast(`Đã nhập hồ sơ mới với ${result.operationCount - 1} bản ghi.`, "success", 7000);
      closeModal(); onImported?.();
    } catch (error) { console.error(error); showToast(friendlyErrorMessage(error, "Không thể nhập backup."), "error", 8000); }
    finally { submit.disabled = false; cancel.disabled = false; }
  });
  actions.append(cancel, submit); content.append(actions);
  openModal({ title: "Xác nhận nhập JSON backup", content });
}

export async function render(container) {
  clearElement(container);
  const state = getState();
  const { selectedBabyId, selectedBaby } = state;
  if (!selectedBabyId) { renderEmptyState(container,{icon:"lab_profile",title:"Chưa chọn em bé",message:"Hãy tạo hoặc chọn hồ sơ em bé trước khi xuất báo cáo."}); return () => {}; }
  const header=createElement("div",{className:"view-header"}); const intro=createElement("div"); intro.append(createElement("h2",{text:"Báo cáo & xuất dữ liệu"}),createElement("p",{className:"muted",text:"Backup JSON có version schema, CSV theo module và báo cáo in."})); header.append(intro); container.append(header);
  const loading=createElement("div"); container.append(loading); renderLoading(loading);
  try {
    const data=await loadAll(selectedBabyId); loading.remove();
    const actions=createElement("section",{className:"card mb-2"}); actions.append(createElement("h3",{text:"Xuất và khôi phục dữ liệu"}));
    const buttons=createElement("div",{className:"flex flex-wrap gap-1 mt-1"});
    const jsonButton=createElement("button",{className:"button button-primary",attrs:{type:"button"}}); setButtonContent(jsonButton,"download","Tải backup JSON v2");
    jsonButton.addEventListener("click",()=>exportJson(backupPayload(state, data),"baby-tracker-backup-v2"));
    const printButton=createElement("button",{className:"button button-secondary",attrs:{type:"button"}}); setButtonContent(printButton,"print","In tóm tắt đi khám");
    printButton.addEventListener("click",()=>{ document.body.classList.add("print-medical-summary"); const cleanup=()=>document.body.classList.remove("print-medical-summary"); window.addEventListener("afterprint",cleanup,{once:true}); window.print(); window.setTimeout(cleanup,1000); });
    buttons.append(jsonButton,printButton);

    if (state.currentRole === "admin") {
      const importInput = createElement("input", { className: "hidden", attrs: { type: "file", accept: "application/json,.json" } });
      const importButton = createElement("button", { className: "button button-secondary", attrs: { type: "button" } }); setButtonContent(importButton, "upload_file", "Nhập JSON backup");
      importButton.addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", async () => {
        const file = importInput.files?.[0]; importInput.value = "";
        if (!file) return;
        if (file.size > MAX_BACKUP_BYTES) { showToast("File backup không được lớn hơn 10 MB.", "warning"); return; }
        try {
          const payload = JSON.parse(await file.text());
          const validation = validateBackupPayload(payload);
          if (!validation.valid) {
            const details = validation.errors.slice(0, 8).join("\n");
            console.error("Backup validation errors", validation.errors);
            showToast(`Backup không hợp lệ: ${details}`, "error", 10000);
            return;
          }
          openImportPreview(validation, file.name, () => { window.location.hash = "#/babies"; });
        } catch (error) { console.error(error); showToast("Không đọc được JSON. Kiểm tra file có đúng định dạng.", "error"); }
      });
      buttons.append(importButton, importInput);
    }
    actions.append(buttons);
    actions.append(createElement("p", { className: "muted small mt-1", text: "Chỉ admin workspace thấy chức năng nhập. Mọi field được whitelist, kiểm tra kiểu, enum, khoảng giá trị, quan hệ ngày giờ và liên kết trước khi ghi Firestore. Backup chỉ gồm dữ liệu đang hoạt động; ảnh Storage không nằm trong JSON." }));
    const csvGrid=createElement("div",{className:"quick-actions mt-2"});
    modules.forEach(([name,label])=>{ const records=data[name]; const button=createElement("button",{className:"quick-action",attrs:{type:"button"}}); button.append(createIcon("table_view",{size:27,className:"quick-action-icon",filled:true}),createElement("strong",{text:`${label} (${records.length})`})); button.disabled=!records.length; button.addEventListener("click",()=>exportCsv(records,genericColumns(records),`baby-tracker-${name}`)); csvGrid.append(button); });
    actions.append(csvGrid); container.append(actions);

    const report=createElement("section",{attrs:{id:"medical-summary"}});
    report.append(createElement("h2",{text:`Tóm tắt sức khỏe: ${selectedBaby.name}`}),createElement("p",{className:"muted mb-2",text:`Workspace: ${state.currentWorkspace?.name || "—"} · Ngày sinh: ${selectedBaby.birthDate || "—"} · Nhóm máu: ${selectedBaby.bloodType || "—"} · Xuất lúc: ${formatDateTime(new Date())}`}));
    report.append(summarySection("Dị ứng",data.allergies.slice(0,10).map((item)=>`${item.allergen} · ${item.severity} · ${item.symptoms || "không ghi biểu hiện"}`)));
    report.append(summarySection("Thuốc đang sử dụng",data.medications.filter((item)=>item.active).map((item)=>`${item.name} · ${item.dosage} · ${item.frequency || "không ghi tần suất"}`)));
    report.append(summarySection("Vaccine gần nhất",data.vaccinations.slice(0,5).map((item)=>`${item.vaccineName} · ${item.status} · ${formatDate(item.administeredDate || item.scheduledDate)}`)));
    report.append(summarySection("Tăng trưởng gần nhất",data.growthRecords.slice(0,3).map((item)=>`${formatDate(item.measuredAt)} · ${item.weightKg ?? "—"} kg · ${item.heightCm ?? "—"} cm · vòng đầu ${item.headCircumferenceCm ?? "—"} cm`)));
    report.append(summarySection("Triệu chứng gần đây",data.symptomRecords.slice(0,10).map((item)=>`${formatDateTime(item.recordedAt)} · ${(item.symptoms||[]).join(", ") || item.otherSymptom || "không ghi"} · ${item.temperatureCelsius ?? "—"}°C`)));
    report.append(summarySection("Các lần khám gần nhất",data.medicalVisits.slice(0,5).map((item)=>`${formatDate(item.visitDate)} · ${item.reason} · ${item.diagnosisByDoctor || "không ghi chẩn đoán"} · ${item.facility || ""}`)));
    report.append(createElement("p",{className:"medical-note",text:"Bản tóm tắt này chỉ phản ánh dữ liệu người dùng nhập và không thay thế hồ sơ y tế chính thức hoặc tư vấn bác sĩ."}));
    container.append(report);
    container.append(createElement("p",{className:"muted small mt-2",text:"Backup dùng startAfter để tải từng trang và từ chối xuất thiếu dữ liệu khi một module vượt 10.000 bản ghi."}));
  } catch(error){ console.error(error); loading.textContent=friendlyErrorMessage(error,"Không thể tạo báo cáo."); showToast(loading.textContent,"error"); }
  return () => {};
}

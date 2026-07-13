import { getState } from "../app-state.js";
import { getBabySubcollection, getCollection } from "../firestore-service.js";
import { exportCsv, exportJson } from "../export-utils.js";
import { formatDate, formatDateTime } from "../date-utils.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderLoading } from "../ui.js";

const modules = [
  ["growthRecords","Tăng trưởng","measuredAt"],["vaccinations","Tiêm phòng","scheduledDate"],["medicalVisits","Khám bệnh","visitDate"],
  ["feedingRecords","Ăn uống","startedAt"],["sleepRecords","Giấc ngủ","startedAt"],["diaperRecords","Thay tã","changedAt"],
  ["symptomRecords","Triệu chứng","recordedAt"],["medications","Thuốc & vitamin","startDate"],["medicationLogs","Lịch sử dùng thuốc","takenAt"],
  ["allergies","Dị ứng","discoveredAt"],["milestones","Mốc phát triển","achievedDate"],["teethingRecords","Mọc răng","eruptedDate"],["reminders","Nhắc việc","scheduledAt"]
];

async function loadAll(babyId) {
  const entries = await Promise.all(modules.map(async ([name,_label,dateField]) => [name, await getCollection(getBabySubcollection(babyId,name), { orderByField:dateField, orderDirection:"desc", limit:1000 })]));
  return Object.fromEntries(entries);
}

const columnLabels = {
  measuredAt:"Thời điểm đo",weightKg:"Cân nặng (kg)",heightCm:"Chiều cao (cm)",headCircumferenceCm:"Vòng đầu (cm)",notes:"Ghi chú",
  vaccineName:"Tên vaccine",diseasePrevention:"Phòng bệnh",doseNumber:"Mũi số",scheduledDate:"Ngày dự kiến",administeredDate:"Ngày thực tế",status:"Trạng thái",clinic:"Cơ sở",provider:"Người thực hiện",batchNumber:"Số lô",reactions:"Phản ứng",documentUrl:"URL tài liệu",
  visitDate:"Ngày khám",reason:"Lý do",symptoms:"Triệu chứng",temperatureCelsius:"Nhiệt độ (°C)",doctorName:"Bác sĩ",facility:"Cơ sở y tế",diagnosisByDoctor:"Chẩn đoán bác sĩ",treatmentPlan:"Kế hoạch điều trị",followUpDate:"Ngày tái khám",prescriptionUrl:"URL đơn thuốc",testResultUrl:"URL xét nghiệm",
  feedingType:"Loại ăn",startedAt:"Bắt đầu",endedAt:"Kết thúc",amount:"Lượng",unit:"Đơn vị",breastSide:"Bên bú",foodName:"Tên món",ingredients:"Thành phần",allergyReaction:"Phản ứng dị ứng",reactionDetails:"Chi tiết phản ứng",
  sleepType:"Loại giấc",wakeCount:"Số lần thức",quality:"Chất lượng",location:"Địa điểm",changedAt:"Thời điểm thay",diaperType:"Loại tã",stoolColor:"Màu phân",stoolConsistency:"Độ đặc",abnormal:"Bất thường",abnormalDetails:"Chi tiết bất thường",
  recordedAt:"Thời điểm ghi",otherSymptom:"Triệu chứng khác",severity:"Mức độ",active:"Đang hoạt động",name:"Tên",category:"Nhóm",dosage:"Liều",route:"Đường dùng",frequency:"Tần suất",scheduledTimes:"Giờ dự kiến",startDate:"Ngày bắt đầu",endDate:"Ngày kết thúc",prescribedBy:"Người chỉ định",
  medicationId:"ID thuốc",takenAt:"Thời điểm dùng",reaction:"Phản ứng",allergen:"Tác nhân",allergyType:"Loại dị ứng",discoveredAt:"Ngày phát hiện",treatment:"Xử trí",confirmedByDoctor:"Bác sĩ xác nhận",milestoneName:"Tên mốc",achievedDate:"Ngày đạt",mediaUrl:"URL media",toothPosition:"Vị trí răng",symptomStartDate:"Bắt đầu biểu hiện",eruptedDate:"Ngày nhú",title:"Tiêu đề",reminderType:"Loại nhắc",completed:"Hoàn thành",linkedCollection:"Collection liên kết",linkedRecordId:"ID liên kết",createdByUid:"UID người tạo",createdByEmail:"Email người tạo",createdAt:"Ngày tạo",updatedAt:"Ngày cập nhật"
};

function genericColumns(records) {
  const keys = [...new Set(records.flatMap((record) => Object.keys(record).filter((key) => !key.startsWith("__") && key !== "id")))];
  return [{key:"id",label:"ID"}, ...keys.map((key) => ({key,label:columnLabels[key] || key}))];
}

function summarySection(title, lines) {
  const section = createElement("section", { className: "card mb-2" }); section.append(createElement("h3", { text:title }));
  const list = createElement("div", { className:"activity-list mt-1" });
  if (!lines.length) list.append(createElement("p",{className:"muted",text:"Chưa có dữ liệu."}));
  lines.forEach((line) => { const row=createElement("div",{className:"activity-item"}); row.append(createElement("span",{text:"•"}),createElement("div",{text:line})); list.append(row); });
  section.append(list); return section;
}

export async function render(container) {
  clearElement(container);
  const { selectedBabyId, selectedBaby } = getState();
  if (!selectedBabyId) { renderEmptyState(container,{icon:"▤",title:"Chưa chọn em bé",message:"Hãy tạo hoặc chọn hồ sơ em bé trước khi xuất báo cáo."}); return () => {}; }
  const header=createElement("div",{className:"view-header"}); const intro=createElement("div"); intro.append(createElement("h2",{text:"Báo cáo & xuất dữ liệu"}),createElement("p",{className:"muted",text:"Tải JSON backup, CSV theo module hoặc in bản tóm tắt đi khám."})); header.append(intro); container.append(header);
  const loading=createElement("div"); container.append(loading); renderLoading(loading);
  try {
    const data=await loadAll(selectedBabyId); loading.remove();
    const actions=createElement("section",{className:"card mb-2"}); actions.append(createElement("h3",{text:"Xuất dữ liệu"}));
    const buttons=createElement("div",{className:"flex flex-wrap gap-1 mt-1"});
    const jsonButton=createElement("button",{className:"button button-primary",text:"Tải backup JSON",attrs:{type:"button"}});
    jsonButton.addEventListener("click",()=>exportJson({exportedAt:new Date(),baby:selectedBaby,data},"baby-tracker-backup"));
    const printButton=createElement("button",{className:"button button-secondary",text:"In tóm tắt đi khám",attrs:{type:"button"}});
    printButton.addEventListener("click",()=>{
      document.body.classList.add("print-medical-summary");
      const cleanup=()=>document.body.classList.remove("print-medical-summary");
      window.addEventListener("afterprint",cleanup,{once:true});
      window.print();
      window.setTimeout(cleanup,1000);
    });
    buttons.append(jsonButton,printButton); actions.append(buttons);
    const csvGrid=createElement("div",{className:"quick-actions mt-2"});
    modules.forEach(([name,label])=>{ const records=data[name]; const button=createElement("button",{className:"quick-action",attrs:{type:"button"}}); button.append(createElement("span",{text:"CSV"}),createElement("strong",{text:`${label} (${records.length})`})); button.disabled=!records.length; button.addEventListener("click",()=>exportCsv(records,genericColumns(records),`baby-tracker-${name}`)); csvGrid.append(button); });
    actions.append(csvGrid); container.append(actions);

    const report=createElement("section",{attrs:{id:"medical-summary"}});
    report.append(createElement("h2",{text:`Tóm tắt sức khỏe: ${selectedBaby.name}`}),createElement("p",{className:"muted mb-2",text:`Ngày sinh: ${selectedBaby.birthDate || "—"} · Nhóm máu: ${selectedBaby.bloodType || "—"} · Xuất lúc: ${formatDateTime(new Date())}`}));
    report.append(summarySection("Dị ứng",data.allergies.slice(0,10).map((item)=>`${item.allergen} · ${item.severity} · ${item.symptoms || "không ghi biểu hiện"}`)));
    report.append(summarySection("Thuốc đang sử dụng",data.medications.filter((item)=>item.active).map((item)=>`${item.name} · ${item.dosage} · ${item.frequency || "không ghi tần suất"}`)));
    report.append(summarySection("Vaccine gần nhất",data.vaccinations.slice(0,5).map((item)=>`${item.vaccineName} · ${item.status} · ${formatDate(item.administeredDate || item.scheduledDate)}`)));
    report.append(summarySection("Tăng trưởng gần nhất",data.growthRecords.slice(0,3).map((item)=>`${formatDate(item.measuredAt)} · ${item.weightKg ?? "—"} kg · ${item.heightCm ?? "—"} cm · vòng đầu ${item.headCircumferenceCm ?? "—"} cm`)));
    report.append(summarySection("Triệu chứng gần đây",data.symptomRecords.slice(0,10).map((item)=>`${formatDateTime(item.recordedAt)} · ${(item.symptoms||[]).join(", ") || item.otherSymptom || "không ghi"} · ${item.temperatureCelsius ?? "—"}°C`)));
    report.append(summarySection("Các lần khám gần nhất",data.medicalVisits.slice(0,5).map((item)=>`${formatDate(item.visitDate)} · ${item.reason} · ${item.diagnosisByDoctor || "không ghi chẩn đoán"} · ${item.facility || ""}`)));
    report.append(createElement("p",{className:"medical-note",text:"Bản tóm tắt này chỉ phản ánh dữ liệu người dùng nhập và không thay thế hồ sơ y tế chính thức hoặc tư vấn bác sĩ."}));
    container.append(report);
    container.append(createElement("p",{className:"muted small mt-2",text:"Mỗi nhóm dữ liệu được giới hạn tối đa 1.000 bản ghi trong một lần backup để tránh tải không giới hạn. Với dữ liệu lớn hơn, cần bổ sung phân trang backup."}));
  } catch(error){ console.error(error); loading.textContent=friendlyErrorMessage(error,"Không thể tạo báo cáo."); showToast(loading.textContent,"error"); }
  return () => {};
}

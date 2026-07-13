import { getState, setSelectedBaby } from "./app-state.js";
import { newDocumentId, runWriteBatch } from "./firestore-service.js";
import { confirmDialog } from "./modal.js";
import { friendlyErrorMessage, showToast } from "./toast.js";

const DEMO_MARKER = "[BABY_TRACKER_DEMO_V1]";
const at = (days, hour = 8, minute = 0) => { const date = new Date(); date.setDate(date.getDate() + days); date.setHours(hour, minute, 0, 0); return date; };

function addRecord(operations, babyId, collection, data) {
  operations.push({ type: "set", path: `babies/${babyId}/${collection}`, data });
}

export async function createDemoData() {
  const state = getState();
  if (state.currentRole !== "admin") { showToast("Chỉ admin được tạo dữ liệu demo.", "warning"); return; }
  const existing = state.babies.find((baby) => String(baby.notes || "").includes(DEMO_MARKER));
  if (existing) { showToast("Dữ liệu demo đã tồn tại. Ứng dụng sẽ không tạo trùng.", "warning"); setSelectedBaby(existing.id); return; }
  const confirmed = await confirmDialog({
    title: "Tạo dữ liệu demo?",
    message: "Sẽ tạo 1 hồ sơ em bé, 5 bản ghi tăng trưởng, 3 vaccine, 2 lần khám, 5 cữ ăn, 3 giấc ngủ, 4 lần thay tã, 2 mốc phát triển, 1 vitamin và 1 nhắc việc.",
    confirmLabel: "Tạo dữ liệu demo"
  });
  if (!confirmed) return;

  const babyId = newDocumentId("babies");
  const operations = [{ type: "set", path: "babies", id: babyId, data: {
    name: "Nguyễn An Nhiên", nickname: "Bông", gender: "female", birthDate: "2025-12-15", birthTime: "08:30",
    birthWeight: 3.2, birthHeight: 50, birthHeadCircumference: 34, gestationalWeeks: 39, bloodType: "O+", hospital: "Bệnh viện Demo",
    avatarUrl: "", allergiesSummary: "Chưa ghi nhận dị ứng", emergencyContact: "Ba/Mẹ: 0900 000 000", notes: `${DEMO_MARKER} Dữ liệu minh họa, có thể xóa sau khi thử.`
  }}];

  [[-120,5.1,57,38],[-90,5.8,60,39.5],[-60,6.5,63,41],[-30,7.1,66,42],[-2,7.6,68,43]].forEach(([days,w,h,head]) => addRecord(operations,babyId,"growthRecords",{ measuredAt:at(days), weightKg:w, heightCm:h, headCircumferenceCm:head, notes:"Dữ liệu demo" }));
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo A", diseasePrevention:"Bệnh A", doseNumber:1, scheduledDate:at(-70), administeredDate:at(-70), status:"completed", clinic:"Trung tâm tiêm chủng Demo", provider:"Điều dưỡng Demo", batchNumber:"DEMO-A1", reactions:"Không ghi nhận", documentUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo B", diseasePrevention:"Bệnh B", doseNumber:1, scheduledDate:at(5), administeredDate:null, status:"upcoming", clinic:"Trung tâm tiêm chủng Demo", provider:"", batchNumber:"", reactions:"", documentUrl:"", notes:"Lịch demo, không phải chỉ định y khoa" });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo C", diseasePrevention:"Bệnh C", doseNumber:2, scheduledDate:at(35), administeredDate:null, status:"scheduled", clinic:"", provider:"", batchNumber:"", reactions:"", documentUrl:"", notes:"Lịch demo" });
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-45,10), reason:"Khám định kỳ", symptoms:"", temperatureCelsius:36.8, weightKg:6.8, doctorName:"BS. Demo", facility:"Phòng khám Demo", diagnosisByDoctor:"Phát triển phù hợp theo đánh giá tại buổi khám", treatmentPlan:"Theo dõi tại nhà", followUpDate:at(45,10), prescriptionUrl:"", testResultUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-12,9), reason:"Sổ mũi", symptoms:"Sổ mũi nhẹ", temperatureCelsius:37.1, weightKg:7.4, doctorName:"BS. Demo", facility:"Phòng khám Demo", diagnosisByDoctor:"Nội dung minh họa do người dùng nhập", treatmentPlan:"Làm theo hướng dẫn bác sĩ", followUpDate:null, prescriptionUrl:"", testResultUrl:"", notes:"Không dùng làm tư vấn y tế" });
  [[-1,7,"formula",120,"ml"],[-1,11,"breastfeeding",18,"minute"],[-1,15,"solid_food",80,"g"],[0,7,"formula",130,"ml"],[0,10,"breastfeeding",16,"minute"]].forEach(([days,h,type,amount,unit]) => addRecord(operations,babyId,"feedingRecords",{ feedingType:type, startedAt:at(days,h), endedAt:at(days,h,20), amount, unit, breastSide:type==="breastfeeding"?"both":null, foodName:type==="solid_food"?"Cháo rau củ":"", ingredients:type==="solid_food"?"Gạo, rau củ":"", allergyReaction:false, reactionDetails:"", notes:"Dữ liệu demo" }));
  [[-1,9,10,"day"],[-1,20,23,"night"],[0,9,10,"day"]].forEach(([days,start,end,type]) => addRecord(operations,babyId,"sleepRecords",{ startedAt:at(days,start), endedAt:at(days,end), sleepType:type, wakeCount:type==="night"?1:0, quality:"good", location:"Nôi", notes:"Dữ liệu demo" }));
  [[-1,8,"wet"],[-1,12,"dirty"],[0,7,"wet"],[0,11,"both"]].forEach(([days,h,type]) => addRecord(operations,babyId,"diaperRecords",{ changedAt:at(days,h), diaperType:type, stoolColor:type!=="wet"?"Vàng":"", stoolConsistency:type!=="wet"?"Mềm":"", abnormal:false, abnormalDetails:"", notes:"Dữ liệu demo" }));
  addRecord(operations,babyId,"milestones",{ milestoneName:"Biết cười", achievedDate:at(-100), category:"social", mediaUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"milestones",{ milestoneName:"Biết lẫy", achievedDate:at(-25), category:"motor", mediaUrl:"", notes:"Dữ liệu demo" });
  const medicationId = newDocumentId(`babies/${babyId}/medications`);
  operations.push({ type:"set", path:`babies/${babyId}/medications`, id:medicationId, data:{ name:"Vitamin D demo", category:"vitamin", dosage:"Theo hướng dẫn bác sĩ", unit:"", route:"Uống", frequency:"Mỗi ngày", scheduledTimes:["08:00"], startDate:at(-30), endDate:null, prescribedBy:"BS. Demo", reason:"Dữ liệu minh họa", active:true, notes:"Không phải khuyến nghị liều" }});
  addRecord(operations,babyId,"reminders",{ title:"Lịch khám demo", reminderType:"medical_visit", scheduledAt:at(7,9), completed:false, linkedCollection:"medicalVisits", linkedRecordId:"", notes:"Chỉ hiển thị khi mở website" });

  try {
    await runWriteBatch(operations);
    setSelectedBaby(babyId);
    showToast("Đã tạo dữ liệu demo thành công.", "success", 6000);
  } catch (error) {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể tạo dữ liệu demo. Có thể một phần dữ liệu chưa được ghi."), "error", 8000);
  }
}

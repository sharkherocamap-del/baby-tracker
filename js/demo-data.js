import { getState, setSelectedBaby } from "./app-state.js";
import { getBabiesPath, getBabySubcollection, newDocumentId, runWriteBatch } from "./firestore-service.js";
import { confirmDialog } from "./modal.js";
import { friendlyErrorMessage, showToast } from "./toast.js";

const BASIC_MARKER = "[BABY_TRACKER_DEMO_V1]";
const COMPLETE_MARKER = "[BABY_TRACKER_DEMO_COMPLETE_V2]";

const at = (days, hour = 8, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const dateOnly = (days) => {
  const date = at(days, 12, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function addRecord(operations, babyId, collection, data, id = null) {
  operations.push({ type: "set", path: getBabySubcollection(babyId, collection), ...(id ? { id } : {}), data });
}

function buildBasicProfile(operations) {
  const babyId = newDocumentId(getBabiesPath());
  operations.push({ type: "set", path: getBabiesPath(), id: babyId, data: {
    name: "Nguyễn An Nhiên", nickname: "Bông", gender: "female", birthDate: dateOnly(-210), birthTime: "08:30",
    birthWeight: 3.2, birthHeight: 50, birthHeadCircumference: 34, gestationalWeeks: 39, bloodType: "O+", hospital: "Bệnh viện Demo",
    avatarUrl: "", allergiesSummary: "Chưa ghi nhận dị ứng", emergencyContact: "Ba/Mẹ: 0900 000 000",
    notes: `${BASIC_MARKER} Hồ sơ minh họa cơ bản, có thể xóa sau khi thử.`
  }});

  [[-120,5.1,57,38],[-90,5.8,60,39.5],[-60,6.5,63,41],[-30,7.1,66,42],[-2,7.6,68,43]].forEach(([days,w,h,head]) => addRecord(operations,babyId,"growthRecords",{ measuredAt:at(days), weightKg:w, heightCm:h, headCircumferenceCm:head, notes:"Dữ liệu demo cơ bản" }));
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo A", diseasePrevention:"Bệnh A", doseNumber:1, scheduledDate:at(-70), administeredDate:at(-70), status:"completed", clinic:"Trung tâm tiêm chủng Demo", provider:"Điều dưỡng Demo", batchNumber:"DEMO-A1", reactions:"Không ghi nhận", documentUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo B", diseasePrevention:"Bệnh B", doseNumber:1, scheduledDate:at(5), administeredDate:null, status:"upcoming", clinic:"Trung tâm tiêm chủng Demo", provider:"", batchNumber:"", reactions:"", documentUrl:"", notes:"Lịch minh họa, không phải chỉ định y khoa" });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine demo C", diseasePrevention:"Bệnh C", doseNumber:2, scheduledDate:at(35), administeredDate:null, status:"scheduled", clinic:"", provider:"", batchNumber:"", reactions:"", documentUrl:"", notes:"Lịch demo" });
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-45,10), reason:"Khám định kỳ", symptoms:"", temperatureCelsius:36.8, weightKg:6.8, doctorName:"BS. Demo", facility:"Phòng khám Demo", diagnosisByDoctor:"Phát triển phù hợp theo đánh giá tại buổi khám", treatmentPlan:"Theo dõi tại nhà", followUpDate:at(45,10), prescriptionUrl:"", testResultUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-12,9), reason:"Sổ mũi", symptoms:"Sổ mũi nhẹ", temperatureCelsius:37.1, weightKg:7.4, doctorName:"BS. Demo", facility:"Phòng khám Demo", diagnosisByDoctor:"Nội dung minh họa do người dùng nhập", treatmentPlan:"Làm theo hướng dẫn bác sĩ", followUpDate:null, prescriptionUrl:"", testResultUrl:"", notes:"Không dùng làm tư vấn y tế" });
  [[-1,7,"formula",120,"ml"],[-1,11,"breastfeeding",18,"minute"],[-1,15,"solid_food",80,"g"],[0,7,"formula",130,"ml"],[0,10,"breastfeeding",16,"minute"]].forEach(([days,h,type,amount,unit]) => addRecord(operations,babyId,"feedingRecords",{ feedingType:type, startedAt:at(days,h), endedAt:at(days,h,20), amount, unit, breastSide:type==="breastfeeding"?"both":null, foodName:type==="solid_food"?"Cháo rau củ":"", ingredients:type==="solid_food"?"Gạo, rau củ":"", allergyReaction:false, reactionDetails:"", notes:"Dữ liệu demo" }));
  [[-1,9,10,"day"],[-1,20,23,"night"],[0,9,10,"day"]].forEach(([days,start,end,type]) => addRecord(operations,babyId,"sleepRecords",{ startedAt:at(days,start), endedAt:at(days,end), sleepType:type, wakeCount:type==="night"?1:0, quality:"good", location:"Nôi", notes:"Dữ liệu demo" }));
  [[-1,8,"wet"],[-1,12,"dirty"],[0,7,"wet"],[0,11,"both"]].forEach(([days,h,type]) => addRecord(operations,babyId,"diaperRecords",{ changedAt:at(days,h), diaperType:type, stoolColor:type!=="wet"?"Vàng":"", stoolConsistency:type!=="wet"?"Mềm":"", abnormal:false, abnormalDetails:"", notes:"Dữ liệu demo" }));
  addRecord(operations,babyId,"milestones",{ milestoneName:"Biết cười", achievedDate:at(-100), category:"social", mediaUrl:"", notes:"Dữ liệu demo" });
  addRecord(operations,babyId,"milestones",{ milestoneName:"Biết lẫy", achievedDate:at(-25), category:"motor", mediaUrl:"", notes:"Dữ liệu demo" });
  const medicationId = newDocumentId(getBabySubcollection(babyId, "medications"));
  addRecord(operations,babyId,"medications",{ name:"Vitamin D demo", category:"vitamin", dosage:"Theo hướng dẫn bác sĩ", unit:"giọt", route:"Uống", frequency:"Mỗi ngày", scheduledTimes:["08:00"], startDate:at(-30), endDate:null, prescribedBy:"BS. Demo", reason:"Dữ liệu minh họa", active:true, notes:"Không phải khuyến nghị liều" },medicationId);
  addRecord(operations,babyId,"reminders",{ title:"Lịch khám demo", reminderType:"medical_visit", scheduledAt:at(7,9), completed:false, linkedCollection:"medicalVisits", linkedRecordId:"", notes:"Chỉ hiển thị khi mở website" });
  return babyId;
}

function buildCompleteProfile(operations) {
  const babyId = newDocumentId(getBabiesPath());
  operations.push({ type: "set", path: getBabiesPath(), id: babyId, data: {
    name: "Trần Gia Hân", nickname: "Mây", gender: "female", birthDate: dateOnly(-310), birthTime: "06:45",
    birthWeight: 3.35, birthHeight: 51, birthHeadCircumference: 34.5, gestationalWeeks: 39, bloodType: "A+", hospital: "Bệnh viện Gia đình Demo",
    avatarUrl: "https://placehold.co/320x320/png?text=Baby+Demo", allergiesSummary: "Theo dõi phản ứng nhẹ với trứng; đã có bản ghi chi tiết trong mục Dị ứng.",
    emergencyContact: "Mẹ: 0900 111 222 · Ba: 0900 333 444", notes: `${COMPLETE_MARKER} Hồ sơ demo đầy đủ dữ liệu cho tất cả module. Mọi nội dung y tế chỉ là minh họa.`
  }});

  [[-280,4.1,54,36],[-240,5.2,59,38],[-180,6.5,64,40.5],[-120,7.5,68,42],[-60,8.2,71,43.2],[-3,8.8,73.5,44]].forEach(([days,w,h,head],index) => addRecord(operations,babyId,"growthRecords",{
    measuredAt:at(days,8,30), weightKg:w, heightCm:h, headCircumferenceCm:head, notes:`Lần đo demo đầy đủ ${index+1}; đo tại nhà và nhập thủ công.`
  }));

  const vaccineCompletedId = newDocumentId(getBabySubcollection(babyId, "vaccinations"));
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine 6 trong 1 (minh họa)", diseasePrevention:"Danh mục bệnh theo thông tin người dùng nhập", doseNumber:2, scheduledDate:at(-95,9), administeredDate:at(-94,9,15), status:"completed", clinic:"Trung tâm tiêm chủng Demo", provider:"Điều dưỡng Nguyễn Demo", batchNumber:"LOT-DEMO-621", reactions:"Sưng nhẹ tại chỗ tiêm trong ngày đầu", documentUrl:"https://example.com/demo-vaccine-certificate.pdf", notes:"Dữ liệu minh họa, không phải lịch tiêm khuyến nghị." },vaccineCompletedId);
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Phế cầu (minh họa)", diseasePrevention:"Thông tin phòng bệnh do người dùng nhập", doseNumber:2, scheduledDate:at(-60,9), administeredDate:at(-60,9,10), status:"completed", clinic:"Phòng tiêm Demo", provider:"Điều dưỡng Trần Demo", batchNumber:"PCV-DEMO-02", reactions:"Không ghi nhận", documentUrl:"https://example.com/demo-pcv.pdf", notes:"Bản ghi demo đầy đủ." });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine sắp tới (minh họa)", diseasePrevention:"Bệnh demo", doseNumber:3, scheduledDate:at(6,9), administeredDate:null, status:"upcoming", clinic:"Trung tâm tiêm chủng Demo", provider:"Chưa phân công", batchNumber:"Chưa có", reactions:"Chưa tiêm", documentUrl:"https://example.com/demo-appointment.pdf", notes:"Lịch minh họa; hãy dùng lịch do cơ sở y tế cung cấp." });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Vaccine đã lên lịch (minh họa)", diseasePrevention:"Bệnh demo khác", doseNumber:1, scheduledDate:at(35,10), administeredDate:null, status:"scheduled", clinic:"Bệnh viện Demo", provider:"Chưa xác định", batchNumber:"Chưa có", reactions:"Chưa tiêm", documentUrl:"https://example.com/demo-schedule.pdf", notes:"Dữ liệu demo." });
  addRecord(operations,babyId,"vaccinations",{ vaccineName:"Lịch đã hủy (minh họa)", diseasePrevention:"Bệnh demo", doseNumber:1, scheduledDate:at(-20,10), administeredDate:null, status:"cancelled", clinic:"Phòng tiêm Demo", provider:"Chưa phân công", batchNumber:"Không áp dụng", reactions:"Không áp dụng", documentUrl:"https://example.com/demo-cancelled.pdf", notes:"Hủy do thay đổi lịch gia đình." });

  const visitId = newDocumentId(getBabySubcollection(babyId, "medicalVisits"));
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-42,9,30), reason:"Khám sức khỏe định kỳ", symptoms:"Không có triệu chứng cấp tính", temperatureCelsius:36.7, weightKg:8.3, doctorName:"BS. Lê Minh Demo", facility:"Phòng khám Nhi Demo", diagnosisByDoctor:"Nội dung chẩn đoán minh họa do người dùng ghi lại", treatmentPlan:"Theo dõi sinh hoạt và làm theo hướng dẫn trực tiếp của bác sĩ", followUpDate:at(48,9,30), prescriptionUrl:"https://example.com/demo-prescription.pdf", testResultUrl:"https://example.com/demo-test-result.pdf", notes:"Bản ghi đầy đủ các trường để thử giao diện và báo cáo." },visitId);
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-18,15), reason:"Khám vì ho và sổ mũi", symptoms:"Ho nhẹ, sổ mũi, ăn giảm nhẹ", temperatureCelsius:37.4, weightKg:8.6, doctorName:"BS. Phạm An Demo", facility:"Bệnh viện Demo", diagnosisByDoctor:"Kết luận minh họa từ buổi khám", treatmentPlan:"Thực hiện đúng hướng dẫn được bác sĩ cung cấp", followUpDate:at(-11,15), prescriptionUrl:"https://example.com/demo-prescription-2.pdf", testResultUrl:"https://example.com/demo-result-2.pdf", notes:"Triệu chứng đã ổn theo ghi nhận của gia đình." });
  addRecord(operations,babyId,"medicalVisits",{ visitDate:at(-5,8,45), reason:"Tái khám", symptoms:"Đã giảm ho", temperatureCelsius:36.8, weightKg:8.8, doctorName:"BS. Phạm An Demo", facility:"Bệnh viện Demo", diagnosisByDoctor:"Theo dõi ổn định (dữ liệu minh họa)", treatmentPlan:"Tiếp tục theo hướng dẫn của bác sĩ", followUpDate:null, prescriptionUrl:"https://example.com/demo-followup-prescription.pdf", testResultUrl:"https://example.com/demo-followup-result.pdf", notes:"Không dùng nội dung demo để tự điều trị." });

  const feedRows = [
    { feedingType:"breastfeeding", startedAt:at(-1,6,30), endedAt:at(-1,6,48), amount:18, unit:"minute", breastSide:"left", foodName:"Bú mẹ", ingredients:"Sữa mẹ", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Cữ bú sáng demo" },
    { feedingType:"breast_milk_bottle", startedAt:at(-1,9), endedAt:at(-1,9,15), amount:120, unit:"ml", breastSide:null, foodName:"Sữa mẹ trữ", ingredients:"Sữa mẹ", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Hâm ấm theo cách gia đình sử dụng" },
    { feedingType:"solid_food", startedAt:at(-1,12), endedAt:at(-1,12,25), amount:110, unit:"g", breastSide:null, foodName:"Cháo bí đỏ thịt gà", ingredients:"Gạo, bí đỏ, thịt gà, dầu ăn", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Ăn gần hết khẩu phần" },
    { feedingType:"water", startedAt:at(-1,14), endedAt:at(-1,14,5), amount:30, unit:"ml", breastSide:null, foodName:"Nước", ingredients:"Nước", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Dữ liệu minh họa" },
    { feedingType:"formula", startedAt:at(-1,19), endedAt:at(-1,19,18), amount:150, unit:"ml", breastSide:null, foodName:"Sữa công thức demo", ingredients:"Theo nhãn sản phẩm người dùng nhập", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Không phải khuyến nghị lượng sữa" },
    { feedingType:"solid_food", startedAt:at(-4,12), endedAt:at(-4,12,20), amount:40, unit:"g", breastSide:null, foodName:"Trứng hấp demo", ingredients:"Trứng", allergyReaction:true, reactionDetails:"Nổi đỏ nhẹ quanh miệng; gia đình đã ngừng món và ghi nhận để trao đổi với bác sĩ", notes:"Dữ liệu minh họa liên kết với mục Dị ứng" },
    { feedingType:"other", startedAt:at(0,7,30), endedAt:at(0,7,40), amount:1, unit:"portion", breastSide:null, foodName:"Trái cây nghiền", ingredients:"Chuối chín", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Cữ ăn hôm nay" },
    { feedingType:"breastfeeding", startedAt:at(0,10,15), endedAt:at(0,10,32), amount:17, unit:"minute", breastSide:"both", foodName:"Bú mẹ", ingredients:"Sữa mẹ", allergyReaction:false, reactionDetails:"Không ghi nhận", notes:"Cữ bú hôm nay" }
  ];
  feedRows.forEach((row)=>addRecord(operations,babyId,"feedingRecords",row));

  [[-3,9,10,15,"day",0,"good","Nôi","Ngủ ngày yên"],[-2,20,6,30,"night",2,"average","Cũi","Giờ kết thúc thuộc ngày hôm sau được biểu diễn bằng bản ghi demo riêng"],[-2,9,10,5,"day",0,"good","Nôi","Giấc sáng"],[-1,13,14,20,"day",1,"average","Xe đẩy","Thức một lần"],[-1,20,23,50,"night",1,"good","Cũi","Phần đầu giấc đêm"],[0,0,6,10,"night",1,"good","Cũi","Phần tiếp theo của giấc đêm"],[0,9,10,0,"day",0,"good","Nôi","Giấc hôm nay"]].forEach(([days,startH,endH,endM,type,wake,quality,location,notes])=>{
    const start=at(days,startH,0); const end=at(days,endH,endM); if(end<=start) end.setDate(end.getDate()+1);
    addRecord(operations,babyId,"sleepRecords",{startedAt:start,endedAt:end,sleepType:type,wakeCount:wake,quality,location,notes});
  });

  [
    [-2,7,"wet","","",false,"","Tã sáng"],[-2,11,"dirty","Vàng nâu","Mềm",false,"","Đi ngoài bình thường theo ghi nhận"],[-2,16,"both","Vàng","Hơi lỏng",true,"Theo dõi thêm trong ngày","Bản ghi minh họa có đánh dấu bất thường"],[-1,7,"wet","","",false,"","Tã ướt"],[-1,12,"dirty","Vàng","Mềm",false,"","Dữ liệu demo"],[-1,18,"dry","","",false,"","Kiểm tra tã khô"],[0,7,"wet","","",false,"","Tã hôm nay"],[0,11,"both","Vàng","Mềm",false,"","Tã hôm nay"]
  ].forEach(([days,h,type,color,consistency,abnormal,details,notes])=>addRecord(operations,babyId,"diaperRecords",{changedAt:at(days,h),diaperType:type,stoolColor:color,stoolConsistency:consistency,abnormal,abnormalDetails:details,notes}));

  addRecord(operations,babyId,"symptomRecords",{ recordedAt:at(-20,8), temperatureCelsius:37.6, symptoms:["Ho","Sổ mũi"], otherSymptom:"Hắt hơi", severity:"mild", startedAt:at(-21,18), endedAt:at(-17,20), active:false, notes:"Triệu chứng đã kết thúc; dữ liệu minh họa." });
  addRecord(operations,babyId,"symptomRecords",{ recordedAt:at(-4,18), temperatureCelsius:38.1, symptoms:["Quấy khóc","Ăn kém"], otherSymptom:"Ngủ không sâu", severity:"moderate", startedAt:at(-4,15), endedAt:at(-3,8), active:false, notes:"Gia đình đã liên hệ cơ sở y tế theo tình huống thực tế; nội dung chỉ minh họa." });
  addRecord(operations,babyId,"symptomRecords",{ recordedAt:at(0,8), temperatureCelsius:37.2, symptoms:["Nghẹt mũi"], otherSymptom:"", severity:"mild", startedAt:at(-1,20), endedAt:null, active:true, notes:"Đang theo dõi và ghi chép, không phải chẩn đoán." });

  const vitaminId = newDocumentId(getBabySubcollection(babyId, "medications"));
  const medicineId = newDocumentId(getBabySubcollection(babyId, "medications"));
  addRecord(operations,babyId,"medications",{ name:"Vitamin D demo", category:"vitamin", dosage:"Theo đơn/hướng dẫn đã được gia đình nhập", unit:"giọt", route:"Uống", frequency:"Mỗi ngày", scheduledTimes:["08:00"], startDate:at(-180,8), endDate:null, prescribedBy:"BS. Demo", reason:"Bổ sung theo hướng dẫn chuyên môn được gia đình lưu lại", active:true, notes:"Ứng dụng không tự tính hoặc đề xuất liều." },vitaminId);
  addRecord(operations,babyId,"medications",{ name:"Thuốc demo đã kết thúc", category:"medicine", dosage:"Theo đơn bác sĩ", unit:"ml", route:"Uống", frequency:"Theo đơn", scheduledTimes:["08:00","20:00"], startDate:at(-20,8), endDate:at(-15,20), prescribedBy:"BS. Phạm An Demo", reason:"Nội dung lý do minh họa", active:false, notes:"Không sử dụng thông tin demo làm hướng dẫn dùng thuốc." },medicineId);
  addRecord(operations,babyId,"medicationLogs",{ medicationId:vitaminId, scheduledAt:at(-1,8), takenAt:at(-1,8,5), status:"taken", reaction:"Không ghi nhận", notes:"Vitamin D demo · đã ghi nhận" });
  addRecord(operations,babyId,"medicationLogs",{ medicationId:vitaminId, scheduledAt:at(0,8), takenAt:at(0,8,10), status:"taken", reaction:"Không ghi nhận", notes:"Vitamin D demo · đã ghi nhận hôm nay" });
  addRecord(operations,babyId,"medicationLogs",{ medicationId:medicineId, scheduledAt:at(-18,20), takenAt:at(-18,20,30), status:"taken", reaction:"Không ghi nhận", notes:"Thuốc demo theo đơn đã lưu" });
  addRecord(operations,babyId,"medicationLogs",{ medicationId:medicineId, scheduledAt:at(-17,8), takenAt:at(-17,8), status:"skipped", reaction:"Không áp dụng", notes:"Đánh dấu bỏ qua theo ghi nhận của gia đình" });

  addRecord(operations,babyId,"allergies",{ allergen:"Trứng (nghi ngờ)", allergyType:"food", discoveredAt:at(-4,12,30), symptoms:"Nổi đỏ nhẹ quanh miệng sau khi ăn món có trứng", severity:"mild", treatment:"Ngừng món ăn và ghi chép để trao đổi với bác sĩ", confirmedByDoctor:false, notes:"Dữ liệu demo; không phải kết luận dị ứng." });
  addRecord(operations,babyId,"allergies",{ allergen:"Bụi nhà", allergyType:"environment", discoveredAt:at(-35,9), symptoms:"Hắt hơi khi phòng nhiều bụi", severity:"mild", treatment:"Vệ sinh môi trường theo cách gia đình lựa chọn", confirmedByDoctor:true, notes:"Bản ghi minh họa trường đã được bác sĩ xác nhận." });

  [[-250,"Biết cười","social"],[-190,"Biết lẫy","motor"],[-130,"Biết ngồi có hỗ trợ","motor"],[-70,"Bập bẹ âm đầu tiên","language"],[-20,"Tự cầm thức ăn mềm","cognitive"]].forEach(([days,name,category],index)=>addRecord(operations,babyId,"milestones",{ milestoneName:name, achievedDate:at(days,10), category, mediaUrl:`https://example.com/demo-milestone-${index+1}.jpg`, notes:`Mốc phát triển demo ${index+1}; ngày do gia đình ghi nhận.` }));

  [["L-R1",-45,-32,"Chảy dãi, thích cắn đồ mềm","Răng cửa dưới phải đầu tiên"],["L-L1",-42,-29,"Nướu hơi sưng","Răng cửa dưới trái"],["U-R1",-12,-3,"Quấy nhẹ buổi tối","Răng cửa trên phải"]].forEach(([position,symptomDays,eruptDays,symptoms,notes])=>addRecord(operations,babyId,"teethingRecords",{ toothPosition:position, symptomStartDate:at(symptomDays,8), eruptedDate:at(eruptDays,8), symptoms, notes }));

  addRecord(operations,babyId,"reminders",{ title:"Tiêm phòng demo sắp tới", reminderType:"vaccination", scheduledAt:at(6,9), completed:false, linkedCollection:"vaccinations", linkedRecordId:vaccineCompletedId, notes:"Nhắc việc chỉ xuất hiện khi mở website." });
  addRecord(operations,babyId,"reminders",{ title:"Tái khám định kỳ demo", reminderType:"follow_up", scheduledAt:at(48,9,30), completed:false, linkedCollection:"medicalVisits", linkedRecordId:visitId, notes:"Lịch minh họa." });
  addRecord(operations,babyId,"reminders",{ title:"Ghi nhận vitamin hôm nay", reminderType:"vitamin", scheduledAt:at(0,8), completed:true, linkedCollection:"medications", linkedRecordId:vitaminId, notes:"Đã hoàn thành trong dữ liệu demo." });
  addRecord(operations,babyId,"reminders",{ title:"Đo cân nặng cuối tuần", reminderType:"growth", scheduledAt:at(3,8), completed:false, linkedCollection:"growthRecords", linkedRecordId:"", notes:"Chuẩn bị cân và ghi chép." });
  addRecord(operations,babyId,"reminders",{ title:"Khám bệnh demo", reminderType:"medical_visit", scheduledAt:at(14,10), completed:false, linkedCollection:"medicalVisits", linkedRecordId:"", notes:"Sự kiện minh họa." });
  addRecord(operations,babyId,"reminders",{ title:"Chuẩn bị đồ dùng cho bé", reminderType:"other", scheduledAt:at(2,19), completed:false, linkedCollection:"", linkedRecordId:"", notes:"Nhắc việc gia đình khác." });

  return babyId;
}

export async function createDemoData() {
  const state = getState();
  if (state.currentRole !== "admin") {
    showToast("Chỉ admin được tạo dữ liệu demo.", "warning");
    return;
  }

  const basicExisting = state.babies.find((baby) => String(baby.notes || "").includes(BASIC_MARKER));
  const completeExisting = state.babies.find((baby) => String(baby.notes || "").includes(COMPLETE_MARKER));
  if (basicExisting && completeExisting) {
    setSelectedBaby(completeExisting.id);
    showToast("Hai hồ sơ demo đã tồn tại. Đã chuyển sang hồ sơ demo đầy đủ.", "warning", 6500);
    return;
  }

  const missing = [];
  if (!basicExisting) missing.push("1 hồ sơ demo cơ bản");
  if (!completeExisting) missing.push("1 hồ sơ demo đầy đủ với dữ liệu ở tất cả module");
  const confirmed = await confirmDialog({
    title: "Tạo dữ liệu demo còn thiếu?",
    message: `Sẽ tạo ${missing.join(" và ")}. Hồ sơ đầy đủ gồm dữ liệu tăng trưởng, tiêm phòng, khám bệnh, ăn uống, ngủ, tã, triệu chứng, thuốc và lịch sử dùng thuốc, dị ứng, mốc phát triển, mọc răng và nhắc việc.`,
    confirmLabel: "Tạo dữ liệu demo"
  });
  if (!confirmed) return;

  const operations = [];
  let selectedId = completeExisting?.id || basicExisting?.id || null;
  if (!basicExisting) selectedId = buildBasicProfile(operations);
  if (!completeExisting) selectedId = buildCompleteProfile(operations);

  try {
    await runWriteBatch(operations);
    setSelectedBaby(selectedId);
    showToast(`Đã tạo ${missing.join(" và ")} thành công.`, "success", 7000);
  } catch (error) {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể tạo dữ liệu demo. Không có batch nào được ghi nếu thao tác thất bại."), "error", 9000);
  }
}

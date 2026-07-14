import {
  Timestamp,
  deleteDocument,
  getBabiesPath,
  getBabySubcollection,
  newDocumentId,
  runWriteBatch,
  softDeleteDocument
} from "./firestore-service.js";
import { getState } from "./app-state.js";
import { isValidUrl, trimText } from "./validators.js";

export const BACKUP_SCHEMA_VERSION = 2;
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_RECORDS = 10000;

const metadataFields = new Set([
  "id", "createdByUid", "createdByEmail", "createdAt", "updatedAt",
  "isDeleted", "deletedAt", "deletedByUid", "deletedByEmail",
  "avatarStoragePath", "mediaStoragePath"
]);

const babyFields = {
  name: "requiredString", nickname: "string", gender: "requiredString", birthDate: "requiredDateString", birthTime: "string",
  birthWeight: "number", birthHeight: "number", birthHeadCircumference: "number", gestationalWeeks: "number",
  bloodType: "string", hospital: "string", avatarUrl: "url", allergiesSummary: "string", emergencyContact: "string", notes: "string"
};

export const collectionSchemas = {
  growthRecords: { measuredAt: "requiredTimestamp", weightKg: "number", heightCm: "number", headCircumferenceCm: "number", notes: "string" },
  vaccinations: { vaccineName: "requiredString", diseasePrevention: "string", doseNumber: "requiredNumber", scheduledDate: "requiredTimestamp", administeredDate: "timestamp", status: "requiredString", clinic: "string", provider: "string", batchNumber: "string", reactions: "string", documentUrl: "url", notes: "string" },
  medicalVisits: { visitDate: "requiredTimestamp", reason: "requiredString", symptoms: "string", temperatureCelsius: "number", weightKg: "number", doctorName: "string", facility: "string", diagnosisByDoctor: "string", treatmentPlan: "string", followUpDate: "timestamp", prescriptionUrl: "url", testResultUrl: "url", notes: "string" },
  feedingRecords: { feedingType: "requiredString", startedAt: "requiredTimestamp", endedAt: "timestamp", amount: "number", unit: "string", breastSide: "string", foodName: "string", ingredients: "string", allergyReaction: "requiredBoolean", reactionDetails: "string", notes: "string" },
  sleepRecords: { startedAt: "requiredTimestamp", endedAt: "requiredTimestamp", sleepType: "requiredString", wakeCount: "requiredNumber", quality: "requiredString", location: "string", notes: "string" },
  diaperRecords: { changedAt: "requiredTimestamp", diaperType: "requiredString", stoolColor: "string", stoolConsistency: "string", abnormal: "requiredBoolean", abnormalDetails: "string", notes: "string" },
  symptomRecords: { recordedAt: "requiredTimestamp", temperatureCelsius: "number", symptoms: "array", otherSymptom: "string", severity: "requiredString", startedAt: "requiredTimestamp", endedAt: "timestamp", active: "requiredBoolean", notes: "string" },
  medications: { name: "requiredString", category: "requiredString", dosage: "requiredString", unit: "string", route: "string", frequency: "string", scheduledTimes: "array", startDate: "requiredTimestamp", endDate: "timestamp", prescribedBy: "string", reason: "string", active: "requiredBoolean", notes: "string" },
  medicationLogs: { medicationId: "requiredString", scheduledAt: "requiredTimestamp", takenAt: "requiredTimestamp", status: "requiredString", reaction: "string", notes: "string" },
  allergies: { allergen: "requiredString", allergyType: "requiredString", discoveredAt: "requiredTimestamp", symptoms: "string", severity: "requiredString", treatment: "string", confirmedByDoctor: "requiredBoolean", notes: "string" },
  milestones: { milestoneName: "requiredString", achievedDate: "requiredTimestamp", category: "requiredString", mediaUrl: "url", notes: "string" },
  teethingRecords: { toothPosition: "requiredString", symptomStartDate: "timestamp", eruptedDate: "requiredTimestamp", symptoms: "string", notes: "string" },
  reminders: { title: "requiredString", reminderType: "requiredString", scheduledAt: "requiredTimestamp", completed: "requiredBoolean", linkedCollection: "string", linkedRecordId: "string", notes: "string" }
};

const enumValues = {
  "baby.gender": ["male", "female", "other"],
  "vaccinations.status": ["scheduled", "upcoming", "completed", "overdue", "cancelled"],
  "feedingRecords.feedingType": ["breastfeeding", "breast_milk_bottle", "formula", "solid_food", "water", "other"],
  "feedingRecords.unit": ["ml", "g", "minute", "portion", ""],
  "feedingRecords.breastSide": ["left", "right", "both", ""],
  "sleepRecords.sleepType": ["day", "night"],
  "sleepRecords.quality": ["good", "average", "poor"],
  "diaperRecords.diaperType": ["wet", "dirty", "both", "dry"],
  "symptomRecords.severity": ["mild", "moderate", "severe"],
  "medications.category": ["vitamin", "medicine", "supplement", "other"],
  "medicationLogs.status": ["taken", "skipped", "missed"],
  "allergies.allergyType": ["food", "medicine", "environment", "other"],
  "allergies.severity": ["mild", "moderate", "severe"],
  "milestones.category": ["motor", "language", "social", "cognitive", "other"],
  "reminders.reminderType": ["vaccination", "medical_visit", "follow_up", "medication", "vitamin", "growth", "other"]
};

function toDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

function parseTimestamp(value, required, path, errors) {
  if (value === null || value === undefined || value === "") {
    if (required) errors.push(`${path}: thiếu ngày giờ bắt buộc.`);
    return null;
  }
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${path}: ngày giờ không hợp lệ.`);
    return null;
  }
  return Timestamp.fromDate(date);
}

function normalizeField(value, type, path, errors) {
  const required = type.startsWith("required");
  const base = type.replace("required", "").replace(/^./, (char) => char.toLowerCase());
  if ((value === null || value === undefined || value === "") && required && !["boolean", "number"].includes(base)) {
    errors.push(`${path}: trường bắt buộc đang trống.`);
    return null;
  }
  if (base === "timestamp") return parseTimestamp(value, required, path, errors);
  if (base === "dateString") {
    const text = String(value || "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) {
      errors.push(`${path}: ngày YYYY-MM-DD không hợp lệ.`);
      return text;
    }
    const [, yearText, monthText, dayText] = match;
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const parsed = new Date(year, month - 1, day);
    if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) {
      errors.push(`${path}: ngày YYYY-MM-DD không hợp lệ.`);
    }
    return text;
  }
  if (base === "string") {
    const text = trimText(value ?? "", 3000);
    if (required && !text) errors.push(`${path}: chuỗi bắt buộc đang trống.`);
    return text;
  }
  if (base === "url") {
    const text = trimText(value ?? "", 1500);
    if (text && !isValidUrl(text)) errors.push(`${path}: URL không hợp lệ.`);
    // Backup không mang theo file Storage. URL Firebase Storage cũ bị loại bỏ để tránh tham chiếu sai workspace.
    if (/firebasestorage\.googleapis\.com|storage\.googleapis\.com/i.test(text)) return "";
    return text;
  }
  if (base === "number") {
    if (value === null || value === undefined || value === "") {
      if (required) errors.push(`${path}: thiếu số bắt buộc.`);
      return null;
    }
    const number = Number(value);
    if (!Number.isFinite(number)) errors.push(`${path}: không phải số hợp lệ.`);
    return number;
  }
  if (base === "boolean") {
    if (typeof value !== "boolean") errors.push(`${path}: phải là true hoặc false.`);
    return value === true;
  }
  if (base === "array") {
    if (!Array.isArray(value)) {
      errors.push(`${path}: phải là mảng.`);
      return [];
    }
    return value.slice(0, 50).map((item) => trimText(item, 200)).filter(Boolean);
  }
  return null;
}

function normalizeObject(source, schema, path, errors) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    errors.push(`${path}: phải là object.`);
    return {};
  }
  const output = {};
  Object.entries(schema).forEach(([field, type]) => {
    output[field] = normalizeField(source[field], type, `${path}.${field}`, errors);
  });
  return output;
}

function assertEnum(scope, field, value, path, errors) {
  const allowed = enumValues[`${scope}.${field}`];
  if (allowed && !allowed.includes(value ?? "")) errors.push(`${path}.${field}: giá trị không nằm trong danh sách cho phép.`);
}

function assertRange(value, min, max, path, errors) {
  if (value === null || value === undefined) return;
  if (value < min || value > max) errors.push(`${path}: phải nằm trong khoảng ${min}–${max}.`);
}

function assertChronology(start, end, path, errors) {
  if (!start || !end) return;
  if (toDate(end).getTime() < toDate(start).getTime()) errors.push(`${path}: thời điểm kết thúc không được trước thời điểm bắt đầu.`);
}

function validateSemantics(scope, data, path, errors) {
  Object.keys(data).forEach((field) => assertEnum(scope, field, data[field], path, errors));
  if (scope === "baby") {
    const birth = new Date(`${data.birthDate}T00:00:00`);
    if (!Number.isNaN(birth.getTime()) && birth.getTime() > Date.now()) errors.push(`${path}.birthDate: không được ở tương lai.`);
    assertRange(data.birthWeight, 0.1, 20, `${path}.birthWeight`, errors);
    assertRange(data.birthHeight, 20, 100, `${path}.birthHeight`, errors);
    assertRange(data.birthHeadCircumference, 15, 70, `${path}.birthHeadCircumference`, errors);
    assertRange(data.gestationalWeeks, 20, 45, `${path}.gestationalWeeks`, errors);
  }
  if (scope === "growthRecords") {
    if (data.weightKg === null && data.heightCm === null && data.headCircumferenceCm === null) errors.push(`${path}: phải có ít nhất một số đo.`);
    assertRange(data.weightKg, 0.1, 80, `${path}.weightKg`, errors);
    assertRange(data.heightCm, 20, 180, `${path}.heightCm`, errors);
    assertRange(data.headCircumferenceCm, 15, 80, `${path}.headCircumferenceCm`, errors);
  }
  if (scope === "vaccinations") assertRange(data.doseNumber, 1, 30, `${path}.doseNumber`, errors);
  if (scope === "medicalVisits") {
    assertRange(data.temperatureCelsius, 30, 45, `${path}.temperatureCelsius`, errors);
    assertRange(data.weightKg, 0.1, 80, `${path}.weightKg`, errors);
  }
  if (scope === "feedingRecords") {
    assertRange(data.amount, 0, 10000, `${path}.amount`, errors);
    assertChronology(data.startedAt, data.endedAt, `${path}.endedAt`, errors);
  }
  if (scope === "sleepRecords") {
    assertChronology(data.startedAt, data.endedAt, `${path}.endedAt`, errors);
    assertRange(data.wakeCount, 0, 100, `${path}.wakeCount`, errors);
  }
  if (scope === "symptomRecords") {
    assertRange(data.temperatureCelsius, 30, 45, `${path}.temperatureCelsius`, errors);
    assertChronology(data.startedAt, data.endedAt, `${path}.endedAt`, errors);
  }
  if (scope === "medications") assertChronology(data.startDate, data.endDate, `${path}.endDate`, errors);
}

export function validateBackupPayload(payload) {
  const errors = [];
  const warnings = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return { valid: false, errors: ["File JSON phải chứa một object."] };
  if (payload.schemaVersion !== BACKUP_SCHEMA_VERSION) errors.push(`schemaVersion phải bằng ${BACKUP_SCHEMA_VERSION}.`);
  const baby = normalizeObject(payload.baby, babyFields, "baby", errors);
  validateSemantics("baby", baby, "baby", errors);
  const sourceCollections = payload.collections || payload.data;
  if (!sourceCollections || typeof sourceCollections !== "object" || Array.isArray(sourceCollections)) errors.push("collections phải là object.");
  const unknownCollections = Object.keys(sourceCollections || {}).filter((name) => !collectionSchemas[name]);
  if (unknownCollections.length) errors.push(`Có collection không được hỗ trợ: ${unknownCollections.slice(0, 10).join(", ")}.`);
  const collections = {};
  let totalRecords = 0;
  Object.entries(collectionSchemas).forEach(([name, schema]) => {
    const records = sourceCollections?.[name] ?? [];
    if (!Array.isArray(records)) {
      errors.push(`collections.${name} phải là mảng.`);
      collections[name] = [];
      return;
    }
    totalRecords += records.length;
    const seenIds = new Set();
    collections[name] = records.map((record, index) => {
      const path = `collections.${name}[${index}]`;
      const data = normalizeObject(record, schema, path, errors);
      validateSemantics(name, data, path, errors);
      const sourceId = trimText(record?.id || record?.sourceId || "", 200);
      if (!sourceId) errors.push(`${path}.id: backup schema v2 yêu cầu ID nguồn.`);
      else if (seenIds.has(sourceId)) errors.push(`${path}.id: ID nguồn bị trùng trong collection.`);
      else seenIds.add(sourceId);
      return { sourceId, data };
    });
  });
  const medicationIds = new Set((collections.medications || []).map((record) => record.sourceId));
  (collections.medicationLogs || []).forEach((record, index) => {
    if (record.data.medicationId && !medicationIds.has(record.data.medicationId)) {
      warnings.push(`Lịch sử dùng thuốc #${index + 1} tham chiếu tới thuốc không có trong backup; ID cũ sẽ được giữ nguyên.`);
    }
  });
  (collections.reminders || []).forEach((record, index) => {
    const linkedCollection = record.data.linkedCollection;
    const linkedRecordId = record.data.linkedRecordId;
    if (linkedRecordId && !linkedCollection) {
      errors.push(`collections.reminders[${index}].linkedCollection: bắt buộc khi có linkedRecordId.`);
      return;
    }
    if (!linkedCollection) return;
    if (!collectionSchemas[linkedCollection]) {
      errors.push(`collections.reminders[${index}].linkedCollection: collection liên kết không được hỗ trợ.`);
      return;
    }
    if (!linkedRecordId) return;
    const linkedIds = new Set((collections[linkedCollection] || []).map((item) => item.sourceId));
    if (!linkedIds.has(linkedRecordId)) warnings.push(`Nhắc việc #${index + 1} không tìm thấy bản ghi liên kết; ID cũ sẽ được giữ nguyên.`);
  });
  if (totalRecords > MAX_IMPORT_RECORDS) errors.push(`Backup có ${totalRecords} bản ghi, vượt giới hạn ${MAX_IMPORT_RECORDS}.`);
  return {
    valid: errors.length === 0,
    errors: errors.slice(0, 100),
    warnings: warnings.slice(0, 100),
    normalized: { baby, collections, totalRecords }
  };
}

function remapLinks(name, data, idMaps) {
  const output = { ...data };
  if (name === "medicationLogs" && output.medicationId) {
    output.medicationId = idMaps.medications.get(output.medicationId) || output.medicationId;
  }
  if (name === "reminders" && output.linkedCollection && output.linkedRecordId) {
    output.linkedRecordId = idMaps[output.linkedCollection]?.get(output.linkedRecordId) || output.linkedRecordId;
  }
  return output;
}

export async function importBackupAsNewBaby(validated) {
  const state = getState();
  if (state.currentRole !== "admin") throw new Error("Chỉ admin workspace được nhập backup JSON.");
  const babiesPath = getBabiesPath();
  const babyId = newDocumentId(babiesPath);
  const baby = {
    ...validated.baby,
    name: `${validated.baby.name} (khôi phục)`,
    avatarUrl: validated.baby.avatarUrl || ""
  };

  const idMaps = Object.fromEntries(Object.keys(collectionSchemas).map((name) => [name, new Map()]));
  Object.entries(validated.collections).forEach(([name, records]) => {
    records.forEach((record) => {
      const newId = newDocumentId(getBabySubcollection(babyId, name));
      if (record.sourceId) idMaps[name].set(record.sourceId, newId);
      record.targetId = newId;
    });
  });

  const operations = [{ type: "create", path: babiesPath, id: babyId, data: baby }];
  Object.entries(validated.collections).forEach(([name, records]) => {
    records.forEach((record) => {
      operations.push({
        type: "create",
        path: getBabySubcollection(babyId, name),
        id: record.targetId,
        data: remapLinks(name, record.data, idMaps)
      });
    });
  });
  const committedOperations = [];
  try {
    await runWriteBatch(operations, {
      onChunkCommitted({ chunk }) { committedOperations.push(...chunk); }
    });
    return { babyId, operationCount: operations.length };
  } catch (error) {
    console.error("Backup import failed; attempting rollback", error);
    const babyWasCreated = committedOperations.some((operation) => operation.path === babiesPath && operation.id === babyId);
    if (babyWasCreated) {
      try {
        await softDeleteDocument(babiesPath, babyId);
        const committedChildren = committedOperations.filter((operation) => !(operation.path === babiesPath && operation.id === babyId));
        if (committedChildren.length) {
          await runWriteBatch(committedChildren.map((operation) => ({ type: "delete", path: operation.path, id: operation.id })));
        }
        await deleteDocument(babiesPath, babyId);
      } catch (rollbackError) {
        console.error("Backup rollback failed", rollbackError);
        const partial = new Error(`Nhập backup bị gián đoạn và không thể dọn hoàn toàn. Hồ sơ tạm có ID ${babyId}; hãy kiểm tra Thùng rác.`);
        partial.cause = error;
        throw partial;
      }
    }
    throw error;
  }
}

export function sanitizeBackupRecord(record) {
  const result = { id: trimText(record?.id || "", 200) };
  Object.entries(record || {}).forEach(([key, value]) => {
    if (!metadataFields.has(key)) result[key] = value;
  });
  return result;
}

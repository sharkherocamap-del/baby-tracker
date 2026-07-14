import {
  documentExists,
  getAllPagesResult,
  getBabySubcollection,
  getBabiesPath,
  getWorkspacePath,
  runWriteBatch,
  serverTimestamp,
  updateDocument
} from "./firestore-service.js";
import { getState } from "./app-state.js";

export const LEGACY_SUBCOLLECTIONS = [
  ["growthRecords", "measuredAt"],
  ["vaccinations", "scheduledDate"],
  ["medicalVisits", "visitDate"],
  ["feedingRecords", "startedAt"],
  ["sleepRecords", "startedAt"],
  ["diaperRecords", "changedAt"],
  ["symptomRecords", "recordedAt"],
  ["medications", "startDate"],
  ["medicationLogs", "takenAt"],
  ["allergies", "discoveredAt"],
  ["milestones", "achievedDate"],
  ["teethingRecords", "eruptedDate"],
  ["reminders", "scheduledAt"]
];

const metadataKeys = new Set([
  "id", "createdByUid", "createdByEmail", "createdAt", "updatedAt",
  "isDeleted", "deletedAt", "deletedByUid", "deletedByEmail"
]);

function stripLegacyMetadata(record) {
  const output = {};
  Object.entries(record || {}).forEach(([key, value]) => {
    if (!metadataKeys.has(key)) output[key] = value;
  });
  return output;
}

/**
 * Sao chép dữ liệu từ cấu trúc MVP toàn cục `babies/*` sang workspace hiện tại.
 * Không xóa dữ liệu cũ; giữ nguyên ID để các liên kết nội bộ còn đúng.
 */
export async function migrateLegacyDataToCurrentWorkspace({ onProgress } = {}) {
  const state = getState();
  if (state.currentRole !== "admin") throw new Error("Chỉ admin workspace được chạy migration.");
  const legacyBabyResult = await getAllPagesResult("babies", {
    orderByField: "name",
    orderDirection: "asc",
    pageSize: 100,
    maxRecords: 1000
  });
  if (legacyBabyResult.truncated) throw new Error("Có hơn 1.000 hồ sơ legacy; hãy migration bằng công cụ backend có kiểm soát.");
  const legacyBabies = legacyBabyResult.items;
  const operations = [];
  let skippedBabies = 0;
  let copiedBabies = 0;
  let copiedRecords = 0;

  for (let babyIndex = 0; babyIndex < legacyBabies.length; babyIndex += 1) {
    const baby = legacyBabies[babyIndex];
    onProgress?.({ phase: "baby", current: babyIndex + 1, total: legacyBabies.length, name: baby.name || baby.id });
    if (await documentExists(getBabiesPath(), baby.id)) {
      skippedBabies += 1;
      continue;
    }
    operations.push({ type: "create", path: getBabiesPath(), id: baby.id, data: stripLegacyMetadata(baby) });
    copiedBabies += 1;

    for (const [collectionName, orderByField] of LEGACY_SUBCOLLECTIONS) {
      const legacyPath = `babies/${baby.id}/${collectionName}`;
      const recordResult = await getAllPagesResult(legacyPath, {
        orderByField,
        orderDirection: "desc",
        pageSize: 100,
        maxRecords: 10000
      });
      if (recordResult.truncated) throw new Error(`${legacyPath} có hơn 10.000 bản ghi; dừng migration để tránh sao chép thiếu.`);
      recordResult.items.forEach((record) => {
        operations.push({
          type: "create",
          path: getBabySubcollection(baby.id, collectionName),
          id: record.id,
          data: stripLegacyMetadata(record)
        });
        copiedRecords += 1;
      });
    }
  }

  if (operations.length) await runWriteBatch(operations);
  await updateDocument(getWorkspacePath(), null, {
    legacyMigrationStatus: "completed",
    legacyMigratedAt: serverTimestamp(),
    legacyMigratedBabyCount: copiedBabies,
    legacyMigratedRecordCount: copiedRecords,
    updatedAt: serverTimestamp()
  }, { withMetadata: false });

  return {
    legacyBabyCount: legacyBabies.length,
    copiedBabies,
    skippedBabies,
    copiedRecords,
    operationCount: operations.length
  };
}

import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit as limitConstraint,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirebaseServices } from "./firebase-service.js";
import { getState } from "./app-state.js";

const DEFAULT_PAGE_SIZE = 20;

function splitPath(path) {
  return String(path).split("/").filter(Boolean);
}

function collectionRef(path) {
  const { db } = getFirebaseServices();
  return collection(db, ...splitPath(path));
}

function documentRef(path, id = null) {
  const { db } = getFirebaseServices();
  const parts = splitPath(path);
  return id ? doc(db, ...parts, id) : doc(db, ...parts);
}

function requireUser() {
  const { currentUser } = getState();
  if (!currentUser?.uid || !currentUser?.email) throw new Error("Không có người dùng hợp lệ để tạo metadata.");
  return currentUser;
}

function metadataForCreate({ softDelete = true } = {}) {
  const currentUser = requireUser();
  const metadata = {
    createdByUid: currentUser.uid,
    createdByEmail: currentUser.email.trim().toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  if (softDelete) {
    Object.assign(metadata, {
      isDeleted: false,
      deletedAt: null,
      deletedByUid: null,
      deletedByEmail: null
    });
  }
  return metadata;
}

function sanitizeUpdate(data) {
  const {
    createdByUid,
    createdByEmail,
    createdAt,
    id,
    isDeleted,
    deletedAt,
    deletedByUid,
    deletedByEmail,
    ...safe
  } = data;
  return { ...safe, updatedAt: serverTimestamp() };
}

function addDeletedConstraint(constraints, deletedMode) {
  if (deletedMode === "active") constraints.push(where("isDeleted", "==", false));
  if (deletedMode === "trash") constraints.push(where("isDeleted", "==", true));
}

function buildQuery(path, options = {}) {
  const constraints = [];
  addDeletedConstraint(constraints, options.deletedMode);
  for (const item of options.where || []) constraints.push(where(item.field, item.operator, item.value));
  if (options.orderByField) constraints.push(orderBy(options.orderByField, options.orderDirection || "desc"));
  if (options.startAfterDocument) constraints.push(startAfter(options.startAfterDocument));
  if (options.limit) constraints.push(limitConstraint(options.limit));
  return query(collectionRef(path), ...constraints);
}

export async function createDocument(path, data, options = {}) {
  const payload = options.withMetadata === false
    ? { ...data }
    : { ...data, ...metadataForCreate({ softDelete: options.softDelete !== false }) };
  if (options.id) {
    const ref = documentRef(path, options.id);
    await setDoc(ref, payload, { merge: options.merge === true });
    return { id: options.id, ...payload };
  }
  const ref = await addDoc(collectionRef(path), payload);
  return { id: ref.id, ...payload };
}

export async function getDocument(path, id = null) {
  const snapshot = await getDoc(documentRef(path, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function updateDocument(path, id, data, options = {}) {
  const payload = options.withMetadata === false ? { ...data } : sanitizeUpdate(data);
  await updateDoc(documentRef(path, id), payload);
}

/** Xóa vật lý. Chỉ dùng cho dữ liệu cấu hình hoặc thao tác purge có xác nhận admin. */
export async function deleteDocument(path, id = null) {
  await deleteDoc(documentRef(path, id));
}

export async function softDeleteDocument(path, id) {
  const currentUser = requireUser();
  await updateDoc(documentRef(path, id), {
    isDeleted: true,
    deletedAt: serverTimestamp(),
    deletedByUid: currentUser.uid,
    deletedByEmail: currentUser.email.trim().toLowerCase(),
    updatedAt: serverTimestamp()
  });
}

export async function restoreDocument(path, id) {
  await updateDoc(documentRef(path, id), {
    isDeleted: false,
    deletedAt: null,
    deletedByUid: null,
    deletedByEmail: null,
    updatedAt: serverTimestamp()
  });
}

export async function documentExists(path, id = null) {
  const snapshot = await getDoc(documentRef(path, id));
  return snapshot.exists();
}

export async function getCollection(path, options = {}) {
  const snapshot = await getDocs(buildQuery(path, options));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

/**
 * Tải một trang bằng Firestore cursor. `lastDocument` là DocumentSnapshot dùng cho startAfter.
 */
export async function getCollectionPage(path, options = {}) {
  const pageSize = Math.min(Math.max(Number(options.pageSize) || DEFAULT_PAGE_SIZE, 1), 100);
  const snapshot = await getDocs(buildQuery(path, {
    ...options,
    startAfterDocument: options.startAfterDocument || null,
    limit: pageSize + 1
  }));
  const hasMore = snapshot.docs.length > pageSize;
  const visibleDocs = snapshot.docs.slice(0, pageSize);
  return {
    items: visibleDocs.map((item) => ({ id: item.id, ...item.data() })),
    lastDocument: visibleDocs.at(-1) || null,
    hasMore,
    count: visibleDocs.length
  };
}

export async function getAllPagesResult(path, options = {}) {
  const maxRecords = Math.min(Math.max(Number(options.maxRecords) || 2000, 1), 10000);
  const pageSize = Math.min(Number(options.pageSize) || 100, 100);
  const items = [];
  let cursor = null;
  let hasMore = true;
  while (hasMore && items.length < maxRecords) {
    const remaining = maxRecords - items.length;
    const page = await getCollectionPage(path, { ...options, pageSize: Math.min(pageSize, remaining), startAfterDocument: cursor });
    items.push(...page.items);
    cursor = page.lastDocument;
    hasMore = page.hasMore && Boolean(cursor);
  }
  return { items, truncated: hasMore, lastDocument: cursor };
}

export async function getAllPages(path, options = {}) {
  const result = await getAllPagesResult(path, options);
  return result.items;
}

export function subscribeToCollection(path, options, onData, onError) {
  const q = buildQuery(path, options);
  return onSnapshot(q, (snapshot) => {
    onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
  }, (error) => {
    console.error(error);
    onError?.(error);
  });
}

export function getWorkspacePath(relativePath = "") {
  const { currentWorkspaceId } = getState();
  if (!currentWorkspaceId) throw new Error("Chưa chọn workspace gia đình.");
  return relativePath ? `workspaces/${currentWorkspaceId}/${relativePath}` : `workspaces/${currentWorkspaceId}`;
}

export function getBabiesPath() {
  return getWorkspacePath("babies");
}

export function getBabySubcollection(babyId, subcollection) {
  if (!babyId) throw new Error("Chưa chọn em bé.");
  return getWorkspacePath(`babies/${babyId}/${subcollection}`);
}

export function createBabyRecord(babyId, subcollection, data, options = {}) {
  return createDocument(getBabySubcollection(babyId, subcollection), data, options);
}

export function updateBabyRecord(babyId, subcollection, recordId, data) {
  return updateDocument(getBabySubcollection(babyId, subcollection), recordId, data);
}

export function deleteBabyRecord(babyId, subcollection, recordId) {
  return softDeleteDocument(getBabySubcollection(babyId, subcollection), recordId);
}

export function restoreBabyRecord(babyId, subcollection, recordId) {
  return restoreDocument(getBabySubcollection(babyId, subcollection), recordId);
}

export function hardDeleteBabyRecord(babyId, subcollection, recordId) {
  return deleteDocument(getBabySubcollection(babyId, subcollection), recordId);
}

export function newDocumentId(path) {
  return doc(collectionRef(path)).id;
}

export async function runWriteBatch(operations, options = {}) {
  const { db } = getFirebaseServices();
  const chunks = [];
  let committedCount = 0;
  for (let index = 0; index < operations.length; index += 450) chunks.push(operations.slice(index, index + 450));
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex];
    const batch = writeBatch(db);
    chunk.forEach((operation) => {
      const ref = operation.id ? documentRef(operation.path, operation.id) : doc(collectionRef(operation.path));
      if (operation.type === "delete") {
        batch.delete(ref);
        return;
      }
      if (operation.type === "update") {
        batch.update(ref, operation.withMetadata === false ? operation.data : sanitizeUpdate(operation.data));
        return;
      }
      const payload = operation.withMetadata === false
        ? operation.data
        : { ...operation.data, ...metadataForCreate({ softDelete: operation.softDelete !== false }) };
      batch.set(ref, payload, { merge: operation.merge === true });
    });
    await batch.commit();
    committedCount += chunk.length;
    options.onChunkCommitted?.({ chunkIndex, chunk, committedCount, total: operations.length });
  }
  return { committedCount, chunkCount: chunks.length };
}

export { Timestamp, serverTimestamp, documentId };

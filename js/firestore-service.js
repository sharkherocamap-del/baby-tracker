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

function metadataForCreate() {
  const { currentUser } = getState();
  if (!currentUser?.uid || !currentUser?.email) throw new Error("Không có người dùng hợp lệ để tạo metadata.");
  return {
    createdByUid: currentUser.uid,
    createdByEmail: currentUser.email.trim().toLowerCase(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
}

function sanitizeUpdate(data) {
  const { createdByUid, createdByEmail, createdAt, id, ...safe } = data;
  return { ...safe, updatedAt: serverTimestamp() };
}

function buildQuery(path, options = {}) {
  const constraints = [];
  for (const item of options.where || []) constraints.push(where(item.field, item.operator, item.value));
  if (options.orderByField) constraints.push(orderBy(options.orderByField, options.orderDirection || "desc"));
  if (options.startAfterDocument) constraints.push(startAfter(options.startAfterDocument));
  if (options.limit) constraints.push(limitConstraint(options.limit));
  return query(collectionRef(path), ...constraints);
}

export async function createDocument(path, data, options = {}) {
  const payload = options.withMetadata === false ? { ...data } : { ...data, ...metadataForCreate() };
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

export async function deleteDocument(path, id = null) {
  await deleteDoc(documentRef(path, id));
}

export async function documentExists(path, id = null) {
  const snapshot = await getDoc(documentRef(path, id));
  return snapshot.exists();
}

export async function getCollection(path, options = {}) {
  const snapshot = await getDocs(buildQuery(path, options));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
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

export function getBabySubcollection(babyId, subcollection) {
  if (!babyId) throw new Error("Chưa chọn em bé.");
  return `babies/${babyId}/${subcollection}`;
}

export function createBabyRecord(babyId, subcollection, data) {
  return createDocument(getBabySubcollection(babyId, subcollection), data);
}

export function updateBabyRecord(babyId, subcollection, recordId, data) {
  return updateDocument(getBabySubcollection(babyId, subcollection), recordId, data);
}

export function deleteBabyRecord(babyId, subcollection, recordId) {
  return deleteDocument(getBabySubcollection(babyId, subcollection), recordId);
}

export function newDocumentId(path) {
  return doc(collectionRef(path)).id;
}

export async function runWriteBatch(operations) {
  const { db } = getFirebaseServices();
  const batch = writeBatch(db);
  const state = getState();
  const metadata = metadataForCreate();
  operations.forEach((operation) => {
    const ref = operation.id ? documentRef(operation.path, operation.id) : doc(collectionRef(operation.path));
    if (operation.type === "delete") batch.delete(ref);
    else if (operation.type === "update") batch.update(ref, sanitizeUpdate(operation.data));
    else batch.set(ref, operation.withMetadata === false ? operation.data : { ...operation.data, ...metadata });
  });
  await batch.commit();
  return state;
}

export { Timestamp, serverTimestamp, documentId };

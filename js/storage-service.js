import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";
import { getFirebaseServices } from "./firebase-service.js";
import { getState } from "./app-state.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function sanitizeFilename(name) {
  const extension = String(name || "image.jpg").split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  return `${Date.now()}-${crypto.randomUUID()}.${extension}`;
}

export function validateImageFile(file) {
  if (!(file instanceof File)) return "Chưa chọn file ảnh.";
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return "Chỉ chấp nhận JPG, PNG, WebP hoặc GIF.";
  if (file.size <= 0) return "File ảnh đang trống.";
  if (file.size > MAX_IMAGE_BYTES) return "Ảnh không được lớn hơn 5 MB.";
  return "";
}

export function uploadBabyImage({ babyId, file, folder = "avatar", onProgress }) {
  const validationError = validateImageFile(file);
  if (validationError) return Promise.reject(new Error(validationError));
  const { currentWorkspaceId, currentUser } = getState();
  if (!currentWorkspaceId || !currentUser?.uid) return Promise.reject(new Error("Thiếu workspace hoặc người dùng đăng nhập."));
  const { storage } = getFirebaseServices();
  const storagePath = `workspaces/${currentWorkspaceId}/babies/${babyId}/images/${folder}/${sanitizeFilename(file.name)}`;
  const storageRef = ref(storage, storagePath);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
    customMetadata: {
      workspaceId: currentWorkspaceId,
      babyId,
      uploadedByUid: currentUser.uid
    }
  });
  return new Promise((resolve, reject) => {
    task.on("state_changed", (snapshot) => {
      const percent = snapshot.totalBytes ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) : 0;
      onProgress?.(percent);
    }, reject, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      resolve({ url, storagePath, contentType: file.type, size: file.size });
    });
  });
}

export async function deleteStoredImage(storagePath) {
  if (!storagePath) return;
  const { storage } = getFirebaseServices();
  await deleteObject(ref(storage, storagePath));
}

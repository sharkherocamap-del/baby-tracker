import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getFirebaseServices } from "./firebase-service.js";
import { normalizeEmail, trimText } from "./validators.js";

export const LEGACY_WORKSPACE_ID = "family-default";

function workspaceIdFromMembership(snapshot) {
  return snapshot.ref.parent.parent?.id || null;
}

function slugify(value) {
  return String(value || "gia-dinh")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "gia-dinh";
}

function profilePayload(user) {
  return {
    uid: user.uid,
    email: normalizeEmail(user.email),
    displayName: trimText(user.displayName || user.email, 160),
    photoURL: trimText(user.photoURL || "", 1000),
    active: true,
    updatedAt: serverTimestamp()
  };
}

async function ensureUserProfile(user) {
  const { db } = getFirebaseServices();
  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) {
    await setDoc(ref, { ...profilePayload(user), createdAt: serverTimestamp() });
    return { id: user.uid, ...profilePayload(user) };
  }
  const data = snapshot.data();
  if (data.active === false) throw new Error("Tài khoản người dùng đã bị vô hiệu hóa.");
  await updateDoc(ref, profilePayload(user));
  return { id: snapshot.id, ...data, ...profilePayload(user) };
}

async function claimWorkspaceInvitations(user) {
  const { db } = getFirebaseServices();
  const email = normalizeEmail(user.email);
  const invitesRef = collection(db, "workspaceInvites", email, "memberships");
  const snapshots = await getDocs(query(invitesRef, where("active", "==", true)));
  if (snapshots.empty) return 0;
  let claimed = 0;
  for (const invitation of snapshots.docs) {
    const workspaceId = invitation.id;
    const data = invitation.data();
    if (!data.role || !["admin", "member", "viewer"].includes(data.role)) continue;
    const membershipRef = doc(db, "workspaces", workspaceId, "members", user.uid);
    const membership = await getDoc(membershipRef);
    if (!membership.exists()) {
      const batch = writeBatch(db);
      batch.set(membershipRef, {
        uid: user.uid,
        email,
        displayName: trimText(data.displayName || user.displayName || email, 160),
        role: data.role,
        active: true,
        invitedByUid: data.invitedByUid || "",
        invitedByEmail: data.invitedByEmail || "",
        joinedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      batch.update(invitation.ref, {
        status: "claimed",
        claimedUid: user.uid,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const mirrorRef = doc(db, "workspaces", workspaceId, "invites", email);
      batch.update(mirrorRef, {
        status: "claimed",
        claimedUid: user.uid,
        claimedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await batch.commit();
      claimed += 1;
    }
  }
  return claimed;
}

async function bootstrapLegacyWorkspace(user) {
  const { db } = getFirebaseServices();
  const email = normalizeEmail(user.email);
  const legacyRef = doc(db, "allowedUsers", email);
  const legacySnapshot = await getDoc(legacyRef);
  if (!legacySnapshot.exists()) return false;
  const legacy = legacySnapshot.data();
  if (legacy.active !== true || !["admin", "member"].includes(legacy.role)) return false;

  const workspaceRef = doc(db, "workspaces", LEGACY_WORKSPACE_ID);
  const workspaceSnapshot = await getDoc(workspaceRef);
  if (!workspaceSnapshot.exists() && legacy.role !== "admin") {
    const error = new Error("Admin cũ cần đăng nhập trước để khởi tạo workspace gia đình.");
    error.code = "workspace/admin-bootstrap-required";
    throw error;
  }

  const membershipRef = doc(db, "workspaces", LEGACY_WORKSPACE_ID, "members", user.uid);
  const membershipSnapshot = await getDoc(membershipRef);
  if (membershipSnapshot.exists() && membershipSnapshot.data().active === false) {
    throw new Error("Quyền truy cập workspace của tài khoản đã bị thu hồi.");
  }
  const batch = writeBatch(db);
  if (!workspaceSnapshot.exists()) {
    batch.set(workspaceRef, {
      name: "Gia đình của tôi",
      slug: "gia-dinh-cua-toi",
      active: true,
      ownerUid: user.uid,
      createdByUid: user.uid,
      createdByEmail: email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      legacyMigrationStatus: "pending"
    });
  }
  if (!membershipSnapshot.exists()) {
    batch.set(membershipRef, {
      uid: user.uid,
      email,
      displayName: trimText(legacy.displayName || user.displayName || email, 160),
      role: legacy.role,
      active: true,
      invitedByUid: user.uid,
      invitedByEmail: email,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
  await batch.commit();
  return true;
}

export async function loadUserWorkspaces(user) {
  const { db } = getFirebaseServices();
  const membershipQuery = query(collectionGroup(db, "members"), where("uid", "==", user.uid));
  const snapshots = await getDocs(membershipQuery);
  const entries = [];
  for (const membershipSnapshot of snapshots.docs) {
    const membership = membershipSnapshot.data();
    if (membership.active !== true || !["admin", "member", "viewer"].includes(membership.role)) continue;
    const workspaceId = workspaceIdFromMembership(membershipSnapshot);
    if (!workspaceId) continue;
    const workspaceSnapshot = await getDoc(doc(db, "workspaces", workspaceId));
    if (!workspaceSnapshot.exists() || workspaceSnapshot.data().active !== true) continue;
    entries.push({
      id: workspaceId,
      workspace: { id: workspaceId, ...workspaceSnapshot.data() },
      membership: { id: membershipSnapshot.id, ...membership }
    });
  }
  return entries.sort((a, b) => String(a.workspace.name).localeCompare(String(b.workspace.name), "vi"));
}

export async function resolveWorkspaceAccess(user) {
  if (!user?.uid || !user?.email) return { allowed: false, reason: "Tài khoản Google không cung cấp email hợp lệ." };
  try {
    const profile = await ensureUserProfile(user);
    await claimWorkspaceInvitations(user);
    let workspaces = await loadUserWorkspaces(user);
    if (!workspaces.length) {
      const bootstrapped = await bootstrapLegacyWorkspace(user);
      if (bootstrapped) workspaces = await loadUserWorkspaces(user);
    }
    if (!workspaces.length) {
      return { allowed: false, reason: "Tài khoản chưa được mời vào workspace gia đình nào." };
    }
    return { allowed: true, profile, workspaces, email: normalizeEmail(user.email) };
  } catch (error) {
    console.error(error);
    if (error.code === "workspace/admin-bootstrap-required") return { allowed: false, reason: error.message };
    throw error;
  }
}

export async function createWorkspace(name, user) {
  const { db } = getFirebaseServices();
  const cleanName = trimText(name, 120);
  if (!cleanName) throw new Error("Tên workspace không được để trống.");
  const suffix = crypto.randomUUID().slice(0, 8);
  const workspaceId = `${slugify(cleanName)}-${suffix}`;
  const email = normalizeEmail(user.email);
  const batch = writeBatch(db);
  batch.set(doc(db, "workspaces", workspaceId), {
    name: cleanName,
    slug: slugify(cleanName),
    active: true,
    ownerUid: user.uid,
    createdByUid: user.uid,
    createdByEmail: email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    legacyMigrationStatus: "not-applicable"
  });
  batch.set(doc(db, "workspaces", workspaceId, "members", user.uid), {
    uid: user.uid,
    email,
    displayName: trimText(user.displayName || email, 160),
    role: "admin",
    active: true,
    invitedByUid: user.uid,
    invitedByEmail: email,
    joinedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  await batch.commit();
  return workspaceId;
}

export async function inviteWorkspaceMember(workspaceId, invitation, currentUser) {
  const { db } = getFirebaseServices();
  const email = normalizeEmail(invitation.email);
  const role = invitation.role;
  if (!email || !["admin", "member", "viewer"].includes(role)) throw new Error("Email hoặc vai trò không hợp lệ.");
  if (email === normalizeEmail(currentUser.email)) throw new Error("Bạn đã là thành viên của workspace này.");
  const existingMember = await getDocs(query(collection(db, "workspaces", workspaceId, "members"), where("email", "==", email)));
  if (!existingMember.empty) throw new Error("Email này đã là thành viên của workspace.");
  const payload = {
    workspaceId,
    email,
    displayName: trimText(invitation.displayName || email, 160),
    role,
    active: invitation.active !== false,
    status: "pending",
    invitedByUid: currentUser.uid,
    invitedByEmail: normalizeEmail(currentUser.email),
    invitedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const batch = writeBatch(db);
  batch.set(doc(db, "workspaceInvites", email, "memberships", workspaceId), payload, { merge: true });
  batch.set(doc(db, "workspaces", workspaceId, "invites", email), payload, { merge: true });
  await batch.commit();
}

export async function updateWorkspaceMember(workspaceId, uid, patch) {
  const { db } = getFirebaseServices();
  const safe = {};
  if (patch.role && ["admin", "member", "viewer"].includes(patch.role)) safe.role = patch.role;
  if (typeof patch.active === "boolean") safe.active = patch.active;
  if (patch.displayName !== undefined) safe.displayName = trimText(patch.displayName, 160);
  safe.updatedAt = serverTimestamp();
  await updateDoc(doc(db, "workspaces", workspaceId, "members", uid), safe);
}

export async function listWorkspaceMembers(workspaceId) {
  const { db } = getFirebaseServices();
  const snapshots = await getDocs(collection(db, "workspaces", workspaceId, "members"));
  return snapshots.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listWorkspaceInvites(workspaceId) {
  const { db } = getFirebaseServices();
  const snapshots = await getDocs(collection(db, "workspaces", workspaceId, "invites"));
  return snapshots.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function cancelWorkspaceInvitation(workspaceId, emailValue) {
  const { db } = getFirebaseServices();
  const email = normalizeEmail(emailValue);
  if (!email) throw new Error("Email lời mời không hợp lệ.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "workspaceInvites", email, "memberships", workspaceId));
  batch.delete(doc(db, "workspaces", workspaceId, "invites", email));
  await batch.commit();
}

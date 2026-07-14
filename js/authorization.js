import { resolveWorkspaceAccess } from "./workspace-service.js";

export async function checkAllowedUser(user) {
  return resolveWorkspaceAccess(user);
}

export function isAdmin() {
  return document.documentElement.dataset.role === "admin";
}

import { validateFirebaseConfig } from "./firebase-config.js";
import { initializeFirebase } from "./firebase-service.js";
import { initializeAuthPersistence, observeAuthState, signInWithGooglePopup, signOutCurrentUser } from "./auth.js";
import { checkAllowedUser } from "./authorization.js";
import { getState, resetState, setCurrentWorkspace, setSelectedBaby, setState } from "./app-state.js";
import { getBabiesPath, subscribeToCollection } from "./firestore-service.js";
import { initializeNavigation, destroyNavigation } from "./navigation.js";
import { destroyRouter, initializeRouter, renderCurrentRoute } from "./router.js";
import { friendlyErrorMessage, showToast } from "./toast.js";
import { safeImage } from "./ui.js";

const screens = {
  boot: document.getElementById("boot-screen"),
  config: document.getElementById("config-error-screen"),
  login: document.getElementById("login-screen"),
  access: document.getElementById("access-check-screen"),
  app: document.getElementById("app-shell")
};

let unsubscribeBabies = null;
let authorizationRun = 0;

function showOnly(name) {
  Object.entries(screens).forEach(([key, element]) => element.classList.toggle("hidden", key !== name));
}

function updateUserUi(user, profile, membership) {
  document.getElementById("user-name").textContent = profile.displayName || user.displayName || "Người dùng";
  document.getElementById("user-email").textContent = user.email || "";
  const roleLabels = { admin: "Admin", member: "Member", viewer: "Chỉ xem" };
  document.getElementById("user-role").textContent = roleLabels[membership?.role] || "Thành viên";
  const avatar = document.getElementById("user-avatar");
  safeImage(avatar, user.photoURL, "./assets/images/baby-placeholder.svg");
}

function updateWorkspaceSelector(state = getState()) {
  const selector = document.getElementById("workspace-selector");
  selector.replaceChildren();
  state.workspaces.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.workspace.name;
    option.selected = entry.id === state.currentWorkspaceId;
    selector.append(option);
  });
  selector.disabled = state.workspaces.length <= 1;
}

function updateBabySelector(state = getState()) {
  const selector = document.getElementById("baby-selector");
  selector.replaceChildren();
  if (!state.babies.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Chưa có em bé";
    selector.append(option);
    selector.disabled = true;
    return;
  }
  selector.disabled = false;
  state.babies.forEach((baby) => {
    const option = document.createElement("option");
    option.value = baby.id;
    option.textContent = baby.nickname || baby.name;
    option.selected = baby.id === state.selectedBabyId;
    selector.append(option);
  });
}

function startBabiesListener() {
  unsubscribeBabies?.();
  unsubscribeBabies = null;
  if (!getState().currentWorkspaceId) return;
  unsubscribeBabies = subscribeToCollection(getBabiesPath(), {
    deletedMode: "active",
    orderByField: "name",
    orderDirection: "asc",
    limit: 100
  }, (babies) => {
    const state = getState();
    const previousId = state.selectedBabyId;
    setState({ babies });
    const storedId = localStorage.getItem(`babyTracker.selectedBabyId.${state.currentWorkspaceId}`);
    const nextId = babies.some((baby) => baby.id === previousId)
      ? previousId
      : babies.some((baby) => baby.id === storedId)
        ? storedId
        : babies[0]?.id || null;
    setSelectedBaby(nextId);
    updateBabySelector();
    if (!document.getElementById("app-shell").classList.contains("hidden")) renderCurrentRoute();
  }, (error) => {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể tải danh sách em bé trong workspace."), "error");
  });
}

function applyWorkspace(entry, user, profile) {
  setCurrentWorkspace(entry.id);
  document.documentElement.dataset.role = entry.membership.role;
  updateWorkspaceSelector();
  updateUserUi(user, profile, entry.membership);
  startBabiesListener();
}

function stopAuthenticatedApp() {
  unsubscribeBabies?.();
  unsubscribeBabies = null;
  destroyRouter();
  destroyNavigation();
  document.documentElement.removeAttribute("data-role");
  resetState();
}

async function handleAuthenticatedUser(user) {
  const runId = ++authorizationRun;
  showOnly("access");
  try {
    const result = await checkAllowedUser(user);
    if (runId !== authorizationRun) return;
    if (!result.allowed) {
      showToast(result.reason, "warning", 7500);
      await signOutCurrentUser();
      return;
    }
    const normalizedUser = {
      uid: user.uid,
      email: result.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || ""
    };
    const storedWorkspaceId = localStorage.getItem("babyTracker.currentWorkspaceId");
    const initialEntry = result.workspaces.find((item) => item.id === storedWorkspaceId) || result.workspaces[0];
    setState({ currentUser: normalizedUser, userProfile: result.profile, workspaces: result.workspaces });
    applyWorkspace(initialEntry, user, result.profile);
    showOnly("app");
    initializeNavigation();
    initializeRouter();
  } catch (error) {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể kiểm tra quyền workspace."), "error", 8000);
    try { await signOutCurrentUser(); } catch (signOutError) { console.error(signOutError); }
  }
}

function updateThemeToggleIcon() {
  const icon = document.querySelector("#theme-toggle .material-symbols-rounded");
  if (!icon) return;
  const isDark = document.documentElement.dataset.theme === "dark";
  icon.textContent = isDark ? "light_mode" : "dark_mode";
  document.getElementById("theme-toggle").setAttribute("aria-label", isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối");
}

function initializeTheme() {
  const stored = localStorage.getItem("babyTracker.theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = stored || preferred;
  updateThemeToggleIcon();
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("babyTracker.theme", next);
    updateThemeToggleIcon();
  });
}

function bindStaticEvents() {
  const signInButton = document.getElementById("google-sign-in-button");
  signInButton.addEventListener("click", () => {
    signInButton.disabled = true;
    signInWithGooglePopup().catch((error) => {
      console.error(error);
      showToast(friendlyErrorMessage(error, "Không thể đăng nhập bằng Google."), error?.code === "auth/popup-closed-by-user" ? "warning" : "error");
    }).finally(() => { signInButton.disabled = false; });
  });

  document.getElementById("sign-out-button").addEventListener("click", async () => {
    try { await signOutCurrentUser(); }
    catch (error) { console.error(error); showToast("Không thể đăng xuất. Vui lòng thử lại.", "error"); }
  });

  const menuButton = document.getElementById("user-menu-button");
  const menu = document.getElementById("user-menu");
  menuButton.addEventListener("click", () => {
    const expanded = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!expanded));
    menu.classList.toggle("hidden", expanded);
  });
  document.addEventListener("click", (event) => {
    if (!menu.contains(event.target) && !menuButton.contains(event.target)) {
      menu.classList.add("hidden");
      menuButton.setAttribute("aria-expanded", "false");
    }
  });

  document.getElementById("workspace-selector").addEventListener("change", (event) => {
    const state = getState();
    const entry = state.workspaces.find((item) => item.id === event.target.value);
    if (!entry) return;
    applyWorkspace(entry, state.currentUser, state.userProfile);
    initializeNavigation();
    renderCurrentRoute();
    showToast(`Đã chuyển sang workspace “${entry.workspace.name}”.`, "success");
  });

  document.getElementById("baby-selector").addEventListener("change", (event) => {
    setSelectedBaby(event.target.value);
    renderCurrentRoute();
  });

  window.addEventListener("offline", () => showToast("Bạn đang ngoại tuyến. Một số thao tác có thể chưa thực hiện được.", "warning", 6500));
  window.addEventListener("online", () => showToast("Đã kết nối Internet trở lại.", "success"));
}

async function boot() {
  initializeTheme();
  bindStaticEvents();
  const validation = validateFirebaseConfig();
  if (!validation.valid) {
    console.error("Firebase config chưa hợp lệ. Thiếu:", validation.missingKeys);
    showOnly("config");
    return;
  }
  try {
    initializeFirebase();
    await initializeAuthPersistence();
    observeAuthState((user, authError) => {
      if (authError) {
        console.error(authError);
        showOnly("login");
        showToast(friendlyErrorMessage(authError), "error");
        return;
      }
      if (!user) {
        authorizationRun += 1;
        stopAuthenticatedApp();
        showOnly("login");
        return;
      }
      handleAuthenticatedUser(user);
    });
  } catch (error) {
    console.error(error);
    if (error.code === "app/invalid-config") showOnly("config");
    else {
      document.getElementById("boot-message").textContent = "Không thể khởi tạo ứng dụng. Kiểm tra console để biết chi tiết.";
      showToast(friendlyErrorMessage(error), "error");
    }
  }
}

boot();

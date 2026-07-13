import { validateFirebaseConfig } from "./firebase-config.js";
import { initializeFirebase } from "./firebase-service.js";
import { initializeAuthPersistence, observeAuthState, signInWithGooglePopup, signOutCurrentUser } from "./auth.js";
import { checkAllowedUser } from "./authorization.js";
import { getState, resetState, setSelectedBaby, setState } from "./app-state.js";
import { subscribeToCollection } from "./firestore-service.js";
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

function updateUserUi(user, profile) {
  document.getElementById("user-name").textContent = profile.displayName || user.displayName || "Người dùng";
  document.getElementById("user-email").textContent = user.email || "";
  document.getElementById("user-role").textContent = profile.role === "admin" ? "Admin" : "Member";
  const avatar = document.getElementById("user-avatar");
  safeImage(avatar, user.photoURL, "./assets/images/baby-placeholder.svg");
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
  unsubscribeBabies = subscribeToCollection("babies", { orderByField: "name", orderDirection: "asc", limit: 50 }, (babies) => {
    const previousId = getState().selectedBabyId;
    setState({ babies });
    const storedId = localStorage.getItem("babyTracker.selectedBabyId");
    const nextId = babies.some((baby) => baby.id === previousId) ? previousId : babies.some((baby) => baby.id === storedId) ? storedId : babies[0]?.id || null;
    setSelectedBaby(nextId);
    updateBabySelector();
    if (!document.getElementById("app-shell").classList.contains("hidden")) renderCurrentRoute();
  }, (error) => {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể tải danh sách em bé."), "error");
  });
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
      showToast(result.reason, "warning", 6500);
      await signOutCurrentUser();
      return;
    }
    const normalizedUser = { uid: user.uid, email: result.email, displayName: user.displayName || "", photoURL: user.photoURL || "" };
    setState({ currentUser: normalizedUser, allowedUser: result.profile, currentRole: result.profile.role });
    document.documentElement.dataset.role = result.profile.role;
    updateUserUi(user, result.profile);
    showOnly("app");
    initializeNavigation();
    startBabiesListener();
    initializeRouter();
  } catch (error) {
    console.error(error);
    showToast(friendlyErrorMessage(error, "Không thể kiểm tra quyền truy cập."), "error", 7000);
    try { await signOutCurrentUser(); } catch (signOutError) { console.error(signOutError); }
  }
}

function initializeTheme() {
  const stored = localStorage.getItem("babyTracker.theme");
  const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = stored || preferred;
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("babyTracker.theme", next);
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

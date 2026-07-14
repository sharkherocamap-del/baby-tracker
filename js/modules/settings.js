import { getState } from "../app-state.js";
import { routes } from "../router.js";
import { createDemoData } from "../demo-data.js";
import { migrateLegacyDataToCurrentWorkspace } from "../migration-service.js";
import { createWorkspace } from "../workspace-service.js";
import { closeModal, confirmDialog, openModal } from "../modal.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, statusBadge } from "../ui.js";
import { createIcon, setButtonContent } from "../icons.js";
import { trimText } from "../validators.js";

const featureRoutes = ["growth","vaccinations","medical-visits","feeding","sleep","diapers","symptoms","medications","allergies","milestones","teething","reminders","reports"];
const roleLabels = { admin: "Admin", member: "Thành viên", viewer: "Chỉ xem" };

function workspaceCreateForm() {
  const state = getState();
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });
  const field = createElement("div", { className: "form-field full" });
  const label = createElement("label", { text: "Tên gia đình / workspace *", attrs: { for: "new-workspace-name" } });
  const input = createElement("input", { attrs: { id: "new-workspace-name", type: "text", maxlength: "120", placeholder: "Ví dụ: Gia đình Nguyễn" } });
  const error = createElement("div", { className: "form-error" });
  field.append(label, input, createElement("div", { className: "form-help", text: "Bạn sẽ là admin đầu tiên. Dữ liệu của workspace mới hoàn toàn tách biệt." }), error);
  const actions = createElement("div", { className: "form-actions full" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "submit" } });
  setButtonContent(submit, "add_home", "Tạo workspace");
  cancel.addEventListener("click", closeModal);
  actions.append(cancel, submit);
  form.append(field, actions);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const name = trimText(input.value, 120);
    error.textContent = name ? "" : "Tên workspace không được để trống.";
    if (error.textContent) return;
    submit.disabled = true;
    cancel.disabled = true;
    try {
      const workspaceId = await createWorkspace(name, state.currentUser);
      localStorage.setItem("babyTracker.currentWorkspaceId", workspaceId);
      showToast("Đã tạo workspace. Ứng dụng sẽ tải lại để áp dụng membership mới.", "success", 6000);
      closeModal();
      window.setTimeout(() => window.location.reload(), 800);
    } catch (cause) {
      console.error(cause);
      showToast(friendlyErrorMessage(cause, "Không thể tạo workspace."), "error");
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
  return form;
}

function appendInfoRows(container, rows) {
  const list = createElement("div", { className: "record-fields mt-1" });
  rows.forEach(([label, value]) => {
    const item = createElement("div", { className: "record-field" });
    item.append(createElement("span", { text: label }), createElement("span", { className: "break-word", text: value ?? "—" }));
    list.append(item);
  });
  container.append(list);
}

export function render(container) {
  clearElement(container);
  const state = getState();
  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div");
  intro.append(createElement("h2", { text: "Cài đặt & workspace" }), createElement("p", { className: "muted", text: "Quản lý không gian gia đình, giao diện, công cụ dữ liệu và các chức năng nâng cao." }));
  header.append(intro);
  container.append(header);

  const workspaceCard = createElement("section", { className: "card mb-2 workspace-card" });
  const workspaceHeading = createElement("div", { className: "record-card-header" });
  const workspaceTitle = createElement("div");
  const titleLine = createElement("h3");
  titleLine.append(createIcon("family_restroom", { size: 22 }), document.createTextNode(" Workspace hiện tại"));
  workspaceTitle.append(titleLine, createElement("p", { className: "muted small", text: "Mỗi workspace có hồ sơ bé, thành viên, quyền và ảnh riêng." }));
  workspaceHeading.append(workspaceTitle, statusBadge(roleLabels[state.currentRole] || state.currentRole));
  workspaceCard.append(workspaceHeading);
  appendInfoRows(workspaceCard, [
    ["Tên", state.currentWorkspace?.name],
    ["Workspace ID", state.currentWorkspaceId],
    ["Vai trò của bạn", roleLabels[state.currentRole] || state.currentRole],
    ["Số workspace", String(state.workspaces.length)],
    ["Migration dữ liệu cũ", state.currentWorkspace?.legacyMigrationStatus || "chưa xác định"]
  ]);
  const workspaceActions = createElement("div", { className: "flex flex-wrap gap-1 mt-2" });
  const create = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
  setButtonContent(create, "add_home", "Tạo workspace mới");
  create.addEventListener("click", () => openModal({ title: "Tạo workspace gia đình", content: workspaceCreateForm() }));
  workspaceActions.append(create);
  if (state.currentRole === "admin") {
    const members = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(members, "group", "Thành viên & lời mời");
    members.addEventListener("click", () => { window.location.hash = "#/users"; });
    workspaceActions.append(members);
  }
  workspaceCard.append(workspaceActions);
  container.append(workspaceCard);

  const themeCard = createElement("section", { className: "card mb-2" });
  const themeTitle = createElement("h3");
  themeTitle.append(createIcon("palette", { size: 21 }), document.createTextNode(" Giao diện"));
  themeCard.append(themeTitle);
  const themeActions = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });
  [["light","light_mode","Sáng"],["dark","dark_mode","Tối"],["system","devices","Theo hệ thống"]].forEach(([value,icon,label]) => {
    const button = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(button, icon, label);
    button.addEventListener("click", () => {
      if (value === "system") {
        localStorage.removeItem("babyTracker.theme");
        document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      } else {
        localStorage.setItem("babyTracker.theme", value);
        document.documentElement.dataset.theme = value;
      }
      const themeIcon = document.querySelector("#theme-toggle .material-symbols-rounded");
      if (themeIcon) themeIcon.textContent = document.documentElement.dataset.theme === "dark" ? "light_mode" : "dark_mode";
    });
    themeActions.append(button);
  });
  themeCard.append(themeActions);
  container.append(themeCard);

  const featureCard = createElement("section", { className: "card mb-2" });
  const featureTitle = createElement("h3");
  featureTitle.append(createIcon("apps", { size: 21 }), document.createTextNode(" Tất cả chức năng"));
  featureCard.append(featureTitle);
  const grid = createElement("div", { className: "quick-actions mt-2" });
  featureRoutes.forEach((name) => {
    const route = routes[name];
    const button = createElement("button", { className: "quick-action", attrs: { type: "button" } });
    button.append(createIcon(route.icon, { size: 27, className: "quick-action-icon", filled: true }), createElement("strong", { text: route.title }));
    button.addEventListener("click", () => { window.location.hash = `#/${name}`; });
    grid.append(button);
  });
  featureCard.append(grid);
  container.append(featureCard);

  if (state.currentRole === "admin") {
    const adminCard = createElement("section", { className: "card mb-2" });
    const adminTitle = createElement("h3");
    adminTitle.append(createIcon("admin_panel_settings", { size: 21 }), document.createTextNode(" Công cụ admin"));
    adminCard.append(adminTitle, createElement("p", { className: "muted small mt-1", text: "Các thao tác dưới đây có thể ghi nhiều document. Hãy backup trước khi migration hoặc import." }));
    const buttons = createElement("div", { className: "flex flex-wrap gap-1 mt-1" });

    const demo = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
    setButtonContent(demo, "database", "Tạo/hoàn thiện dữ liệu demo");
    demo.addEventListener("click", async () => {
      demo.disabled = true;
      try { await createDemoData(); } finally { demo.disabled = false; }
    });

    const migration = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(migration, "move_up", "Chuyển dữ liệu MVP cũ vào workspace");
    migration.addEventListener("click", async () => {
      const confirmed = await confirmDialog({
        title: "Migration dữ liệu cũ?",
        message: "Ứng dụng sẽ sao chép dữ liệu từ collection global babies/* sang workspace hiện tại, giữ nguyên ID và không xóa dữ liệu nguồn. Hồ sơ có ID đã tồn tại sẽ được bỏ qua.",
        confirmLabel: "Bắt đầu migration"
      });
      if (!confirmed) return;
      migration.disabled = true;
      try {
        const result = await migrateLegacyDataToCurrentWorkspace({
          onProgress: ({ current, total, name }) => { migration.title = `Đang xử lý ${current}/${total}: ${name}`; }
        });
        showToast(`Migration hoàn tất: ${result.copiedBabies} hồ sơ, ${result.copiedRecords} bản ghi; bỏ qua ${result.skippedBabies} hồ sơ đã tồn tại.`, "success", 10000);
      } catch (cause) {
        console.error(cause);
        showToast(friendlyErrorMessage(cause, "Không thể migration dữ liệu cũ."), "error", 9000);
      } finally {
        migration.disabled = false;
        migration.removeAttribute("title");
      }
    });

    const reports = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
    setButtonContent(reports, "backup", "Backup / nhập JSON");
    reports.addEventListener("click", () => { window.location.hash = "#/reports"; });

    buttons.append(demo, migration, reports);
    adminCard.append(buttons, createElement("p", { className: "medical-note mt-2", text: "Migration chỉ sao chép. Sau khi kiểm tra dữ liệu mới, dữ liệu global cũ vẫn cần được xử lý thủ công theo kế hoạch lưu giữ của gia đình." }));
    container.append(adminCard);
  }

  const about = createElement("section", { className: "card" });
  const aboutTitle = createElement("h3");
  aboutTitle.append(createIcon("info", { size: 21 }), document.createTextNode(" Thông tin kỹ thuật"));
  about.append(aboutTitle);
  appendInfoRows(about, [
    ["Firebase Web SDK", "12.16.0"],
    ["Chart.js", "4.5.1"],
    ["Ảnh", "Firebase Storage · JPG/PNG/WebP/GIF · tối đa 5 MB"],
    ["Phân trang", "Firestore startAfter · 20 bản ghi/trang"],
    ["WHO Growth", "WHO Child Growth Standards 0–5 tuổi · LMS theo ngày"],
    ["Múi giờ hiển thị", "Asia/Ho_Chi_Minh"],
    ["Hosting", "GitHub Pages / static"]
  ]);
  about.append(createElement("p", { className: "medical-note mt-2", text: "Thông tin WHO và dữ liệu trong ứng dụng chỉ dùng để tham khảo, không thay thế đánh giá tăng trưởng hoặc tư vấn của bác sĩ." }));
  container.append(about);
  return () => {};
}

import { getState } from "../app-state.js";
import { getCollectionPage, getWorkspacePath } from "../firestore-service.js";
import { formatDateTime } from "../date-utils.js";
import { closeModal, confirmDialog, openModal } from "../modal.js";
import { friendlyErrorMessage, showToast } from "../toast.js";
import { clearElement, createElement, renderEmptyState, renderErrorState, renderLoading, statusBadge } from "../ui.js";
import { isValidEmail, normalizeEmail, trimText } from "../validators.js";
import { setButtonContent } from "../icons.js";
import { cancelWorkspaceInvitation, inviteWorkspaceMember, updateWorkspaceMember } from "../workspace-service.js";

const roleOptions = [["viewer", "Chỉ xem"], ["member", "Thành viên"], ["admin", "Admin"]];
const roleLabels = { admin: "Admin", member: "Thành viên", viewer: "Chỉ xem" };

function memberForm(record = null, onSaved = null) {
  const state = getState();
  const isSelf = record?.uid === state.currentUser.uid;
  const isOwner = record?.uid === state.currentWorkspace?.ownerUid;
  const isProtected = isSelf || isOwner;
  const form = createElement("form", { className: "form-grid", attrs: { novalidate: "" } });

  const emailField = createElement("div", { className: "form-field full" });
  const emailLabel = createElement("label", { text: "Email Google *", attrs: { for: "member-email" } });
  const email = createElement("input", { attrs: { id: "member-email", type: "email", autocomplete: "off", placeholder: "member@gmail.com" } });
  email.value = record?.email || "";
  email.disabled = Boolean(record);
  const emailError = createElement("div", { className: "form-error" });
  emailField.append(emailLabel, email, emailError);

  const nameField = createElement("div", { className: "form-field" });
  const nameLabel = createElement("label", { text: "Tên hiển thị *", attrs: { for: "member-name" } });
  const name = createElement("input", { attrs: { id: "member-name", type: "text", maxlength: "160" } });
  name.value = record?.displayName || "";
  const nameError = createElement("div", { className: "form-error" });
  nameField.append(nameLabel, name, nameError);

  const roleField = createElement("div", { className: "form-field" });
  const roleLabel = createElement("label", { text: "Vai trò *", attrs: { for: "member-role" } });
  const role = createElement("select", { attrs: { id: "member-role" } });
  roleOptions.forEach(([value, label]) => role.append(createElement("option", { text: label, attrs: { value } })));
  role.value = record?.role || "member";
  role.disabled = isProtected;
  roleField.append(roleLabel, role);

  const activeField = createElement("div", { className: "form-field checkbox-field full" });
  const active = createElement("input", { attrs: { id: "member-active", type: "checkbox" } });
  active.checked = record ? record.active === true : true;
  active.disabled = isProtected;
  activeField.append(active, createElement("label", { text: "Đang hoạt động", attrs: { for: "member-active" } }));
  if (isProtected) activeField.append(createElement("div", { className: "form-help", text: isOwner ? "Chủ sở hữu workspace luôn phải là admin đang hoạt động." : "Không thể tự khóa hoặc tự hạ quyền trong workspace đang dùng." }));

  form.append(emailField, nameField, roleField, activeField);
  const actions = createElement("div", { className: "form-actions full" });
  const cancel = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(cancel, "close", "Hủy");
  const submit = createElement("button", { className: "button button-primary", attrs: { type: "submit" } });
  setButtonContent(submit, record ? "save" : "person_add", record ? "Lưu quyền" : "Tạo lời mời");
  cancel.addEventListener("click", closeModal);
  actions.append(cancel, submit);
  form.append(actions);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const normalized = normalizeEmail(email.value);
    emailError.textContent = isValidEmail(normalized) ? "" : "Email không hợp lệ.";
    nameError.textContent = name.value.trim() ? "" : "Tên hiển thị là bắt buộc.";
    if (emailError.textContent || nameError.textContent) return;
    submit.disabled = true;
    cancel.disabled = true;
    try {
      if (record) {
        await updateWorkspaceMember(state.currentWorkspaceId, record.uid, {
          displayName: trimText(name.value, 160),
          role: role.value,
          active: active.checked
        });
        showToast("Đã cập nhật quyền thành viên.", "success");
      } else {
        await inviteWorkspaceMember(state.currentWorkspaceId, {
          email: normalized,
          displayName: trimText(name.value, 160),
          role: role.value,
          active: active.checked
        }, state.currentUser);
        showToast("Đã tạo lời mời. Quyền được kích hoạt khi người đó đăng nhập đúng email Google.", "success", 7500);
      }
      closeModal();
      await onSaved?.();
    } catch (error) {
      console.error(error);
      showToast(friendlyErrorMessage(error, "Không thể lưu thành viên."), "error");
    } finally {
      submit.disabled = false;
      cancel.disabled = false;
    }
  });
  return form;
}

function memberCard(item, onRefresh) {
  const state = getState();
  const card = createElement("article", { className: "card record-card" });
  const top = createElement("div", { className: "record-card-header" });
  const title = createElement("div");
  title.append(
    createElement("div", { className: "record-card-title", text: item.displayName || item.email }),
    createElement("div", { className: "muted small break-word", text: item.email })
  );
  const badges = createElement("div", { className: "flex gap-1 flex-wrap" });
  badges.append(
    statusBadge(roleLabels[item.role] || item.role),
    statusBadge(item.active ? "Đang hoạt động" : "Đã khóa", item.active ? "success" : "danger")
  );
  top.append(title, badges);
  card.append(top);

  const fields = createElement("div", { className: "record-fields" });
  [["Tham gia", formatDateTime(item.joinedAt || item.createdAt)], ["Người mời", item.invitedByEmail || "—"], ["Cập nhật", formatDateTime(item.updatedAt)]].forEach(([label, value]) => {
    const field = createElement("div", { className: "record-field" });
    field.append(createElement("span", { text: label }), createElement("span", { text: value }));
    fields.append(field);
  });
  card.append(fields);

  const actions = createElement("div", { className: "record-actions" });
  const edit = createElement("button", { className: "button button-secondary", attrs: { type: "button" } });
  setButtonContent(edit, "edit", "Sửa quyền");
  edit.addEventListener("click", () => openModal({ title: "Sửa thành viên", content: memberForm(item, onRefresh) }));
  actions.append(edit);
  if (item.uid !== state.currentUser.uid && item.uid !== state.currentWorkspace?.ownerUid && item.active) {
    const revoke = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
    setButtonContent(revoke, "person_off", "Thu hồi quyền");
    revoke.addEventListener("click", async () => {
      const confirmed = await confirmDialog({
        title: "Thu hồi quyền truy cập?",
        message: `${item.email} sẽ không còn đọc hoặc ghi dữ liệu trong workspace này. Có thể bật lại sau.`,
        confirmLabel: "Thu hồi"
      });
      if (!confirmed) return;
      try {
        await updateWorkspaceMember(state.currentWorkspaceId, item.uid, { active: false });
        showToast("Đã thu hồi quyền workspace.", "success");
        await onRefresh();
      } catch (error) {
        console.error(error);
        showToast(friendlyErrorMessage(error), "error");
      }
    });
    actions.append(revoke);
  }
  card.append(actions);
  return card;
}

function invitationCard(item, onRefresh) {
  const state = getState();
  const card = createElement("article", { className: "card record-card" });
  const top = createElement("div", { className: "record-card-header" });
  const title = createElement("div");
  title.append(
    createElement("div", { className: "record-card-title", text: item.displayName || item.email }),
    createElement("div", { className: "muted small break-word", text: item.email })
  );
  const badges = createElement("div", { className: "flex gap-1 flex-wrap" });
  badges.append(statusBadge(roleLabels[item.role] || item.role), statusBadge(item.status === "claimed" ? "Đã nhận" : "Đang chờ", item.status === "claimed" ? "success" : "warning"));
  top.append(title, badges);
  card.append(top);
  const fields = createElement("div", { className: "record-fields" });
  [["Ngày mời", formatDateTime(item.invitedAt)], ["Người mời", item.invitedByEmail || "—"], ["Trạng thái", item.active === false ? "Vô hiệu hóa" : "Có hiệu lực"]].forEach(([label, value]) => {
    const field = createElement("div", { className: "record-field" });
    field.append(createElement("span", { text: label }), createElement("span", { text: value }));
    fields.append(field);
  });
  card.append(fields);
  if (item.status !== "claimed") {
    const actions = createElement("div", { className: "record-actions" });
    const cancel = createElement("button", { className: "button button-ghost text-danger", attrs: { type: "button" } });
    setButtonContent(cancel, "cancel", "Hủy lời mời");
    cancel.addEventListener("click", async () => {
      const confirmed = await confirmDialog({ title: "Hủy lời mời?", message: `Hủy lời mời dành cho ${item.email}?`, confirmLabel: "Hủy lời mời" });
      if (!confirmed) return;
      try {
        await cancelWorkspaceInvitation(state.currentWorkspaceId, item.email);
        showToast("Đã hủy lời mời.", "success");
        await onRefresh();
      } catch (error) {
        console.error(error);
        showToast(friendlyErrorMessage(error, "Không thể hủy lời mời."), "error");
      }
    });
    actions.append(cancel);
    card.append(actions);
  }
  return card;
}

function createPager({ list, path, orderByField, pageSize = 20, renderCard, empty }) {
  const pagination = createElement("div", { className: "pagination-bar" });
  const previous = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(previous, "chevron_left", "Trang trước");
  const label = createElement("span", { className: "muted small" });
  const next = createElement("button", { className: "button button-ghost", attrs: { type: "button" } });
  setButtonContent(next, "chevron_right", "Trang sau");
  pagination.append(previous, label, next);
  let pages = [];
  let pageIndex = 0;
  let filterTerm = "";

  function draw() {
    const page = pages[pageIndex];
    const records = (page?.items || []).filter((item) => `${item.email || ""} ${item.displayName || ""}`.toLowerCase().includes(filterTerm));
    clearElement(list);
    if (!records.length) renderEmptyState(list, empty);
    else records.forEach((item) => list.append(renderCard(item, refresh)));
    label.textContent = `Trang ${pageIndex + 1} · ${page?.items?.length || 0} mục`;
    previous.disabled = pageIndex === 0;
    next.disabled = !page?.hasMore && pageIndex >= pages.length - 1;
  }

  async function loadPage(index, cursor = null) {
    renderLoading(list);
    try {
      const page = await getCollectionPage(path, { orderByField, orderDirection: "asc", pageSize, startAfterDocument: cursor });
      pages[index] = page;
      pages = pages.slice(0, index + 1);
      pageIndex = index;
      draw();
    } catch (error) {
      console.error(error);
      renderErrorState(list, friendlyErrorMessage(error, "Không thể tải dữ liệu."), refresh);
    }
  }

  async function refresh() {
    pages = [];
    pageIndex = 0;
    await loadPage(0);
  }

  previous.addEventListener("click", () => {
    if (pageIndex > 0) {
      pageIndex -= 1;
      draw();
    }
  });
  next.addEventListener("click", async () => {
    if (pageIndex + 1 < pages.length) {
      pageIndex += 1;
      draw();
      return;
    }
    const page = pages[pageIndex];
    if (page?.hasMore && page.lastDocument) await loadPage(pageIndex + 1, page.lastDocument);
  });

  return {
    pagination,
    refresh,
    setFilter(value) {
      filterTerm = String(value || "").trim().toLowerCase();
      draw();
    }
  };
}

export async function render(container) {
  clearElement(container);
  const state = getState();
  if (state.currentRole !== "admin") {
    renderErrorState(container, "Chỉ admin workspace được quản lý thành viên.");
    return () => {};
  }

  const header = createElement("div", { className: "view-header" });
  const intro = createElement("div");
  intro.append(
    createElement("h2", { text: "Thành viên workspace" }),
    createElement("p", { className: "muted", text: `Quyền chỉ áp dụng trong “${state.currentWorkspace.name}”. Mỗi gia đình có membership riêng.` })
  );
  const add = createElement("button", { className: "button button-primary", attrs: { type: "button" } });
  setButtonContent(add, "person_add", "Mời thành viên");
  header.append(intro, add);
  container.append(header);
  container.append(createElement("p", { className: "medical-note mb-2", text: "Vai trò Chỉ xem không thể thêm, sửa hoặc xóa dữ liệu. Lời mời gắn với email Google và được nhận tự động ở lần đăng nhập tiếp theo." }));

  const search = createElement("input", { attrs: { type: "search", placeholder: "Tìm email hoặc tên trong trang hiện tại…", "aria-label": "Tìm thành viên" } });
  const filter = createElement("div", { className: "filter-bar" });
  filter.append(search);
  container.append(filter);

  const membersSection = createElement("section", { className: "mb-2" });
  membersSection.append(createElement("h3", { text: "Thành viên đã tham gia" }));
  const memberList = createElement("div", { className: "record-list mt-1" });
  const memberPager = createPager({
    list: memberList,
    path: getWorkspacePath("members"),
    orderByField: "email",
    renderCard: memberCard,
    empty: { icon: "group", title: "Chưa có thành viên", message: "Mời thành viên mới vào workspace." }
  });
  membersSection.append(memberList, memberPager.pagination);
  container.append(membersSection);

  const invitationsSection = createElement("section");
  invitationsSection.append(createElement("h3", { text: "Lời mời" }));
  const inviteList = createElement("div", { className: "record-list mt-1" });
  const invitePager = createPager({
    list: inviteList,
    path: getWorkspacePath("invites"),
    orderByField: "email",
    renderCard: invitationCard,
    empty: { icon: "mail", title: "Không có lời mời", message: "Các lời mời đang chờ sẽ xuất hiện tại đây." }
  });
  invitationsSection.append(inviteList, invitePager.pagination);
  container.append(invitationsSection);

  async function refreshAll() {
    await Promise.all([memberPager.refresh(), invitePager.refresh()]);
  }
  add.addEventListener("click", () => openModal({ title: "Mời thành viên", content: memberForm(null, refreshAll) }));
  search.addEventListener("input", () => {
    memberPager.setFilter(search.value);
    invitePager.setFilter(search.value);
  });
  await refreshAll();
  return () => {};
}

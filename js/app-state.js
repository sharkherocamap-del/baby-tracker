const initialState = Object.freeze({
  currentUser: null,
  userProfile: null,
  workspaces: [],
  currentWorkspaceId: null,
  currentWorkspace: null,
  currentMembership: null,
  currentRole: null,
  babies: [],
  selectedBabyId: null,
  selectedBaby: null,
  currentView: "dashboard",
  isLoading: false
});

let state = { ...initialState };
const subscribers = new Set();

export function getState() {
  return { ...state, babies: [...state.babies], workspaces: [...state.workspaces] };
}

export function setState(patch) {
  const nextPatch = typeof patch === "function" ? patch(getState()) : patch;
  state = { ...state, ...nextPatch };
  subscribers.forEach((callback) => {
    try { callback(getState()); } catch (error) { console.error(error); }
  });
}

export function subscribe(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

export function setCurrentWorkspace(workspaceId) {
  const entry = state.workspaces.find((item) => item.id === workspaceId) || null;
  state = {
    ...state,
    currentWorkspaceId: entry?.id || null,
    currentWorkspace: entry?.workspace || null,
    currentMembership: entry?.membership || null,
    currentRole: entry?.membership?.role || null,
    babies: [],
    selectedBabyId: null,
    selectedBaby: null
  };
  if (entry?.id) localStorage.setItem("babyTracker.currentWorkspaceId", entry.id);
  else localStorage.removeItem("babyTracker.currentWorkspaceId");
  localStorage.removeItem("babyTracker.selectedBabyId");
  subscribers.forEach((callback) => callback(getState()));
}

export function setSelectedBaby(babyId) {
  const baby = state.babies.find((item) => item.id === babyId) || null;
  state = { ...state, selectedBabyId: baby?.id || null, selectedBaby: baby };
  const key = state.currentWorkspaceId ? `babyTracker.selectedBabyId.${state.currentWorkspaceId}` : "babyTracker.selectedBabyId";
  if (baby?.id) localStorage.setItem(key, baby.id);
  else localStorage.removeItem(key);
  subscribers.forEach((callback) => callback(getState()));
}

export function resetState() {
  state = { ...initialState };
  subscribers.forEach((callback) => callback(getState()));
}

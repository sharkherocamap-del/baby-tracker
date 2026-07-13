const initialState = Object.freeze({
  currentUser: null,
  allowedUser: null,
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
  return { ...state, babies: [...state.babies] };
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

export function setSelectedBaby(babyId) {
  const baby = state.babies.find((item) => item.id === babyId) || null;
  state = { ...state, selectedBabyId: baby?.id || null, selectedBaby: baby };
  if (baby?.id) localStorage.setItem("babyTracker.selectedBabyId", baby.id);
  else localStorage.removeItem("babyTracker.selectedBabyId");
  subscribers.forEach((callback) => callback(getState()));
}

export function resetState() {
  state = { ...initialState };
  subscribers.forEach((callback) => callback(getState()));
}

import { create } from 'zustand';

interface BranchContextState {
  activeBranchId: string | null;
  activeBranchName: string | null;
  setActiveBranch: (branch: { id: string; name: string } | null) => void;
  clearActiveBranch: () => void;
}

const storageKey = 'adminActiveStoreId';
const nameStorageKey = 'adminActiveStoreName';

export const useBranchContextStore = create<BranchContextState>((set) => ({
  activeBranchId: localStorage.getItem(storageKey),
  activeBranchName: localStorage.getItem(nameStorageKey),
  setActiveBranch: (branch) => {
    if (branch) {
      localStorage.setItem(storageKey, branch.id);
      localStorage.setItem(nameStorageKey, branch.name);
      set({ activeBranchId: branch.id, activeBranchName: branch.name });
      return;
    }

    localStorage.removeItem(storageKey);
    localStorage.removeItem(nameStorageKey);
    set({ activeBranchId: null, activeBranchName: null });
  },
  clearActiveBranch: () => {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(nameStorageKey);
    set({ activeBranchId: null, activeBranchName: null });
  },
}));

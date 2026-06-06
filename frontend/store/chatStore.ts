import { create } from 'zustand';

type ChatStore = {
  currentUserId: string | null;
  setCurrentUserId: (id: string) => void;
};

export const useChatStore = create<ChatStore>((set) => ({
  currentUserId: null,
  setCurrentUserId: (id) => set({ currentUserId: id }),
}));

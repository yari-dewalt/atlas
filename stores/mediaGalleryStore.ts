import { create } from 'zustand';

interface MediaGalleryState {
  activeIndex: number;
  globalVideoMuted: boolean;
}

interface MediaGalleryStore {
  // Map of postId to MediaGalleryState
  postStates: Map<string, MediaGalleryState>;
  
  // Actions
  setActiveIndex: (postId: string, index: number) => void;
  setGlobalVideoMuted: (postId: string, muted: boolean) => void;
  getPostState: (postId: string) => MediaGalleryState;
  clearPostState: (postId: string) => void;
  clearAllStates: () => void;
}

export const useMediaGalleryStore = create<MediaGalleryStore>((set, get) => ({
  postStates: new Map(),
  
  setActiveIndex: (postId: string, index: number) => {
    set((state) => {
      const newStates = new Map(state.postStates);
      const currentState = newStates.get(postId) || { activeIndex: 0, globalVideoMuted: true };
      newStates.set(postId, { ...currentState, activeIndex: index });
      return { postStates: newStates };
    });
  },
  
  setGlobalVideoMuted: (postId: string, muted: boolean) => {
    set((state) => {
      const newStates = new Map(state.postStates);
      const currentState = newStates.get(postId) || { activeIndex: 0, globalVideoMuted: true };
      newStates.set(postId, { ...currentState, globalVideoMuted: muted });
      return { postStates: newStates };
    });
  },
  
  getPostState: (postId: string): MediaGalleryState => {
    const state = get().postStates.get(postId);
    return state || { activeIndex: 0, globalVideoMuted: true };
  },
  
  clearPostState: (postId: string) => {
    set((state) => {
      const newStates = new Map(state.postStates);
      newStates.delete(postId);
      return { postStates: newStates };
    });
  },
  
  clearAllStates: () => {
    set({ postStates: new Map() });
  },
}));

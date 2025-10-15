import { create } from 'zustand';

interface MediaGalleryState {
  activeIndex: number;
}

interface MediaGalleryStore {
  // Map of postId to MediaGalleryState
  postStates: Map<string, MediaGalleryState>;
  
  // Global video mute state (like Instagram)
  globalVideoMuted: boolean;
  
  // Actions
  setActiveIndex: (postId: string, index: number) => void;
  setGlobalVideoMuted: (muted: boolean) => void;
  getPostState: (postId: string) => MediaGalleryState;
  clearPostState: (postId: string) => void;
  clearAllStates: () => void;
}

export const useMediaGalleryStore = create<MediaGalleryStore>((set, get) => ({
  postStates: new Map(),
  globalVideoMuted: true, // Default to muted like Instagram
  
  setActiveIndex: (postId: string, index: number) => {
    set((state) => {
      const newStates = new Map(state.postStates);
      const currentState = newStates.get(postId) || { activeIndex: 0 };
      newStates.set(postId, { ...currentState, activeIndex: index });
      return { postStates: newStates };
    });
  },
  
  setGlobalVideoMuted: (muted: boolean) => {
    set({ globalVideoMuted: muted });
  },
  
  getPostState: (postId: string): MediaGalleryState => {
    const state = get().postStates.get(postId);
    return state || { activeIndex: 0 };
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

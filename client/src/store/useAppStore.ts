import { create } from 'zustand';
import { User, InterviewSession, ResourcePermission, ProctoringEvent } from '../types';

interface AppState {
  currentUser: User | null;
  authToken: string | null;
  currentSession: InterviewSession | null;
  allowlist: ResourcePermission[];
  proctoringEvents: ProctoringEvent[];
  
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  setCurrentSession: (session: InterviewSession | null) => void;
  setAllowlist: (list: ResourcePermission[]) => void;
  addResource: (res: ResourcePermission) => void;
  updateResourceStatus: (id: string, isActive: boolean) => void;
  removeResource: (id: string) => void;
  
  setProctoringEvents: (events: ProctoringEvent[]) => void;
  addProctoringEvent: (event: ProctoringEvent) => void;
}

const savedToken = localStorage.getItem('xprty_auth_token');
const savedUser = localStorage.getItem('xprty_user');

export const useAppStore = create<AppState>((set) => ({
  currentUser: savedUser ? JSON.parse(savedUser) : null,
  authToken: savedToken || null,
  currentSession: null,
  allowlist: [],
  proctoringEvents: [],

  setAuth: (user, token) => {
    if (token && user) {
      localStorage.setItem('xprty_auth_token', token);
      localStorage.setItem('xprty_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('xprty_auth_token');
      localStorage.removeItem('xprty_user');
    }
    set({ currentUser: user, authToken: token });
  },

  logout: () => {
    localStorage.removeItem('xprty_auth_token');
    localStorage.removeItem('xprty_user');
    set({ currentUser: null, authToken: null, currentSession: null });
  },

  setCurrentSession: (session) => set({ currentSession: session }),
  setAllowlist: (allowlist) => set({ allowlist }),
  addResource: (res) => set((state) => ({ allowlist: [...state.allowlist, res] })),
  updateResourceStatus: (id, isActive) => set((state) => ({
    allowlist: state.allowlist.map((r) => (r.id === id ? { ...r, is_active: isActive } : r))
  })),
  removeResource: (id) => set((state) => ({
    allowlist: state.allowlist.filter((r) => r.id !== id)
  })),

  setProctoringEvents: (proctoringEvents) => set({ proctoringEvents }),
  addProctoringEvent: (event) => set((state) => ({
    proctoringEvents: [event, ...state.proctoringEvents]
  }))
}));

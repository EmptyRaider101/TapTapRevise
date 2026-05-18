import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import confetti from 'canvas-confetti';

const API_BASE = 'http://192.168.0.41:5002/api';

export type FileStatus = 'unread' | 'complete' | 'complete-follow-up' | 'need-to-learn';

export interface UploadedFile {
  id: string;
  name: string;
  type: string;
  size: number;
  status: FileStatus;
  content?: string;
  url: string;
  module?: string;
  topic?: string;
  uploadDate: number;
  revisedAt?: number;
}

export interface Note {
  id: string;
  fileId: string;
  content: string;
  updatedAt: number;
}

export type WindowType = 'file-manager' | 'previewer' | 'notes' | 'ai-assistant' | 'stats' | 'settings';

export interface AppWindow {
  id: string;
  type: WindowType;
  title: string;
  isOpen: boolean;
  bounds: { x: string | number; y: string | number; width: string | number; height: string | number };
  zIndex: number;
  props?: any;
}

interface AppState {
  files: UploadedFile[];
  notes: Note[];
  windows: AppWindow[];
  activeFileId: string | null;
  
  // Settings
  osStyle: 'macos' | 'windows';
  viewMode: 'windowed' | 'panel';
  setOSStyle: (style: 'macos' | 'windows') => void;
  setViewMode: (mode: 'windowed' | 'panel') => void;
  // Actions
  init: () => Promise<void>;
  uploadFiles: (files: File[]) => Promise<void>;
  importFolder: (path: string) => Promise<void>;
  updateFileStatus: (id: string, status: FileStatus) => Promise<void>;
  updateFileMetadata: (id: string, topic: string, module: string) => Promise<void>;
  setActiveFile: (id: string | null) => void;
  saveNote: (fileId: string, content: string) => Promise<void>;
  uploadNoteImage: (file: File) => Promise<string>;
  deleteFiles: (ids: string[]) => Promise<void>;
  
  // Window actions
  openWindow: (type: WindowType, props?: any) => void;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  updateWindowBounds: (id: string, bounds: Partial<AppWindow['bounds']>) => void;
  
  // AI Settings
  aiModel: 'gemini-3.1-flash-lite-preview' | 'gemma-4-31b-it';
  setAIModel: (model: 'gemini-3.1-flash-lite-preview' | 'gemma-4-31b-it') => void;

  // Stats Settings
  examDate: number | null;
  dailyGoal: number;
  setExamDate: (date: number | null) => Promise<void>;
  setDailyGoal: (goal: number) => Promise<void>;
  geminiApiKey: string | null;
  setGeminiApiKey: (key: string | null) => Promise<void>;

  // Updates
  latestVersion: string | null;
  updateUrl: string | null;
  checkUpdates: () => Promise<void>;
  triggerUpdate: () => Promise<void>;
}

const DEFAULT_WINDOWS: AppWindow[] = [
  {
    id: 'file-manager-1',
    type: 'file-manager',
    title: 'Files',
    isOpen: true,
    bounds: { x: '2%', y: '5%', width: '25%', height: '75%' },
    zIndex: 1
  },
  {
    id: 'notes-1',
    type: 'notes',
    title: 'Notes',
    isOpen: true,
    bounds: { x: '28%', y: '5%', width: '40%', height: '75%' },
    zIndex: 2
  },
  {
    id: 'ai-assistant-1',
    type: 'ai-assistant',
    title: 'AI Assistant',
    isOpen: true,
    bounds: { x: '69%', y: '5%', width: '28%', height: '75%' },
    zIndex: 3
  }
];

const syncWindows = async (windows: AppWindow[]) => {
  try {
    await axios.post(`${API_BASE}/windows`, windows);
  } catch (e) {
    console.error('Failed to sync windows:', e);
  }
};

export const useStore = create<AppState>((set, get) => ({
  files: [],
  notes: [],
  windows: DEFAULT_WINDOWS,
  activeFileId: null,
  osStyle: 'macos',
  viewMode: 'windowed',
  examDate: null,
  dailyGoal: 5,
  latestVersion: null,
  updateUrl: null,

  setOSStyle: async (osStyle) => {
    set({ osStyle });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'osStyle', value: osStyle });
    } catch (e) {
      console.error('Failed to save osStyle setting:', e);
    }
  },
  setViewMode: async (viewMode) => {
    set({ viewMode });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'viewMode', value: viewMode });
    } catch (e) {
      console.error('Failed to save viewMode setting:', e);
    }
  },
  aiModel: 'gemini-3.1-flash-lite-preview',
  setAIModel: async (aiModel) => {
    set({ aiModel });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'aiModel', value: aiModel });
    } catch (e) {
      console.error('Failed to save aiModel setting:', e);
    }
  },

  init: async () => {
    try {
      const [filesRes, notesRes, windowsRes, settingsRes] = await Promise.all([
        axios.get(`${API_BASE}/files`),
        axios.get(`${API_BASE}/notes`),
        axios.get(`${API_BASE}/windows`),
        axios.get(`${API_BASE}/settings`)
      ]);
      
      const serverWindows = windowsRes.data;
      const serverSettings = settingsRes.data;
      
      set({ 
        files: filesRes.data, 
        notes: notesRes.data,
        windows: serverWindows.length > 0 ? serverWindows : DEFAULT_WINDOWS,
        aiModel: serverSettings.aiModel || 'gemini-3.1-flash-lite-preview',
        osStyle: serverSettings.osStyle || 'macos',
        viewMode: serverSettings.viewMode || 'windowed',
        examDate: serverSettings.examDate ? parseInt(serverSettings.examDate) : null,
        dailyGoal: serverSettings.dailyGoal ? parseInt(serverSettings.dailyGoal) : 5,
        geminiApiKey: serverSettings.geminiApiKey || null
      });
    } catch (e) {
      console.error('Failed to init store:', e);
    }
  },

  uploadFiles: async (files) => {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
      // @ts-ignore
      if (file.webkitRelativePath) {
        // @ts-ignore
        formData.append('paths', file.webkitRelativePath);
      }
    });
    try {
      const res = await axios.post(`${API_BASE}/upload`, formData);
      set(state => ({ files: [...state.files, ...res.data] }));
    } catch (e) {
      console.error('Upload failed:', e);
    }
  },

  importFolder: async (folderPath) => {
    try {
      const res = await axios.post(`${API_BASE}/import-folder`, { folderPath });
      set(state => ({ files: [...state.files, ...res.data] }));
    } catch (e) {
      console.error('Import failed:', e);
    }
  },
  
  updateFileStatus: async (id, status) => {
    const state = get();
    const file = state.files.find(f => f.id === id);
    const wasUnread = file?.status === 'unread';
    const isNowRevised = status !== 'unread';

    try {
      await axios.patch(`${API_BASE}/files/${id}/status`, { status });
      const now = Date.now();
      
      set(state => ({
        files: state.files.map(f => f.id === id ? { 
          ...f, 
          status, 
          revisedAt: (wasUnread && isNowRevised) ? now : f.revisedAt 
        } : f)
      }));

      // Confetti logic
      if (wasUnread && isNowRevised) {
        const updatedFiles = get().files;
        const today = new Date().setHours(0, 0, 0, 0);
        const revisedToday = updatedFiles.filter(f => 
          f.revisedAt && new Date(Number(f.revisedAt)).setHours(0, 0, 0, 0) === today
        ).length;

        if (revisedToday >= state.dailyGoal) {
          // Trigger confetti!
          confetti({
            particleCount: 150,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#22c55e', '#3b82f6', '#eab308']
          });
        }
      }
    } catch (e) {
      console.error('Status update failed:', e);
    }
  },

  updateFileMetadata: async (id, topic, module) => {
    try {
      await axios.patch(`${API_BASE}/files/${id}/metadata`, { topic, module });
      set(state => ({
        files: state.files.map(f => f.id === id ? { ...f, topic, module } : f)
      }));
    } catch (e) {
      console.error('Metadata update failed:', e);
    }
  },
  
  setActiveFile: (id) => set({ activeFileId: id }),
  
  saveNote: async (fileId, content) => {
    try {
      await axios.post(`${API_BASE}/notes`, { fileId, content });
      set(state => {
        const existing = state.notes.find(n => n.fileId === fileId);
        if (existing) {
          return {
            notes: state.notes.map(n => n.id === existing.id ? { ...n, content, updatedAt: Date.now() } : n)
          };
        }
        return {
          notes: [...state.notes, { id: uuidv4(), fileId, content, updatedAt: Date.now() }]
        };
      });
    } catch (e) {
      console.error('Save note failed:', e);
    }
  },

  uploadNoteImage: async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await axios.post(`${API_BASE}/upload-image`, formData);
      return res.data.url;
    } catch (e) {
      console.error('Image upload failed:', e);
      throw e;
    }
  },
  
  deleteFiles: async (ids) => {
    try {
      await axios.delete(`${API_BASE}/files`, { data: { ids } });
      set(state => ({
        files: state.files.filter(f => !ids.includes(f.id)),
        activeFileId: state.activeFileId && ids.includes(state.activeFileId) ? null : state.activeFileId
      }));
    } catch (e) {
      console.error('Delete files failed:', e);
    }
  },
  
  openWindow: (type, props) => {
    set((state) => {
      const existing = state.windows.find(w => w.type === type);
      const maxZ = Math.max(0, ...state.windows.map(w => w.zIndex));
      let nextWindows;
      
      if (existing) {
        nextWindows = state.windows.map(w => 
          w.id === existing.id ? { ...w, isOpen: true, zIndex: maxZ + 1, props: { ...w.props, ...props } } : w
        );
      } else {
        const newWindow: AppWindow = {
          id: uuidv4(),
          type,
          title: type.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
          isOpen: true,
          bounds: { x: '10%', y: '10%', width: '40%', height: '60%' },
          zIndex: maxZ + 1,
          props
        };
        nextWindows = [...state.windows, newWindow];
      }
      
      syncWindows(nextWindows);
      return { windows: nextWindows };
    });
  },
  
  closeWindow: (id) => {
    set((state) => {
      const nextWindows = state.windows.map(w => w.id === id ? { ...w, isOpen: false } : w);
      syncWindows(nextWindows);
      return { windows: nextWindows };
    });
  },
  
  focusWindow: (id) => {
    set((state) => {
      const maxZ = Math.max(0, ...state.windows.map(w => w.zIndex));
      const nextWindows = state.windows.map(w => w.id === id ? { ...w, zIndex: maxZ + 1 } : w);
      syncWindows(nextWindows);
      return { windows: nextWindows };
    });
  },
  
  updateWindowBounds: (id, bounds) => {
    set((state) => {
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      
      const currentWindow = state.windows.find(w => w.id === id);
      if (!currentWindow) return state;

      const newBounds = { ...currentWindow.bounds };
      
      const toPct = (val: string | number | undefined, base: number) => {
        if (val === undefined) return undefined;
        if (typeof val === 'string' && val.endsWith('%')) return val;
        const num = typeof val === 'number' ? val : parseFloat(val);
        return `${(num / base) * 100}%`;
      };

      if (bounds.x !== undefined) {
        const res = toPct(bounds.x, windowWidth);
        if (res) newBounds.x = res;
      }
      if (bounds.y !== undefined) {
        const res = toPct(bounds.y, windowHeight);
        if (res) newBounds.y = res;
      }
      if (bounds.width !== undefined) {
        const res = toPct(bounds.width, windowWidth);
        if (res) newBounds.width = res;
      }
      if (bounds.height !== undefined) {
        const res = toPct(bounds.height, windowHeight);
        if (res) newBounds.height = res;
      }

      const nextWindows = state.windows.map(w => w.id === id ? { ...w, bounds: newBounds } : w);
      syncWindows(nextWindows);
      return { windows: nextWindows };
    });
  },

  setExamDate: async (examDate) => {
    set({ examDate });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'examDate', value: examDate?.toString() || '' });
    } catch (e) {
      console.error('Failed to save examDate:', e);
    }
  },

  setDailyGoal: async (dailyGoal) => {
    set({ dailyGoal });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'dailyGoal', value: dailyGoal.toString() });
    } catch (e) {
      console.error('Failed to save dailyGoal:', e);
    }
  },

  geminiApiKey: null,
  setGeminiApiKey: async (key: string | null) => {
    set({ geminiApiKey: key });
    try {
      await axios.post(`${API_BASE}/settings`, { key: 'geminiApiKey', value: key || '' });
    } catch (e) {
      console.error('Failed to save geminiApiKey:', e);
    }
  },

  checkUpdates: async () => {
    try {
      const res = await axios.get(`${API_BASE}/check-updates`);
      set({ latestVersion: res.data.version, updateUrl: res.data.url });
    } catch (e) {
      console.error('Check updates failed:', e);
    }
  },

  triggerUpdate: async () => {
    try {
      const res = await axios.post(`${API_BASE}/update`);
      alert(res.data.message);
    } catch (e) {
      console.error('Update trigger failed:', e);
    }
  }
}));

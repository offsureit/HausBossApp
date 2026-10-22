import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
  /** ms; 0 = sticky until dismissed. */
  duration: number;
  action?: { label: string; onPress: () => void };
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id' | 'duration'> & { duration?: number }) => string;
  dismiss: (id: string) => void;
}

let seq = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = `t${++seq}`;
    const duration = toast.duration ?? (toast.tone === 'error' ? 6000 : 3500);
    set((s) => ({ toasts: [...s.toasts.slice(-2), { ...toast, id, duration }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

type Options = { description?: string; duration?: number; action?: ToastItem['action'] };
const make = (tone: ToastTone) => (title: string, options: Options = {}) => useToastStore.getState().push({ tone, title, ...options });

/** Imperative API, like the web `toast` from sonner. */
export const toast = {
  info: make('info'),
  success: make('success'),
  warning: make('warning'),
  error: make('error'),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};

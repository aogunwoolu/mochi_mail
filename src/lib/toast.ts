
export type ToastVariant = "success" | "error" | "info";

export type ToastIcon =
  | "check" | "save" | "sparkle" | "warning" | "store" | "star"
  | "wave" | "mail" | "image" | "undo" | "redo" | "clear" | "pen"
  | "eraser" | "type" | "cursor" | "sticker" | "ribbon";

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
  icon?: ToastIcon;
};

type Listener = (toasts: ToastItem[]) => void;

let _toasts: ToastItem[] = [];
const _listeners = new Set<Listener>();

function _notify() {
  _listeners.forEach((fn) => fn([..._toasts]));
}

export function toast(
  message: string,
  opts?: { variant?: ToastVariant; icon?: ToastIcon; duration?: number },
) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const item: ToastItem = {
    id,
    message,
    variant: opts?.variant ?? "success",
    icon: opts?.icon,
  };
  _toasts = [..._toasts, item];
  _notify();
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _notify();
  }, opts?.duration ?? 2600);
}

export function subscribeToast(fn: Listener): () => void {
  _listeners.add(fn);
  fn([..._toasts]);
  return () => void _listeners.delete(fn);
}

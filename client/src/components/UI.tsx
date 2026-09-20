import { useEffect, useRef, type ReactNode } from "react";
import { X, LoaderCircle, Sparkles, AlertCircle } from "lucide-react";
export function Orb({ large = false }: { large?: boolean }) {
  return (
    <span className={`orb ${large ? "orb-large" : ""}`} aria-hidden="true">
      <Sparkles size={large ? 35 : 12} strokeWidth={1.5} />
    </span>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="assistant-message">
      <Orb />
      <span>{children}</span>
    </p>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function Loading({
  label = "Loading your workspace…",
}: {
  label?: string;
}) {
  return (
    <div className="page-state" role="status">
      <LoaderCircle className="spin" size={25} />
      <p>{label}</p>
    </div>
  );
}
export function PageError({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="page-state">
      <ErrorNotice message={message} />
      <button className="btn" onClick={retry}>
        Try again
      </button>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      aria-labelledby="modal-title"
    >
      <header>
        <h2 id="modal-title">{title}</h2>
        <button
          className="icon-btn"
          aria-label="Close dialog"
          disabled={busy}
          onClick={onClose}
        >
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}

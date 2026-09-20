import { useRef, type FormEvent } from "react";
import { ArrowRight, Paperclip, X, FileText } from "lucide-react";
import { validateFile } from "../lib/files";
export default function Composer({
  value,
  onChange,
  onSubmit,
  file,
  onFile,
  onError,
  busy = false,
  placeholder = "What would you like to do today?",
  maxLength = 50000,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  file?: File | null;
  onFile?: (file: File | null) => void;
  onError?: (error: string) => void;
  busy?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (!busy && (value.trim() || file)) onSubmit();
  }
  return (
    <form className="composer" onSubmit={submit}>
      <label className="sr-only" htmlFor="requirement-prompt">
        Software requirement
      </label>
      <textarea
        id="requirement-prompt"
        placeholder={placeholder}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            if (!busy && (value.trim() || file)) onSubmit();
          }
        }}
      />
      {file && (
        <div className="file-chip">
          <FileText size={15} />
          <span>{file.name}</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Remove attachment"
            disabled={busy}
            onClick={() => {
              onFile?.(null);
              if (ref.current) ref.current.value = "";
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
      <div className="composer-tools">
        <div>
          {onFile && (
            <>
              <input
                ref={ref}
                type="file"
                accept=".pdf,.txt"
                className="sr-only"
                tabIndex={-1}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    const error = validateFile(f);
                    onError?.(error);
                    if (!error) onFile(f);
                  }
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                className="attachment-button"
                disabled={busy}
                onClick={() => ref.current?.click()}
              >
                <Paperclip size={12} /> Attachment
              </button>
            </>
          )}
          <span className="composer-hint">Ctrl + Enter to continue</span>
        </div>
        <button
          className="send-button"
          type="submit"
          aria-label="Continue"
          disabled={busy || (!value.trim() && !file)}
        >
          <ArrowRight size={16} />
        </button>
      </div>
    </form>
  );
}

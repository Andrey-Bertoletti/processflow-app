import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type BaseProps = {
  label?: string;
  hint?: string;
  className?: string;
};

export function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-2">
      <label className="app-label">{label}</label>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement>;
export function TextField({ label, hint, className = "", ...props }: InputProps) {
  return (
    <label className="block">
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <input className={`app-input ${className}`.trim()} {...props} />
    </label>
  );
}

type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement>;
export function SelectField({ label, hint, className = "", ...props }: SelectProps) {
  return (
    <label className="block">
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <select className={`app-select ${className}`.trim()} {...props} />
    </label>
  );
}

type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>;
export function TextareaField({ label, hint, className = "", ...props }: TextareaProps) {
  return (
    <label className="block">
      {label ? <FieldLabel label={label} hint={hint} /> : null}
      <textarea className={`app-textarea ${className}`.trim()} {...props} />
    </label>
  );
}

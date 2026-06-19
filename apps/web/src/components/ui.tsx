import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "secondary" | "ghost";
};

export function Button({ className, variant = "secondary", type = "button", ...props }: ButtonProps) {
  return <button className={[variant === "ghost" ? "ghost" : "", className].filter(Boolean).join(" ")} type={type} {...props} />;
}

type FieldProps = {
  label: string;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
};

export function Field({ label, inputProps }: FieldProps) {
  return (
    <label>
      {label}
      <input {...inputProps} />
    </label>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="tag">{children}</span>;
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={["module-section", className].filter(Boolean).join(" ")}>{children}</section>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="muted">{children}</p>;
}

export function InlineNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  return <p className={`notice ${tone === "error" ? "error" : ""}`}>{children}</p>;
}

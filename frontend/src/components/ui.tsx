import type { FieldDef } from "../types";

export const STATE_STYLES: Record<string, string> = {
  todo: "bg-zinc-800 text-zinc-400 border-zinc-700",
  in_progress: "bg-violet-500/15 text-violet-300 border-violet-500/40",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  blocked: "bg-red-500/15 text-red-300 border-red-500/40",
  na: "bg-zinc-900 text-zinc-600 border-zinc-800",
};

export const STATE_LABELS: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
  blocked: "Blocked",
  na: "N/A",
};

export function StageBadge({ label, state }: { label: string; state: string }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.todo;
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${style}`}
      title={STATE_LABELS[state] ?? state}
    >
      {label}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  type = "button",
  disabled,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const styles: Record<string, string> = {
    default:
      "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700",
    primary:
      "bg-violet-600 hover:bg-violet-500 text-white border border-violet-500",
    danger:
      "bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/40",
    ghost: "bg-transparent hover:bg-zinc-800 text-zinc-400 border border-transparent",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

const inputClass =
  "w-full rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm text-zinc-200 focus:border-violet-500 focus:outline-none";

/** Renders the right input for a field definition's type. */
export function FieldInput({
  def,
  value,
  onChange,
}: {
  def: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (def.type) {
    case "bool":
      return (
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 accent-violet-500"
          />
          <span className="text-sm text-zinc-400">
            {value ? "yes" : "no"}
          </span>
        </label>
      );
    case "number":
      return (
        <input
          type="number"
          className={inputClass}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      );
    case "date":
      return (
        <input
          type="date"
          className={inputClass}
          value={value ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
    case "enum":
      return (
        <select
          className={inputClass}
          value={value ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || null)}
        >
          <option value="">—</option>
          {(def.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <input
          type="text"
          className={inputClass}
          value={value ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
  }
}

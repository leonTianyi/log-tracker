import { useEffect, useState } from "react";
import { api } from "../api";
import type { FieldDef } from "../types";
import { Button } from "./ui";

const TYPES = ["text", "number", "bool", "enum", "date"];
const CATEGORIES = ["metadata", "amendment"];

function AddFieldForm({ onAdded }: { onAdded: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [category, setCategory] = useState("metadata");
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (!key.trim() || !label.trim()) {
      setError("Key and label are both required.");
      return;
    }
    setBusy(true);
    try {
      await api.createField({
        key: key.trim(),
        label: label.trim(),
        type,
        category,
        options:
          type === "enum"
            ? optionsText
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : null,
      });
      setKey("");
      setLabel("");
      setType("text");
      setCategory("metadata");
      setOptionsText("");
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-sm focus:border-violet-500 focus:outline-none";

  return (
    <div className="space-y-3 rounded border border-zinc-800 bg-zinc-900/40 p-4">
      <h3 className="text-sm font-medium text-zinc-300">Add a field</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Key (stored name, no spaces)
          </label>
          <input
            className={`w-full font-mono ${inputClass}`}
            placeholder="disable_sa_filter"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">
            Label (what people see)
          </label>
          <input
            className={`w-full ${inputClass}`}
            placeholder="Disable site-aware filter"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Type</label>
          <select
            className={`w-full ${inputClass}`}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-500">Category</label>
          <select
            className={`w-full ${inputClass}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        {type === "enum" && (
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-zinc-500">
              Options (comma-separated)
            </label>
            <input
              className={`w-full ${inputClass}`}
              placeholder="clear, rain, snow, fog"
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
            />
          </div>
        )}
        {type === "date" && (
          <div className="sm:col-span-2 text-xs text-zinc-500">
            A calendar date in <span className="font-mono">YYYY-MM-DD</span> form
            (e.g. a "date confirmed"). Not for a month token like{" "}
            <span className="font-mono">2026.06</span> — use <span className="font-mono">text</span> for that.
          </div>
        )}
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Button variant="primary" onClick={submit} disabled={busy}>
        {busy ? "Adding…" : "Add field"}
      </Button>
    </div>
  );
}

function FieldGroup({
  title,
  fields,
  onDelete,
}: {
  title: string;
  fields: FieldDef[];
  onDelete: (id: number) => void;
}) {
  if (fields.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="overflow-hidden rounded border border-zinc-800">
        <table className="w-full table-fixed text-sm">
          <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="w-[28%] px-4 py-2 font-medium">Key</th>
              <th className="w-[34%] px-4 py-2 font-medium">Label</th>
              <th className="w-[26%] px-4 py-2 font-medium">Type</th>
              <th className="w-[12%] px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.id} className="border-t border-zinc-800 align-top">
                <td className="break-all px-4 py-2 font-mono text-zinc-300">
                  {f.key}
                </td>
                <td className="break-words px-4 py-2 text-zinc-300">{f.label}</td>
                <td className="break-words px-4 py-2 text-zinc-500">
                  {f.type}
                  {f.type === "enum" && f.options
                    ? ` (${f.options.join(", ")})`
                    : ""}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button variant="danger" onClick={() => onDelete(f.id)}>
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function FieldsView() {
  const [fields, setFields] = useState<FieldDef[]>([]);

  function load() {
    api.listFields().then(setFields);
  }
  useEffect(load, []);

  async function remove(id: number) {
    await api.deleteField(id);
    load();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg text-zinc-100">Fields</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Amendment flags feed the batch CSV later; metadata is everything else
          you want to record per log. Add or retire them here — no code changes.
        </p>
      </div>
      <AddFieldForm onAdded={load} />
      <FieldGroup
        title="Amendment flags"
        fields={fields.filter((f) => f.category === "amendment")}
        onDelete={remove}
      />
      <FieldGroup
        title="Metadata"
        fields={fields.filter((f) => f.category === "metadata")}
        onDelete={remove}
      />
    </div>
  );
}

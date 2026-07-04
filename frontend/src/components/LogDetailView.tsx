import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import type { FieldDef, LogDetail } from "../types";
import { STAGE_STATES } from "../stages";
import { Button, FieldInput, STATE_LABELS } from "./ui";

function PathRow({ kind, bucket, uri }: { kind: string; bucket: string; uri: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-zinc-800 py-2">
      <span
        className={`mt-0.5 shrink-0 rounded border px-1.5 py-0.5 text-xs ${
          kind === "primary"
            ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
            : "border-zinc-700 bg-zinc-800 text-zinc-400"
        }`}
      >
        {kind}
      </span>
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{bucket}</div>
        <div className="break-all font-mono text-xs text-zinc-300">{uri}</div>
      </div>
    </div>
  );
}

export default function LogDetailView({
  logId,
  onBack,
}: {
  logId: number;
  onBack: () => void;
}) {
  const [detail, setDetail] = useState<LogDetail | null>(null);
  const [fields, setFields] = useState<FieldDef[]>([]);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function load() {
    Promise.all([api.getLog(logId), api.listFields()]).then(([d, f]) => {
      setDetail(d);
      setDraft({ ...d.field_values });
      setFields(f.filter((x) => x.active));
    });
  }

  useEffect(load, [logId]);

  const amendmentFields = useMemo(
    () => fields.filter((f) => f.category === "amendment"),
    [fields],
  );
  const metadataFields = useMemo(
    () => fields.filter((f) => f.category === "metadata"),
    [fields],
  );

  if (!detail) return <p className="text-sm text-zinc-500">Loading…</p>;

  async function changeStage(stage: string, state: string) {
    setMessage(null);
    try {
      const updated = await api.setStage(logId, stage, state);
      setDetail(updated);
    } catch (err) {
      setMessage((err as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api.updateLog(logId, draft);
      setDetail(updated);
      setDraft({ ...updated.field_values });
      setMessage("Saved.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(detail.field_values);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          ← Back
        </Button>
        <h2 className="font-mono text-lg text-zinc-100">{detail.natural_key}</h2>
      </div>

      {message && (
        <div className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
          {message}
        </div>
      )}

      {detail.warnings.length > 0 && (
        <div className="space-y-2 rounded border border-amber-500/40 bg-amber-500/10 p-3">
          {detail.warnings.map((w, i) => (
            <div key={i} className="text-sm text-amber-200">
              {w.message}
            </div>
          ))}
        </div>
      )}

      <section>
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          S3 paths
        </h3>
        <div>
          {detail.paths.map((p) => (
            <PathRow key={p.id} kind={p.kind} bucket={p.bucket} uri={p.uri} />
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
          Triage checklist
        </h3>
        <div className="space-y-1">
          {detail.stage_detail.map((s) => (
            <div
              key={s.stage}
              className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2"
            >
              <div>
                <div className="text-sm text-zinc-200">{s.label}</div>
                {s.done_at && (
                  <div className="text-xs text-zinc-500">
                    {s.done_by ? `${s.done_by} · ` : ""}
                    {new Date(s.done_at).toLocaleString()}
                  </div>
                )}
              </div>
              <select
                value={s.state}
                onChange={(e) => changeStage(s.stage, e.target.value)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm focus:border-violet-500 focus:outline-none"
              >
                {STAGE_STATES.map((st) => (
                  <option key={st} value={st}>
                    {STATE_LABELS[st] ?? st}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {amendmentFields.length > 0 && (
        <FieldSection
          title="Amendment flags"
          fields={amendmentFields}
          draft={draft}
          setDraft={setDraft}
        />
      )}
      {metadataFields.length > 0 && (
        <FieldSection
          title="Metadata"
          fields={metadataFields}
          draft={draft}
          setDraft={setDraft}
        />
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        {dirty && <span className="text-xs text-zinc-500">unsaved changes</span>}
      </div>
    </div>
  );
}

function FieldSection({
  title,
  fields,
  draft,
  setDraft,
}: {
  title: string;
  fields: FieldDef[];
  draft: Record<string, unknown>;
  setDraft: (d: Record<string, unknown>) => void;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {title}
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.id}>
            <label className="mb-1 block text-sm text-zinc-400">{f.label}</label>
            <FieldInput
              def={f}
              value={draft[f.key]}
              onChange={(v) => setDraft({ ...draft, [f.key]: v })}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

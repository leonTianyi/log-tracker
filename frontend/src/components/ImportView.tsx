import { useState } from "react";
import { api } from "../api";
import type { FlagLoadResult, ImportResult } from "../types";
import { Button } from "./ui";

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <div className={`text-2xl font-semibold ${tone ?? "text-zinc-100"}`}>
        {value}
      </div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
}

export default function ImportView() {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [flagResult, setFlagResult] = useState<FlagLoadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "import" | "flags">(null);

  function reset() {
    setImportResult(null);
    setFlagResult(null);
    setError(null);
  }

  async function runImport() {
    if (!file) return;
    setBusy("import");
    reset();
    try {
      setImportResult(await api.importCsv(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runFlags() {
    if (!file) return;
    setBusy("flags");
    reset();
    try {
      setFlagResult(await api.loadAmendmentFlags(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg text-zinc-100">Import a CSV</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Pick your CSV once, then choose an action.{" "}
          <span className="text-zinc-400">Import logs</span> matches on the log
          key (date + name), so re-importing changes nothing and rows whose two
          buckets disagree get flagged, never merged.{" "}
          <span className="text-zinc-400">Load amendment flags</span> reads the
          columns whose headers match your defined amendment-flag keys and writes
          those values onto logs that already exist.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            reset();
          }}
          className="block text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200 hover:file:bg-zinc-700"
        />
        <Button variant="primary" onClick={runImport} disabled={!file || busy !== null}>
          {busy === "import" ? "Importing…" : "Import logs"}
        </Button>
        <Button onClick={runFlags} disabled={!file || busy !== null}>
          {busy === "flags" ? "Loading…" : "Load amendment flags"}
        </Button>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {importResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows read" value={importResult.rows_total} />
            <Stat label="Created" value={importResult.logs_created} tone="text-emerald-400" />
            <Stat label="Matched" value={importResult.logs_matched} tone="text-violet-300" />
            <Stat label="Paths added" value={importResult.paths_added} />
          </div>

          {importResult.flagged.length > 0 ? (
            <div className="rounded border border-amber-500/40">
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                {importResult.flagged.length} row(s) need your eyes — nothing was merged
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">Reason</th>
                    <th className="px-4 py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {importResult.flagged.map((f, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-4 py-2 font-mono text-zinc-400">{f.row_number}</td>
                      <td className="px-4 py-2 text-zinc-300">{f.reason}</td>
                      <td className="px-4 py-2 break-all font-mono text-xs text-zinc-500">
                        {f.detail}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Clean import — no rows flagged.
            </div>
          )}
        </div>
      )}

      {flagResult && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows read" value={flagResult.rows_total} />
            <Stat label="Logs updated" value={flagResult.logs_updated} tone="text-violet-300" />
            <Stat label="Values set" value={flagResult.values_set} tone="text-emerald-400" />
            <Stat label="Unmatched rows" value={flagResult.unmatched_rows} />
          </div>

          <div className="rounded border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm">
            <div className="text-zinc-400">
              Columns loaded:{" "}
              {flagResult.columns_matched.length > 0 ? (
                <span className="font-mono text-zinc-200">
                  {flagResult.columns_matched.join(", ")}
                </span>
              ) : (
                <span className="text-zinc-500">none matched</span>
              )}
            </div>
            {flagResult.columns_missing.length > 0 && (
              <div className="mt-1 text-zinc-500">
                Amendment fields with no column in this CSV:{" "}
                <span className="font-mono">{flagResult.columns_missing.join(", ")}</span>
              </div>
            )}
            {flagResult.unmatched_rows > 0 && (
              <div className="mt-1 text-amber-300/80">
                {flagResult.unmatched_rows} row(s) had no matching log — import those logs first.
              </div>
            )}
          </div>

          {flagResult.errors.length > 0 && (
            <div className="rounded border border-red-500/40">
              <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
                {flagResult.errors.length} value(s) didn't fit their field type — check for a wrong type
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Row</th>
                    <th className="px-4 py-2 font-medium">Column</th>
                    <th className="px-4 py-2 font-medium">Value</th>
                    <th className="px-4 py-2 font-medium">Problem</th>
                  </tr>
                </thead>
                <tbody>
                  {flagResult.errors.map((e, i) => (
                    <tr key={i} className="border-t border-zinc-800 align-top">
                      <td className="px-4 py-2 font-mono text-zinc-400">{e.row_number}</td>
                      <td className="px-4 py-2 font-mono text-zinc-300">{e.column}</td>
                      <td className="px-4 py-2 break-all font-mono text-xs text-zinc-400">
                        {e.value}
                      </td>
                      <td className="px-4 py-2 text-zinc-300">{e.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {flagResult.errors.length === 0 && flagResult.columns_matched.length > 0 && (
            <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
              Clean load — every value fit its field type.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

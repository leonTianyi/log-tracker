import { useState } from "react";
import { api } from "../api";
import type { ImportResult } from "../types";
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
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await api.importCsv(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg text-zinc-100">Import a CSV</h2>
        <p className="mt-1 text-sm text-zinc-500">
          One row per log. The importer matches on the log key (date + name), so
          re-importing the same file changes nothing, and rows whose two buckets
          disagree get flagged instead of merged.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-200 hover:file:bg-zinc-700"
        />
        <Button variant="primary" onClick={run} disabled={!file || busy}>
          {busy ? "Importing…" : "Import"}
        </Button>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Rows read" value={result.rows_total} />
            <Stat label="Created" value={result.logs_created} tone="text-emerald-400" />
            <Stat label="Matched" value={result.logs_matched} tone="text-violet-300" />
            <Stat label="Paths added" value={result.paths_added} />
          </div>

          {result.flagged.length > 0 ? (
            <div className="rounded border border-amber-500/40">
              <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                {result.flagged.length} row(s) need your eyes — nothing was merged
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
                  {result.flagged.map((f, i) => (
                    <tr key={i} className="border-t border-zinc-800">
                      <td className="px-4 py-2 font-mono text-zinc-400">
                        {f.row_number}
                      </td>
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
    </div>
  );
}

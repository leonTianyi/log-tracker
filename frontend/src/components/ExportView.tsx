import { useEffect, useState } from "react";
import { api, EXPORT_URL } from "../api";
import type { ExportPreview } from "../types";

export default function ExportView() {
  const [preview, setPreview] = useState<ExportPreview | null>(null);

  useEffect(() => {
    api.exportPreview().then(setPreview);
  }, []);

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h2 className="text-lg text-zinc-100">Export amendment CSV</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Breathes out a fresh CSV in the shape your batch pipeline reads — the
          two path columns, then every amendment flag you've defined, in order.
          It's a new timestamped file built from the current state of the
          database; your team's source CSV is never touched.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold text-zinc-100">
            {preview ? preview.log_count : "…"}
          </span>
          <span className="text-sm text-zinc-500">
            log{preview && preview.log_count === 1 ? "" : "s"} will be exported
            (all of them)
          </span>
        </div>

        {preview && (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
              Columns
            </div>
            <div className="flex flex-wrap gap-1.5">
              {preview.columns.map((c) => {
                const isFlag = preview.flag_columns.includes(c);
                return (
                  <span
                    key={c}
                    className={`rounded border px-2 py-0.5 font-mono text-xs ${
                      isFlag
                        ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                        : "border-zinc-700 bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {c}
                  </span>
                );
              })}
            </div>
            {preview.flag_columns.length === 0 && (
              <p className="mt-2 text-xs text-amber-300/80">
                No amendment fields defined yet — the export will contain only the
                path columns. Add amendment flags in the Fields tab first.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded border border-zinc-800 bg-zinc-900/30 px-4 py-3 text-xs text-zinc-500">
        Booleans export as <span className="font-mono text-zinc-300">1</span> /{" "}
        <span className="font-mono text-zinc-300">0</span>. A flag that was
        imported keeps its value; a flag never set (never in the source, never
        edited) exports blank.
      </div>

      <a
        href={EXPORT_URL}
        download
        className="inline-block rounded border border-violet-500 bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500"
      >
        Download amendment CSV
      </a>
    </div>
  );
}

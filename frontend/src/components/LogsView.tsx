import { useEffect, useState } from "react";
import { api } from "../api";
import type { LogSummary } from "../types";
import { STATE_STYLES } from "./ui";
import { STAGES } from "../stages";

function StageRail({ log }: { log: LogSummary }) {
  return (
    <div className="flex gap-1">
      {log.stages.map((s) => (
        <span
          key={s.stage}
          title={`${s.label}: ${s.state}`}
          className={`h-2 w-8 rounded-sm border ${STATE_STYLES[s.state] ?? STATE_STYLES.todo}`}
        />
      ))}
    </div>
  );
}

export default function LogsView({
  onSelect,
}: {
  onSelect: (id: number) => void;
}) {
  const [logs, setLogs] = useState<LogSummary[]>([]);
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .listLogs(q, stage)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [q, stage]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          placeholder="Search by key…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-64 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-mono focus:border-violet-500 focus:outline-none"
        />
        <select
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
        >
          <option value="">All stages</option>
          {STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
          <option value="complete">Complete</option>
        </select>
        <span className="text-sm text-zinc-500">{logs.length} logs</span>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : logs.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-800 p-8 text-center text-sm text-zinc-500">
          No logs yet. Head to <span className="text-zinc-300">Import</span> and
          feed it a CSV.
        </div>
      ) : (
        <div className="overflow-hidden rounded border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-left text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-2 font-medium">Log key</th>
                <th className="px-4 py-2 font-medium">Stages</th>
                <th className="px-4 py-2 font-medium">Current</th>
                <th className="px-4 py-2 font-medium">Paths</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => onSelect(log.id)}
                  className="cursor-pointer border-t border-zinc-800 hover:bg-zinc-900/60"
                >
                  <td className="px-4 py-2.5 font-mono text-zinc-200">
                    {log.natural_key}
                  </td>
                  <td className="px-4 py-2.5">
                    <StageRail log={log} />
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    {log.current_stage === "complete" ? (
                      <span className="text-emerald-400">complete</span>
                    ) : (
                      log.current_stage
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-zinc-500">{log.path_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

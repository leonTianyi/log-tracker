import { useState } from "react";
import LogsView from "./components/LogsView";
import LogDetailView from "./components/LogDetailView";
import ImportView from "./components/ImportView";
import FieldsView from "./components/FieldsView";

type Tab = "logs" | "import" | "fields";

const TABS: { key: Tab; label: string }[] = [
  { key: "logs", label: "Logs" },
  { key: "import", label: "Import" },
  { key: "fields", label: "Fields" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("logs");
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null);

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold tracking-tight text-zinc-100">
              Log Triage
            </span>
            <span className="font-mono text-xs text-violet-400">tracker</span>
          </div>
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  if (t.key !== "logs") setSelectedLogId(null);
                }}
                className={`rounded px-3 py-1.5 text-sm transition-colors ${
                  tab === t.key
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {tab === "logs" &&
          (selectedLogId === null ? (
            <LogsView onSelect={setSelectedLogId} />
          ) : (
            <LogDetailView
              logId={selectedLogId}
              onBack={() => setSelectedLogId(null)}
            />
          ))}
        {tab === "import" && <ImportView />}
        {tab === "fields" && <FieldsView />}
      </main>
    </div>
  );
}

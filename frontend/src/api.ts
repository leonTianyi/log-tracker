import type {
  FieldDef,
  ImportResult,
  LogDetail,
  LogSummary,
} from "./types";

const BASE = "/api";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) message = body.detail;
    } catch {
      /* keep statusText */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

const jsonHeaders = { "Content-Type": "application/json" };

export const api = {
  listLogs(q?: string, stage?: string): Promise<LogSummary[]> {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (stage) params.set("stage", stage);
    return fetch(`${BASE}/logs?${params.toString()}`).then((r) =>
      unwrap<LogSummary[]>(r),
    );
  },

  getLog(id: number): Promise<LogDetail> {
    return fetch(`${BASE}/logs/${id}`).then((r) => unwrap<LogDetail>(r));
  },

  updateLog(id: number, fieldValues: Record<string, unknown>): Promise<LogDetail> {
    return fetch(`${BASE}/logs/${id}`, {
      method: "PATCH",
      headers: jsonHeaders,
      body: JSON.stringify({ field_values: fieldValues }),
    }).then((r) => unwrap<LogDetail>(r));
  },

  setStage(
    id: number,
    stage: string,
    state: string,
    doneBy?: string,
  ): Promise<LogDetail> {
    return fetch(`${BASE}/logs/${id}/stages/${stage}`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ state, done_by: doneBy ?? null }),
    }).then((r) => unwrap<LogDetail>(r));
  },

  importCsv(file: File): Promise<ImportResult> {
    const form = new FormData();
    form.append("file", file);
    return fetch(`${BASE}/import`, { method: "POST", body: form }).then((r) =>
      unwrap<ImportResult>(r),
    );
  },

  listFields(): Promise<FieldDef[]> {
    return fetch(`${BASE}/fields`).then((r) => unwrap<FieldDef[]>(r));
  },

  createField(payload: Partial<FieldDef>): Promise<FieldDef> {
    return fetch(`${BASE}/fields`, {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }).then((r) => unwrap<FieldDef>(r));
  },

  deleteField(id: number): Promise<{ deleted: number }> {
    return fetch(`${BASE}/fields/${id}`, { method: "DELETE" }).then((r) =>
      unwrap<{ deleted: number }>(r),
    );
  },
};

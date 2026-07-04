export interface StagePill {
  stage: string;
  label: string;
  state: string;
}

export interface PathInfo {
  id: number;
  bucket: string;
  uri: string;
  kind: string;
}

export interface Warning {
  level: string;
  message: string;
}

export interface LogSummary {
  id: number;
  natural_key: string;
  current_stage: string;
  stages: StagePill[];
  path_count: number;
  field_values: Record<string, unknown>;
  created_at: string | null;
}

export interface StageDetail {
  stage: string;
  label: string;
  state: string;
  done_at: string | null;
  done_by: string | null;
}

export interface LogDetail extends LogSummary {
  paths: PathInfo[];
  stage_detail: StageDetail[];
  warnings: Warning[];
}

export interface FieldDef {
  id: number;
  key: string;
  label: string;
  type: string;
  options: string[] | null;
  category: string;
  sort_order: number;
  active: boolean;
}

export interface FlaggedRow {
  row_number: number;
  reason: string;
  detail: string;
}

export interface ImportResult {
  rows_total: number;
  logs_created: number;
  logs_matched: number;
  paths_added: number;
  flagged: FlaggedRow[];
}

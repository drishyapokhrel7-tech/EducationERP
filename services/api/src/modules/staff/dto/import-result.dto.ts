// Same shape as students/dto/import-result.dto.ts — duplicated rather
// than imported across modules, matching this project's own small-
// shared-shape-duplication convention (e.g. each service's own toNumber).
export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  totalRows: number;
  created: number;
  updated: number;
  errors: ImportRowError[];
}

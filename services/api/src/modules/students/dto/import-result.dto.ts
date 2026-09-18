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

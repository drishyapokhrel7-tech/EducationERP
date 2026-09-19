export interface BulkPromoteRowError {
  enrollmentId: string;
  message: string;
}

export interface BulkPromoteResult {
  promoted: number;
  retained: number;
  graduated: number;
  errors: BulkPromoteRowError[];
}

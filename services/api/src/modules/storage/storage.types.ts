export interface UploadedFileInput {
  buffer: Buffer;
  originalName: string;
  mimetype: string;
}

export interface StoredFile {
  url: string;
  key: string;
}

// Both drivers implement this — StorageService picks one at startup
// based on STORAGE_DRIVER, so nothing above it (the uploads endpoint,
// or anything that ever calls it) needs to know which backend is
// actually in use.
export interface StorageDriver {
  upload(organizationId: string, file: UploadedFileInput): Promise<StoredFile>;
}

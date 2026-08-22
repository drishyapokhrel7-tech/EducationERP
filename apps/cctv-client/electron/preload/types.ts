import type {
  CameraEventResult,
  CameraRecord,
  CreateCameraInput,
  FaceMatchEvent,
  FaceMatchEventRecord,
  LoginInput,
  ReviewFaceMatchInput,
  SafeUser,
} from "@education-erp/api-client";
import type { CapturedFrame } from "../main/ipc";

export type { CapturedFrame };

// The single narrow, explicitly-allowlisted IPC surface exposed on
// window.cctvClient — nothing else reaches the renderer. Plain types
// only (no `electron` import, no runtime code), same reasoning as
// exam-client's preload/types.ts for keeping this importable from the
// renderer without pulling contextBridge code into its bundle.
export interface CctvClientApi {
  tryResume: () => Promise<boolean>;
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
  listCameras: () => Promise<CameraRecord[]>;
  registerCamera: (input: CreateCameraInput) => Promise<CameraRecord>;
  submitFrame: (cameraId: string, frame: CapturedFrame) => Promise<CameraEventResult>;
  listRecentEvents: () => Promise<FaceMatchEvent[]>;
  reviewEvent: (id: string, input: ReviewFaceMatchInput) => Promise<FaceMatchEventRecord>;
  getEventImage: (id: string) => Promise<{ buffer: ArrayBuffer; mimeType: string }>;
}

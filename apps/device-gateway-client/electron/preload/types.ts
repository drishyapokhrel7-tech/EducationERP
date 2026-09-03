import type {
  BindGatewayCardInput,
  CaptchaChallenge,
  EmployeePicker,
  GatewayCardBindingRecord,
  GatewayDeviceRecord,
  GatewayScanEvent,
  GatewayScanInput,
  GatewayScanResult,
  LoginInput,
  RegisterGatewayDeviceInput,
  SafeUser,
  StudentPicker,
} from "@education-erp/api-client";

// The single narrow, explicitly-allowlisted IPC surface exposed on
// window.deviceGatewayClient — nothing else reaches the renderer.
// Plain types only (no `electron` import, no runtime code), same
// reasoning as exam-client/cctv-client's own preload/types.ts for
// keeping this importable from the renderer without pulling
// contextBridge code into its bundle.
export interface DeviceGatewayClientApi {
  tryResume: () => Promise<boolean>;
  getCaptcha: () => Promise<CaptchaChallenge>;
  login: (input: LoginInput) => Promise<SafeUser>;
  logout: () => Promise<void>;
  listDevices: () => Promise<GatewayDeviceRecord[]>;
  registerDevice: (input: RegisterGatewayDeviceInput) => Promise<GatewayDeviceRecord>;
  scan: (deviceId: string, input: GatewayScanInput) => Promise<GatewayScanResult>;
  bindCard: (input: BindGatewayCardInput) => Promise<GatewayCardBindingRecord>;
  listRecentEvents: () => Promise<GatewayScanEvent[]>;
  fingerprintCapture: () => Promise<{ templateData: string } | null>;
  print: (html: string) => Promise<void>;
  listStudentsPicker: () => Promise<StudentPicker[]>;
  listEmployeesPicker: () => Promise<EmployeePicker[]>;
}

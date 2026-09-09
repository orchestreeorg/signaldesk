export const OPS_LOG_LIST = "signal:ops:logs";
export const OPS_SEQ_KEY = "signal:ops:seq";
export const OPS_HEARTBEAT_KEY = "signal:ops:heartbeat";
export const OPS_CONTROL_CHANNEL = "signal:ops:control";
export const OPS_LOG_LIMIT = 400;
export const OPS_HEARTBEAT_TTL_SEC = 20;

export type OpsLevel = "info" | "ok" | "wait" | "skip" | "warn" | "error";

export type OpsEvent = {
  seq: number;
  ts: string;
  level: OpsLevel;
  scope: string;
  code: string;
  message: string;
  data?: Record<string, unknown>;
};

export type OpsControlAction =
  | "start"
  | "stop"
  | "pause"
  | "resume"
  | "run-news"
  | "run-tape"
  | "run-digest";

export type OpsControl = {
  action: OpsControlAction;
  at: string;
};

export type OpsHeartbeat = {
  ts: string;
  pid: number;
  paused: boolean;
  newsLive: boolean;
  tapeLive: boolean;
  dryRun: boolean;
  nextNewsAt: string;
  nextTapeAt: string;
  nextDigestAt: string;
  waiting: {
    news: string;
    tape: string;
    digest: string;
  };
};

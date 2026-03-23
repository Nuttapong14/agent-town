/**
 * OpenClaw Gateway WebSocket client.
 *
 * Protocol: frame-based RPC over WebSocket.
 *   - req/res for request-response
 *   - event for server-pushed updates
 *   - Handshake: connect.challenge -> connect -> hello-ok
 *
 * Features:
 *   - Automatic reconnection with exponential backoff
 *   - Typed event dispatching
 *   - Request timeout management
 */

import type { GatewayFrame } from "./gateway-types";
import { createLogger } from "./logger";

const log = createLogger("GatewayClient");

type Listener = (payload: unknown) => void;

type DeviceIdentity = {
  id: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

interface PendingRequest {
  resolve: (res: GatewayFrame) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export type GatewayStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error"
  | "auth_failed"
  | "unreachable"
  | "rate_limited";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const RECONNECT_FACTOR = 2;
const RECONNECT_MAX_ATTEMPTS = 3;
const HANDSHAKE_TIMEOUT_MS = 15000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30000;

let counter = 0;
function nextId(): string {
  return `aw_${++counter}_${Date.now()}`;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizeDeviceAuthPart(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

async function signConnectNonce(params: {
  device: DeviceIdentity;
  nonce: string;
  token?: string;
  scopes: string[];
  signedAtMs: number;
  clientId: string;
  clientMode: string;
  role: string;
  platform: string;
  deviceFamily?: string;
}) {
  const payload = [
    "v3",
    params.device.id,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token ?? "",
    params.nonce,
    normalizeDeviceAuthPart(params.platform),
    normalizeDeviceAuthPart(params.deviceFamily),
  ].join("|");

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(params.device.privateKeyPem),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(payload),
  );

  const publicKey = await crypto.subtle.importKey(
    "spki",
    pemToArrayBuffer(params.device.publicKeyPem),
    { name: "Ed25519" },
    true,
    [],
  );
  const rawPublicKey = await crypto.subtle.exportKey("raw", publicKey);

  return {
    signature: bytesToBase64Url(new Uint8Array(signature)),
    publicKey: bytesToBase64Url(new Uint8Array(rawPublicKey)),
  };
}

export class GatewayClient {
  private ws: WebSocket | null = null;
  private pending = new Map<string, PendingRequest>();
  private eventListeners = new Map<string, Set<Listener>>();
  private statusListeners = new Set<(s: GatewayStatus) => void>();
  private _status: GatewayStatus = "disconnected";
  private _grantedScopes: Set<string> = new Set();
  private url: string;
  private token: string;
  private deviceToken?: string;
  private device?: DeviceIdentity;

  private connectReject: ((err: Error) => void) | null = null;
  private connectSettled = false;
  private autoReconnect = false;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(
    url: string,
    token: string,
    options?: { deviceToken?: string; device?: DeviceIdentity },
  ) {
    this.url = url;
    this.token = token;
    this.deviceToken = options?.deviceToken;
    this.device = options?.device;
  }

  get status(): GatewayStatus {
    return this._status;
  }

  hasScope(scope: string): boolean {
    return this._grantedScopes.has(scope);
  }

  private setStatus(s: GatewayStatus) {
    this._status = s;
    this.statusListeners.forEach((fn) => fn(s));
  }

  onStatus(fn: (s: GatewayStatus) => void): () => void {
    this.statusListeners.add(fn);
    return () => this.statusListeners.delete(fn);
  }

  on(event: string, fn: Listener): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(fn);
    return () => this.eventListeners.get(event)?.delete(fn);
  }

  connect(): Promise<GatewayFrame> {
    log.info(`Connecting to ${this.url}`);
    this.autoReconnect = true;
    this.reconnectAttempt = 0;
    this.intentionalClose = false;
    return this.connectOnce();
  }

  private connectOnce(): Promise<GatewayFrame> {
    return new Promise((resolve, reject) => {
      if (this.ws) {
        log.debug("Closing existing WS before reconnect");
        this.ws.close();
        this.ws = null;
      }

      this.setStatus("connecting");
      this.connectSettled = false;
      this.connectReject = reject;

      log.debug(`Opening WebSocket to ${this.url}`);
      const ws = new WebSocket(this.url);
      this.ws = ws;

      ws.onopen = () => {
        log.debug("WebSocket opened, waiting for connect.challenge");
      };

      ws.onmessage = (ev: MessageEvent) => {
        let frame: GatewayFrame;
        try {
          frame = JSON.parse(typeof ev.data === "string" ? ev.data : "{}");
        } catch {
          log.warn("Received non-JSON frame, ignoring:", ev.data);
          return;
        }
        this.handleFrame(frame, (res) => {
          if (!this.connectSettled) {
            this.connectSettled = true;
            this.connectReject = null;
            this.reconnectAttempt = 0;
            log.info(
              `Handshake complete — connected. Granted scopes: ${[...this._grantedScopes].join(", ") || "(none)"}`,
            );
            resolve(res);
          }
        });
      };

      ws.onerror = () => {
        log.error(`WebSocket error (status=${this._status}, url=${this.url})`);
        if (
          this._status !== "auth_failed" &&
          this._status !== "unreachable" &&
          this._status !== "rate_limited"
        ) {
          this.setStatus("error");
        }
        this.rejectConnect(new Error("WebSocket connection error"));
      };

      ws.onclose = (ev) => {
        const wasConnected = this._status === "connected";
        log.warn(
          `WebSocket closed: code=${ev.code} reason="${ev.reason || "(none)"}" wasConnected=${wasConnected} intentional=${this.intentionalClose}`,
        );
        if (
          this._status !== "auth_failed" &&
          this._status !== "unreachable" &&
          this._status !== "rate_limited"
        ) {
          this.setStatus("disconnected");
        }
        this.rejectConnect(new Error("Connection closed before handshake"));
        this.clearPending();

        if (!this.intentionalClose && this.autoReconnect) {
          this.scheduleReconnect(wasConnected);
        }
      };
    });
  }

  private scheduleReconnect(wasConnected: boolean) {
    if (this.reconnectTimer) return;
    if (wasConnected) this.reconnectAttempt = 0;

    if (this.reconnectAttempt >= RECONNECT_MAX_ATTEMPTS) {
      log.error(`Max reconnect attempts (${RECONNECT_MAX_ATTEMPTS}) reached — giving up`);
      this.autoReconnect = false;
      this.setStatus("unreachable");
      return;
    }

    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(RECONNECT_FACTOR, this.reconnectAttempt),
      RECONNECT_MAX_MS,
    );
    this.reconnectAttempt++;
    log.info(
      `Scheduling reconnect attempt ${this.reconnectAttempt}/${RECONNECT_MAX_ATTEMPTS} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.autoReconnect || this.intentionalClose) return;
      this.connectOnce().catch(() => {});
    }, delay);
  }

  private rejectConnect(err: Error) {
    if (!this.connectSettled) {
      this.connectSettled = true;
      this.connectReject?.(err);
      this.connectReject = null;
    }
  }

  private clearPending() {
    for (const [id, p] of this.pending) {
      p.reject(new Error("Connection closed"));
      clearTimeout(p.timer);
      this.pending.delete(id);
    }
  }

  private handleFrame(frame: GatewayFrame, onConnected?: (res: GatewayFrame) => void) {
    if (frame.type === "event") {
      if (frame.event === "connect.challenge") {
        const nonce = typeof frame.payload?.nonce === "string" ? frame.payload.nonce : "";
        void this.sendConnectHandshake(nonce);
        return;
      }

      if (frame.event) {
        const listeners = this.eventListeners.get(frame.event);
        if (listeners) listeners.forEach((fn) => fn(frame.payload));
      }
      const wildcard = this.eventListeners.get("*");
      if (wildcard) wildcard.forEach((fn) => fn(frame));
      return;
    }

    if (frame.type === "res" && frame.id) {
      const pending = this.pending.get(frame.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(frame.id);

        if (frame.ok) {
          if (frame.payload?.type === "hello-ok") {
            this.storeGrantedScopes(frame);
            this.setStatus("connected");
            onConnected?.(frame);
          }
          pending.resolve(frame);
        } else {
          log.warn(
            `[Gateway] Response REJECTED for id=${frame.id}: ${frame.error?.message ?? "Request failed"} | full error payload: ${JSON.stringify(frame.error ?? {})}`,
          );
          pending.reject(new Error(frame.error?.message ?? "Request failed"));
        }
        return;
      }

      if (frame.ok && frame.payload?.type === "hello-ok") {
        this.storeGrantedScopes(frame);
        this.setStatus("connected");
        onConnected?.(frame);
        return;
      }

      const listeners = this.eventListeners.get("__final_res__");
      if (listeners) listeners.forEach((fn) => fn(frame));
    }
  }

  private storeGrantedScopes(frame: GatewayFrame) {
    this._grantedScopes.clear();
    const payload = (frame.payload ?? {}) as { scopes?: unknown; auth?: { scopes?: unknown } };
    const scopes = Array.isArray(payload.scopes)
      ? payload.scopes
      : Array.isArray(payload.auth?.scopes)
        ? payload.auth?.scopes
        : [];
    for (const s of scopes) {
      if (typeof s === "string") this._grantedScopes.add(s);
    }
    log.info(`Granted scopes: [${[...this._grantedScopes].join(", ") || "(none)"}]`);
  }

  private async sendConnectHandshake(nonce: string) {
    log.debug("Sending connect handshake");
    const id = nextId();
    const scopes = ["operator.read", "operator.write", "operator.admin"];
    const auth: Record<string, string> = { token: this.token };
    if (this.deviceToken) auth.deviceToken = this.deviceToken;

    let devicePayload:
      | {
          id: string;
          publicKey: string;
          signature: string;
          signedAt: number;
          nonce: string;
        }
      | undefined;

    if (nonce && this.device) {
      try {
        const signedAtMs = Date.now();
        const signed = await signConnectNonce({
          device: this.device,
          nonce,
          token: this.token,
          scopes,
          signedAtMs,
          clientId: "gateway-client",
          clientMode: "backend",
          role: "operator",
          platform: "web",
        });
        devicePayload = {
          id: this.device.id,
          publicKey: signed.publicKey,
          signature: signed.signature,
          signedAt: signedAtMs,
          nonce,
        };
      } catch (error) {
        log.error(`Device signing failed: ${(error as Error).message}`);
      }
    }

    const frame: GatewayFrame = {
      type: "req",
      id,
      method: "connect",
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: "gateway-client",
          displayName: "Agent Town",
          version: "1.0.0",
          platform: "web",
          mode: "backend",
          instanceId: `aw-${Date.now()}`,
        },
        auth,
        role: "operator",
        scopes,
        locale: "en-US",
        userAgent: "agent-town/1.0.0",
        ...(devicePayload ? { device: devicePayload } : {}),
      },
    };

    const timer = setTimeout(() => {
      this.pending.delete(id);
      this.setStatus("error");
      this.rejectConnect(new Error("Handshake timeout (15s)"));
    }, HANDSHAKE_TIMEOUT_MS);

    this.pending.set(id, {
      resolve: () => {},
      reject: (err) => {
        const isRateLimited = /rate.limit|too many/i.test(err.message);
        const newStatus = isRateLimited ? "rate_limited" : "auth_failed";
        log.error(`Handshake rejected: ${err.message} → status=${newStatus}`);
        this.autoReconnect = false;
        this.setStatus(newStatus);
        this.rejectConnect(err);
      },
      timer,
    });

    this.ws?.send(JSON.stringify(frame));
  }

  async request(
    method: string,
    params?: Record<string, unknown>,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<GatewayFrame> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      log.error(`request("${method}") called but WS not open (status=${this._status})`);
      throw new Error("Not connected");
    }

    const id = nextId();
    log.debug(`request: method=${method} id=${id}`);
    const ws = this.ws;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        log.warn(`Request timed out: method=${method} id=${id} timeout=${timeoutMs}ms`);
        reject(new Error(`Timeout: ${method}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });
      const frame: GatewayFrame = { type: "req", id, method, params };
      ws.send(JSON.stringify(frame));
    });
  }

  onFinalResponse(fn: (frame: GatewayFrame) => void): () => void {
    return this.on("__final_res__", fn as Listener);
  }

  disconnect() {
    log.info("Disconnecting (intentional)");
    this.intentionalClose = true;
    this.autoReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.connectSettled = true;
    this.connectReject = null;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this._grantedScopes.clear();
    this.clearPending();
    this.setStatus("disconnected");
  }
}

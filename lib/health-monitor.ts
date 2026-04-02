import { gameEvents } from "./events";
import { createLogger } from "./logger";

const log = createLogger("HealthMonitor");

const HEARTBEAT_TTL_STALLED_MS = 30_000;
const HEARTBEAT_TTL_BLOCKED_MS = 60_000;
const CHECK_INTERVAL_MS = 10_000;

interface AgentEntry {
  heartbeatAt: number;
  status: "alive" | "stalled" | "blocked";
}

export class HealthMonitor {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private agents = new Map<string, AgentEntry>();

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    log.info("started");
  }

  stop(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
    log.info("stopped");
  }

  registerHeartbeat(agentId: string): void {
    const entry = this.agents.get(agentId);
    this.agents.set(agentId, {
      heartbeatAt: Date.now(),
      status: entry?.status ?? "alive",
    });
  }

  unregister(agentId: string): void {
    this.agents.delete(agentId);
  }

  check(): void {
    const now = Date.now();
    for (const [id, entry] of this.agents) {
      const elapsed = now - entry.heartbeatAt;
      if (elapsed > HEARTBEAT_TTL_BLOCKED_MS) {
        if (entry.status !== "blocked") {
          entry.status = "blocked";
          gameEvents.emit("agent:health", id, "blocked", now);
          log.warn(`agent ${id} is blocked (${elapsed}ms since last heartbeat)`);
        }
      } else if (elapsed > HEARTBEAT_TTL_STALLED_MS) {
        if (entry.status !== "stalled") {
          entry.status = "stalled";
          gameEvents.emit("agent:health", id, "stalled", now);
          log.warn(`agent ${id} is stalled (${elapsed}ms since last heartbeat)`);
        }
      } else if (entry.status !== "alive") {
        entry.status = "alive";
        gameEvents.emit("agent:health", id, "alive", now);
        log.info(`agent ${id} recovered`);
      }
    }
  }
}

export const healthMonitor = new HealthMonitor();

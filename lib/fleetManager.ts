import { Agent, AgentStatus } from "@/types/game";
import { createLogger } from "@/lib/logger";

const log = createLogger("fleet-manager");

export const HEARTBEAT_TTL_MS = 30_000;

const agents: Map<string, Agent> = new Map();

export function registerAgent(agent: Agent): void {
  agents.set(agent.id, agent);
  log.info(`registered agent ${agent.id} (${agent.name})`);
}

export function updateAgent(id: string, patch: Partial<Agent>): Agent | null {
  const existing = agents.get(id);
  if (!existing) return null;
  const updated: Agent = { ...existing, ...patch, id };
  agents.set(id, updated);
  return updated;
}

export function removeAgent(id: string): boolean {
  const existed = agents.has(id);
  if (existed) {
    agents.delete(id);
    log.info(`removed agent ${id}`);
  }
  return existed;
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function getAllAgents(): Agent[] {
  return Array.from(agents.values());
}

/**
 * Marks agents whose heartbeat has expired as 'offline'.
 * Returns the ids of agents that were marked offline.
 */
export function checkLiveness(): string[] {
  const now = Date.now();
  const staleIds: string[] = [];
  for (const [id, agent] of agents) {
    if (
      agent.status !== "offline" &&
      agent.status !== "retiring" &&
      now - agent.heartbeatAt > HEARTBEAT_TTL_MS
    ) {
      agents.set(id, { ...agent, status: "offline" as AgentStatus });
      staleIds.push(id);
      log.warn(`agent ${id} marked offline (last heartbeat ${now - agent.heartbeatAt}ms ago)`);
    }
  }
  return staleIds;
}

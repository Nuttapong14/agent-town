import { gameEvents } from "./events";
import { createLogger } from "./logger";

const log = createLogger("UsageTracker");

export interface AgentUsage {
  agentId: string;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCostUsd: number;
  contextUsed: number;
  contextMax: number;
  pressurePct: number;
  spentUsd: number;
  budgetUsd: number;
  riskLevel: "low" | "medium" | "high";
  lastUpdated: number;
}

class UsageTracker {
  private data = new Map<string, AgentUsage>();

  constructor() {
    gameEvents.on(
      "usage:tokens",
      (agentId, _model, promptTokens, completionTokens, costUsd, ts) => {
        const existing = this.getOrCreate(agentId);
        existing.totalPromptTokens += promptTokens;
        existing.totalCompletionTokens += completionTokens;
        existing.totalCostUsd += costUsd;
        existing.lastUpdated = ts;
        log.debug(`tokens for ${agentId}: +${promptTokens}p +${completionTokens}c +$${costUsd}`);
      },
    );

    gameEvents.on("usage:context", (agentId, contextUsed, contextMax, pressurePct, ts) => {
      const existing = this.getOrCreate(agentId);
      existing.contextUsed = contextUsed;
      existing.contextMax = contextMax;
      existing.pressurePct = pressurePct;
      existing.lastUpdated = ts;
      log.debug(`context for ${agentId}: ${pressurePct}% pressure`);
    });

    gameEvents.on("usage:budget", (agentId, spentUsd, budgetUsd, riskLevel, ts) => {
      const existing = this.getOrCreate(agentId);
      existing.spentUsd = spentUsd;
      existing.budgetUsd = budgetUsd;
      existing.riskLevel = riskLevel;
      existing.lastUpdated = ts;
      log.debug(`budget for ${agentId}: $${spentUsd}/$${budgetUsd} (${riskLevel})`);
    });
  }

  private getOrCreate(agentId: string): AgentUsage {
    if (!this.data.has(agentId)) {
      this.data.set(agentId, {
        agentId,
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalCostUsd: 0,
        contextUsed: 0,
        contextMax: 0,
        pressurePct: 0,
        spentUsd: 0,
        budgetUsd: 0,
        riskLevel: "low",
        lastUpdated: Date.now(),
      });
    }
    return this.data.get(agentId)!;
  }

  getAll(): AgentUsage[] {
    return Array.from(this.data.values());
  }

  getAgent(id: string): AgentUsage | undefined {
    return this.data.get(id);
  }

  getTeamTotals(): { totalTokens: number; totalCostUsd: number; agentCount: number } {
    let totalTokens = 0;
    let totalCostUsd = 0;
    for (const entry of this.data.values()) {
      totalTokens += entry.totalPromptTokens + entry.totalCompletionTokens;
      totalCostUsd += entry.totalCostUsd;
    }
    return { totalTokens, totalCostUsd, agentCount: this.data.size };
  }

  reset(): void {
    this.data.clear();
  }
}

export const usageTracker = new UsageTracker();

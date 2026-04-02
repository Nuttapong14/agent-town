import type { AuditEntry } from "@/types/game";

const MAX_ENTRIES = 1000;

class AuditLog {
  private buffer: AuditEntry[] = [];

  append(entry: Omit<AuditEntry, "id">): AuditEntry {
    const full: AuditEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    };
    this.buffer.push(full);
    if (this.buffer.length > MAX_ENTRIES) {
      this.buffer.shift();
    }
    return full;
  }

  query(filter?: { actor?: string; riskLevel?: string; since?: number }): AuditEntry[] {
    let result = this.buffer;
    if (!filter) return [...result];
    if (filter.actor) {
      result = result.filter((e) => e.actor === filter.actor);
    }
    if (filter.riskLevel) {
      result = result.filter((e) => e.riskLevel === filter.riskLevel);
    }
    if (filter.since !== undefined) {
      result = result.filter((e) => e.ts >= filter.since!);
    }
    return [...result];
  }

  clear(): void {
    this.buffer = [];
  }
}

export const auditLog = new AuditLog();

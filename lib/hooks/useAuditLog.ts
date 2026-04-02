import { useState, useEffect, useCallback } from "react";
import type { AuditEntry } from "@/types/game";

interface AuditFilter {
  actor?: string;
  riskLevel?: string;
  since?: number;
}

export function useAuditLog(filter?: AuditFilter, pollIntervalMs = 15_000) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (filter?.actor) params.set("actor", filter.actor);
    if (filter?.riskLevel) params.set("riskLevel", filter.riskLevel);
    if (filter?.since) params.set("since", String(filter.since));
    fetch(`/api/internal/audit?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data: AuditEntry[]) => {
        setEntries(data);
        setError(null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [filter?.actor, filter?.riskLevel, filter?.since]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return { entries, loading, error, refresh };
}

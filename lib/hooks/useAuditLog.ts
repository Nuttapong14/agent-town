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

  const actor = filter?.actor;
  const riskLevel = filter?.riskLevel;
  const since = filter?.since;

  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (actor) params.set("actor", actor);
    if (riskLevel) params.set("riskLevel", riskLevel);
    if (since) params.set("since", String(since));
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
  }, [actor, riskLevel, since]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(id);
  }, [refresh, pollIntervalMs]);

  return { entries, loading, error, refresh };
}

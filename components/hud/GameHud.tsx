"use client";

import "./hud.css";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStudio } from "@/lib/store";
import { isVisibleChatMessage } from "@/lib/constants";
import { MAIN_SESSION_KEY } from "@/lib/reducer";
import { useBgm } from "@/lib/useBgm";
import { loadOnboardingDone, loadGatewayConfig, saveOnboardingDone } from "@/lib/persistence";
import type { HudDockItem, HudPanelId } from "./HudDock";
import type { Agent } from "@/types/game";
import TopBar from "./TopBar";
import BottomBar from "./BottomBar";
import ConnectionPanel from "./ConnectionPanel";
import ChatPanel from "./ChatPanel";
import TaskPanel from "./TaskPanel";
import WorkerPanel from "./WorkerPanel";
import SeatManagerModal from "./SeatManagerModal";
import MusicControls from "./MusicControls";
import OnboardingOverlay from "./OnboardingOverlay";
import KanbanBoard from "./KanbanBoard";
import FleetPanel from "./FleetPanel";
import ActivityFeed from "./ActivityFeed";
import GovernancePanel from "./GovernancePanel";
import UsagePanel from "./UsagePanel";

export default function GameHud() {
  const { state } = useStudio();
  const bgm = useBgm();
  const [openPanel, setOpenPanel] = useState<HudPanelId | null>(null);
  const [seatManagerOpen, setSeatManagerOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(
    () => !loadOnboardingDone() && !loadGatewayConfig(),
  );
  const [fleetAgents, setFleetAgents] = useState<Agent[]>([]);
  useEffect(() => {
    const load = () => {
      fetch("/api/agents")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
        .then((data: Agent[]) => setFleetAgents(data))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, []);

  // Auto-dismiss onboarding when connection panel opens
  useEffect(() => {
    if (showOnboarding && openPanel === "connection") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to panel open
      setShowOnboarding(false);
      saveOnboardingDone();
    }
  }, [showOnboarding, openPanel]);

  // Auto-open connection panel on auth/connection failures
  useEffect(() => {
    if (
      state.connection === "auth_failed" ||
      state.connection === "unreachable" ||
      state.connection === "rate_limited"
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to connection state
      setOpenPanel("connection");
    } else if (state.connection === "connected") {
      setOpenPanel((prev) => (prev === "connection" ? null : prev));
    }
  }, [state.connection]);

  const activeSessionKey = state.activeSessionKey ?? MAIN_SESSION_KEY;
  const visibleTasks = useMemo(
    () => state.tasks.filter((task) => task.sessionKey === activeSessionKey),
    [activeSessionKey, state.tasks],
  );
  const visibleMessages = useMemo(
    () =>
      state.chatMessages.filter(
        (message) => message.sessionKey === activeSessionKey && isVisibleChatMessage(message),
      ),
    [activeSessionKey, state.chatMessages],
  );

  // Top-right toolbar items (everything except chat)
  const toolItems: HudDockItem[] = useMemo(
    () => [
      {
        id: "music",
        label: "Music",
        icon: "/ui/icons/icon-music.png",
        iconActive: "/ui/icons/icon-music-active.png",
      },
      {
        id: "connection",
        label: "Connection",
        icon: "/ui/icons/icon-connection.png",
        iconActive: "/ui/icons/icon-connection-active.png",
      },
      {
        id: "tasks",
        label: "Tasks",
        icon: "/ui/icons/icon-tasks.png",
        iconActive: "/ui/icons/icon-tasks-active.png",
      },
      {
        id: "workers",
        label: "Employees",
        icon: "/ui/icons/icon-workers.png",
        iconActive: "/ui/icons/icon-workers-active.png",
      },
      {
        id: "fleet" as const,
        label: "Fleet",
        icon: "/ui/icons/icon-workers.png",
        iconActive: "/ui/icons/icon-workers-active.png",
      },
      {
        id: "kanban" as const,
        label: "Kanban",
        icon: "/ui/icons/icon-tasks.png",
        iconActive: "/ui/icons/icon-tasks-active.png",
      },
      {
        id: "activity" as const,
        label: "Activity",
        icon: "/ui/icons/icon-connection.png",
        iconActive: "/ui/icons/icon-connection-active.png",
      },
      {
        id: "governance" as const,
        label: "Governance",
        icon: "/ui/icons/icon-tasks.png",
        iconActive: "/ui/icons/icon-tasks-active.png",
      },
      {
        id: "usage" as const,
        label: "Usage",
        icon: "/ui/icons/icon-music.png",
        iconActive: "/ui/icons/icon-music-active.png",
      },
    ],
    [],
  );

  const togglePanel = useCallback((id: HudPanelId) => {
    if (id === "workers") {
      setSeatManagerOpen((prev) => !prev);
      return;
    }
    setOpenPanel((current) => (current === id ? null : id));
  }, []);

  const musicIconOverrides = useMemo(
    () => (bgm.volume <= 0 ? { music: "/ui/icons/icon-music-muted.png" as string } : undefined),
    [bgm.volume],
  );

  const topRightPanelOpen = openPanel && openPanel !== "chat";

  return (
    <div className="hud-overlay">
      {/* Top area: logo | agent pills | tool buttons */}
      <TopBar
        seats={state.seats}
        toolItems={toolItems}
        openPanel={openPanel}
        onToggle={togglePanel}
        iconOverrides={musicIconOverrides}
      />

      {/* Top-right flyout panels */}
      {topRightPanelOpen && (
        <div className="hud-topright-flyout">
          {openPanel === "music" ? <MusicControls bgm={bgm} /> : null}
          {openPanel === "connection" ? <ConnectionPanel /> : null}
          {openPanel === "tasks" ? <TaskPanel tasks={visibleTasks} /> : null}
          {openPanel === "workers" ? (
            <WorkerPanel seats={state.seats} onOpenManager={() => setSeatManagerOpen(true)} />
          ) : null}
          {openPanel === "fleet" ? <FleetPanel agents={fleetAgents} /> : null}
          {openPanel === "kanban" ? <KanbanBoard tasks={visibleTasks} /> : null}
          {openPanel === "activity" ? <ActivityFeed /> : null}
          {openPanel === "governance" ? (
            <GovernancePanel onClose={() => setOpenPanel(null)} />
          ) : null}
          {openPanel === "usage" ? <UsagePanel /> : null}
        </div>
      )}

      {/* Bottom area: status pills (left) + chat dock (right) */}
      <div className="layout-bottom">
        <BottomBar
          connection={state.connection}
          sessionMetrics={state.sessionMetrics}
          seats={state.seats}
        />

        {/* Spacer pushes chat to right */}
        <div style={{ flex: "1 1 auto" }} />

        {/* Chat dock */}
        <div className="hud-chat-dock">
          {openPanel === "chat" && (
            <div className="hud-chat-dock__panel">
              <ChatPanel
                messages={visibleMessages}
                tasks={visibleTasks}
                isConnected={state.connection === "connected"}
                sessions={state.sessions}
                activeSessionKey={state.activeSessionKey}
              />
            </div>
          )}
          <button
            type="button"
            className={`hud-chat-dock__btn ${openPanel === "chat" ? "hud-chat-dock__btn--active" : ""}`}
            onClick={() => togglePanel("chat")}
            title="Chat"
          >
            <img
              src={
                openPanel === "chat" ? "/ui/icons/icon-chat-active.png" : "/ui/icons/icon-chat.png"
              }
              alt="Chat"
              width={28}
              height={28}
              style={{ imageRendering: "pixelated" }}
            />
            <span className="hud-chat-dock__label">Chat</span>
          </button>
        </div>
      </div>

      {/* Modals */}
      <SeatManagerModal
        open={seatManagerOpen}
        onClose={() => setSeatManagerOpen(false)}
        seats={state.seats}
      />

      {showOnboarding && <OnboardingOverlay onDone={() => setShowOnboarding(false)} />}
    </div>
  );
}

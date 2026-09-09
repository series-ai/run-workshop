/**
 * Local conversation logger for STILL WARM.
 * Logs player commands, room events, agent tool calls, responses, and errors
 * to console, window.__STILL_WARM_CONVERSATION__, and to the Vite dev server
 * at /_log_conversation to persist into conversation.log.
 */

export interface ConversationLogEntry {
  timestamp: string;
  type: string;
  data: unknown;
}

declare global {
  interface Window {
    __STILL_WARM_CONVERSATION__?: ConversationLogEntry[];
  }
}

export function logConversation(type: string, data: unknown): void {
  const timestamp = new Date().toISOString();
  const entry: ConversationLogEntry = { timestamp, type, data };

  // 1. Console log with styling
  const style =
    type === "PLAYER_COMMAND"
      ? "color: #79c0ff; font-weight: bold;"
      : type === "AGENT_RESPONSE" || type === "MONSTER_EMOTION"
        ? "color: #7ee787; font-weight: bold;"
        : type === "AGENT_ERROR"
          ? "color: #ff7b72; font-weight: bold;"
          : "color: #d2a8ff;";
  console.log(`%c[STILL-WARM] [${type}]`, style, data);

  // 2. Window in-memory journal
  if (typeof window !== "undefined") {
    window.__STILL_WARM_CONVERSATION__ =
      window.__STILL_WARM_CONVERSATION__ || [];
    window.__STILL_WARM_CONVERSATION__.push(entry);
    if (window.__STILL_WARM_CONVERSATION__.length > 200) {
      window.__STILL_WARM_CONVERSATION__.shift();
    }
  }

  // 3. POST to local Vite endpoint if available
  if (typeof fetch === "function") {
    try {
      fetch("/_log_conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {
        // Silently ignore if running in test or static host
      });
    } catch {
      // Ignore
    }
  }
}

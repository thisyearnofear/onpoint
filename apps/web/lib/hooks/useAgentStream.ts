import { useState, useCallback } from "react";

interface AgentStep {
  step: number;
  tool: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  durationMs: number;
}

interface AgentStreamState {
  steps: AgentStep[];
  trace: Record<string, unknown> | null;
  isRunning: boolean;
  error: string | null;
}

/**
 * Hook to consume the SSE streaming agent loop.
 * Shows each tool execution as it happens in real time.
 */
export function useAgentStream() {
  const [state, setState] = useState<AgentStreamState>({
    steps: [],
    trace: null,
    isRunning: false,
    error: null,
  });

  const run = useCallback(
    async (params: {
      goal: string;
      message?: string;
      imageBase64?: string;
    }) => {
      setState({ steps: [], trace: null, isRunning: true, error: null });

      try {
        const res = await fetch("/api/ai/agent?stream=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          setState((s) => ({
            ...s,
            isRunning: false,
            error: data.error || "Agent request failed",
          }));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                if (eventType === "tool_result") {
                  setState((s) => ({
                    ...s,
                    steps: [...s.steps, data as AgentStep],
                  }));
                } else if (eventType === "done") {
                  setState((s) => ({
                    ...s,
                    trace: data,
                    isRunning: false,
                  }));
                } else if (eventType === "error") {
                  setState((s) => ({
                    ...s,
                    error: data.error,
                    isRunning: false,
                  }));
                }
              } catch {}
              eventType = "";
            }
          }
        }
      } catch (err) {
        setState((s) => ({
          ...s,
          isRunning: false,
          error: err instanceof Error ? err.message : "Stream failed",
        }));
      }
    },
    [],
  );

  return { ...state, run };
}

"use client";

/**
 * AG Studio Agent Framework adapter → our metered Otari chat-completions
 * proxy (`POST {apiBase}/api/agent/studio-ai`). Studio owns the agent loop
 * and tools; this file only translates AgLlmRequest ↔ OpenAI chat
 * completions. No key crosses the wire — the API holds it.
 */

import type {
  AgAiConversationItem,
  AgAiEvent,
  AgAiOutputItem,
  AgAiToolSchema,
  AgLlmAdapter,
  AgLlmRequest,
  AgLlmResponse,
} from "ag-studio";

type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
};

function textOf(parts: { type: string; text?: string }[] | undefined): string {
  return (parts || []).map((p) => (p.type === "text" ? p.text || "" : "")).join("");
}

function toMessages(input: AgAiConversationItem[], instructions?: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  if (instructions) out.push({ role: "system", content: instructions });
  for (const item of input) {
    const anyItem = item as any;
    if (anyItem.type === "function_call") {
      out.push({
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: anyItem.callId,
            type: "function",
            function: { name: anyItem.name, arguments: anyItem.arguments || "{}" },
          },
        ],
      });
    } else if (anyItem.type === "function_call_output") {
      out.push({ role: "tool", tool_call_id: anyItem.callId, content: String(anyItem.output ?? "") });
    } else if (anyItem.type === "reasoning") {
      continue;
    } else if (anyItem.type === "message") {
      const role = anyItem.role === "assistant" ? "assistant" : anyItem.role === "system" ? "system" : "user";
      const content = textOf(anyItem.content);
      if (content) out.push({ role, content });
    }
  }
  return out;
}

function toTools(tools: AgAiToolSchema[] | undefined) {
  return (tools || [])
    .filter((t) => t.kind !== "provided")
    .map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
}

export function otariAdapter({ endpoint }: { endpoint: string }): AgLlmAdapter {
  return {
    executeTurn(request: AgLlmRequest, options?: { signal?: AbortSignal }) {
      const run = (async () => {
        const body: Record<string, unknown> = {
          messages: toMessages(request.input, request.instructions),
          tools: toTools(request.tools),
        };
        if (request.toolChoice && request.toolChoice !== "auto") {
          body.tool_choice =
            typeof request.toolChoice === "string"
              ? request.toolChoice
              : { type: "function", function: { name: request.toolChoice.name } };
        }
        if (request.responseFormat?.type === "json") {
          body.response_format = {
            type: "json_schema",
            json_schema: { name: request.responseFormat.name, schema: request.responseFormat.schema },
          };
        }

        let res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: options?.signal,
        });
        // Some gateways reject json_schema — degrade to json_object once.
        if (!res.ok && body.response_format) {
          body.response_format = { type: "json_object" };
          res = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: options?.signal,
          });
        }
        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          return {
            events: [] as AgAiEvent[],
            response: {
              id: `resp_${Date.now()}`,
              createdAt: Date.now(),
              status: "failed",
              error: { code: `http_${res.status}`, message: errText.slice(0, 300) || `HTTP ${res.status}` },
              output: [],
            } as AgLlmResponse,
          };
        }

        const data = await res.json();
        const msg = data.choices?.[0]?.message || {};
        const finish = data.choices?.[0]?.finish_reason;
        const output: AgAiOutputItem[] = [];
        const events: AgAiEvent[] = [];

        if (msg.content) {
          const messageId = `msg_${Date.now()}`;
          output.push({
            id: messageId,
            kind: "output",
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "text", text: msg.content, annotations: [] }],
          } as AgAiOutputItem);
          events.push({ type: "TEXT_MESSAGE_CHUNK", messageId, role: "assistant", delta: msg.content } as AgAiEvent);
        }
        for (const tc of msg.tool_calls || []) {
          const callId = tc.id || `call_${output.length}`;
          output.push({
            id: callId,
            kind: "output",
            type: "function_call",
            callId,
            name: tc.function?.name || "",
            arguments: tc.function?.arguments || "{}",
            status: "completed",
          } as AgAiOutputItem);
          events.push({
            type: "TOOL_CALL_CHUNK",
            toolCallId: callId,
            toolCallName: tc.function?.name,
            delta: tc.function?.arguments || "{}",
          } as AgAiEvent);
        }

        const response: AgLlmResponse = {
          id: data.id || `resp_${Date.now()}`,
          createdAt: Date.now(),
          status: finish === "length" ? "incomplete" : "completed",
          ...(finish === "length" ? { incompleteDetails: { reason: "max_output_tokens" as const } } : {}),
          output,
          ...(data.usage
            ? {
                usage: {
                  inputTokens: data.usage.prompt_tokens ?? 0,
                  outputTokens: data.usage.completion_tokens ?? 0,
                  totalTokens: data.usage.total_tokens,
                },
              }
            : {}),
          ...(data.model ? { model: data.model } : {}),
        };
        return { events, response };
      })();

      return {
        stream: {
          async *[Symbol.asyncIterator]() {
            for (const ev of (await run).events) yield ev;
          },
        },
        complete: run.then((r) => r.response),
      };
    },
  };
}

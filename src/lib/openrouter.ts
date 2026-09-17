/**
 * OpenRouter integration layer
 * -----------------------------------------------------------------------
 * Every OpenRouter-SDK-specific detail is isolated to this single file on
 * purpose, so that upgrading the SDK, switching endpoints, or changing
 * request options later only ever means editing this file.
 *
 * Docs used to build this:
 *  - https://openrouter.ai/docs/quickstart
 *  - https://openrouter.ai/docs/client-sdks/typescript/overview
 *
 * The rest of the app only talks to `streamChatCompletion()` below and
 * never imports `@openrouter/sdk` directly.
 * -----------------------------------------------------------------------
 */
import type { ChatMessages, ChatContentItems } from "@openrouter/sdk/models";
import type { ChatMessage } from "../types";
import { isOutputLimited, resolveOutputLimit } from './outputLimits';
import type { McpServerConfig } from '../types';

export interface StreamChatOptions {
  apiKey: string;
  model: string;
  maxOutputTokens?: number;
  onOutputLimit?: () => void;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /** called with each new text fragment as it arrives */
  onDelta: (deltaText: string) => void;
  /** called once, right before the first token arrives */
  onStart?: () => void;
}

export class OpenRouterRequestError extends Error {
  cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "OpenRouterRequestError";
    this.cause = cause;
  }
}

/** Converts our internal ChatMessage shape into the SDK's message format. */
function toSdkMessages(messages: ChatMessage[]): ChatMessages[] {
  return messages
    .filter((m) => m.role !== "assistant" || !m.error || isOutputLimited(m))
    .map((m): ChatMessages => {
      if (m.role === "system") {
        return { role: "system", content: m.content };
      }
      if (m.role === "assistant") {
        return { role: "assistant", content: m.content };
      }

      // user message — may include image attachments
      if (m.images && m.images.length > 0) {
        const parts: ChatContentItems[] = [
          { type: "text", text: m.content || " " },
          ...m.images.map(
            (img): ChatContentItems => ({
              type: "image_url",
              imageUrl: { url: img.dataUrl },
            }),
          ),
        ];
        return { role: "user", content: parts };
      }

      return { role: "user", content: m.content };
    });
}

/**
 * Streams a chat completion from OpenRouter, invoking `onDelta` for every
 * incoming text fragment. Resolves with the full assembled text once the
 * stream ends. Throws `OpenRouterRequestError` on failure.
 */
export async function streamChatCompletion({
  apiKey,
  model,
  messages,
  signal,
  onDelta,
  onStart,
  maxOutputTokens = 16384,
  onOutputLimit,
}: StreamChatOptions): Promise<string> {
  if (!apiKey.trim()) {
    throw new OpenRouterRequestError("API 키가 설정되지 않았습니다. 설정에서 OpenRouter API 키를 입력해주세요.");
  }
  if (!model.trim()) {
    throw new OpenRouterRequestError("모델이 설정되지 않았습니다. 설정에서 사용할 모델명을 입력해주세요.");
  }
  if (model !== 'openrouter/free' && !model.endsWith(':free')) {
    throw new OpenRouterRequestError('Free-only mode: choose openrouter/free or a listed :free model in Settings.');
  }

  const { OpenRouter } = await import('@openrouter/sdk');
  const client = new OpenRouter({
    apiKey,
    httpReferer: typeof window !== "undefined" ? window.location.origin : undefined,
    appTitle: "CW.AI",
  });

  let full = "";
  let started = false;

  try {
    const catalog = await getFreeModels().catch(() => []);
    if (signal?.aborted) return full;
    const maxTokens = resolveOutputLimit(maxOutputTokens, catalog.find(m => m.id === model)?.maxCompletionTokens);
    const result = await client.chat.send(
      {
        chatRequest: {
          model,
          messages: toSdkMessages(messages),
          stream: true,
          ...(maxTokens === undefined ? {} : { maxTokens }),
        },
      },
      { signal },
    );

    // `result` is an EventStream<ChatStreamChunk> when stream: true
    for await (const chunk of result as AsyncIterable<{
      error?: { message?: string };
      choices: Array<{ delta?: { content?: string | null }; finishReason?: string; finish_reason?: string }>;
    }>) {
      if (chunk.error) throw new Error(chunk.error.message || 'The provider interrupted this response.');
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        if (!started) {
          started = true;
          onStart?.();
        }
        full += delta;
        onDelta(delta);
      }
      if ((chunk.choices?.[0]?.finishReason ?? chunk.choices?.[0]?.finish_reason) === 'length') {
        onOutputLimit?.();
      }
    }

    return full;
  } catch (err) {
    if (signal?.aborted) {
      return full; // user stopped generation intentionally
    }
    throw new OpenRouterRequestError(extractErrorMessage(err), err);
  }
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // OpenRouter SDK error classes generally carry a readable `.message`
    return err.message || "OpenRouter 요청 중 알 수 없는 오류가 발생했습니다.";
  }
  return "OpenRouter 요청 중 알 수 없는 오류가 발생했습니다.";
}



export type ModelOption = {
  id: string;
  label: string;
  maxCompletionTokens?: number | null;
};


type OpenRouterResponse = {
  data: {
    models: Array<{
      slug: string;
      short_name: string;
      // this is the actual model object you want
      endpoint?: {
        model: {
          slug: string;
          short_name: string;
          is_free: boolean;
          model_variant_slug: string;
        };
        // ... other fields
      };
      // fallback, some formats have model directly
      model?: {
        slug: string;
        short_name: string;
      }
    }>;
  };
};

// If you already have the JSON response
export function mapToOptions(response: OpenRouterResponse): ModelOption[] {
  return response.data.models.map((card) => {
    // this handles all 3 shapes: card.endpoint.model, card.model, or card itself
    const model = card.endpoint?.model ?? card.model ?? card;

    const slug = model.slug.endsWith(':free') ? model.slug : `${model.slug}:free`;

    return {
      id: slug as ModelOption['id'], // -> `${data.model.slug}:free`
      label: model.short_name,        // -> data.model.short_name
    };
  });
}

let catalogCache: { until: number; value: Promise<ModelOption[]> } | undefined;
export function getFreeModels(): Promise<ModelOption[]> {
  if (catalogCache && catalogCache.until > Date.now()) return catalogCache.value;
  const value = fetchFreeModels().catch(error => { catalogCache = undefined; throw error; });
  catalogCache = { until: Date.now() + 300000, value };
  return value;
}

export interface McpToolCall { id: string; name: string; arguments: Record<string, unknown> }

export async function selectMcpToolCalls(apiKey: string, model: string, messages: ChatMessage[], servers: McpServerConfig[], signal?: AbortSignal): Promise<McpToolCall[]> {
  const available = servers.filter(s => s.enabled).flatMap(server => server.tools.map(tool => ({ server, tool, name: `mcp_${server.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)}_${tool.name}`.slice(0, 64) })));
  if (!available.length) return [];
  const { OpenRouter } = await import('@openrouter/sdk');
  const client = new OpenRouter({ apiKey, httpReferer: window.location.origin, appTitle: 'CW.AI' });
  const result = await client.chat.send({ chatRequest: {
    model, messages: toSdkMessages(messages), stream: false, toolChoice: 'auto',
    tools: available.map(item => ({ type: 'function' as const, function: { name: item.name, description: `[MCP: ${item.server.name}] ${item.tool.description ?? item.tool.name}`, parameters: item.tool.inputSchema ?? { type: 'object', properties: {} } } })),
  } }, { signal });
  const calls = (result as { choices?: Array<{ message?: { toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }> } }> }).choices?.[0]?.message?.toolCalls ?? [];
  return calls.flatMap(call => {
    const item = available.find(candidate => candidate.name === call.function.name);
    if (!item) return [];
    try { const args = JSON.parse(call.function.arguments); return args && typeof args === 'object' && !Array.isArray(args) ? [{ id: call.id, name: call.function.name, arguments: args as Record<string, unknown> }] : []; }
    catch { return []; }
  });
}

export function resolveMcpTool(name: string, servers: McpServerConfig[]) {
  return servers.flatMap(server => server.tools.map(tool => ({ server, tool, name: `mcp_${server.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20)}_${tool.name}`.slice(0, 64) }))).find(item => item.name === name);
}
async function fetchFreeModels(): Promise<ModelOption[]> {
  const res = await fetch(
    'https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(5000) }
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as { data: { id: string; name: string; top_provider?: { max_completion_tokens?: number | null }; pricing: { prompt: string; completion: string } }[] };
  return [{ id: 'openrouter/free', label: 'Free router (automatic)' }, ...json.data
    .filter(m => m.id.endsWith(':free') && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0)
    .map(m => ({ id: m.id, label: m.name, maxCompletionTokens: m.top_provider?.max_completion_tokens }))];
}

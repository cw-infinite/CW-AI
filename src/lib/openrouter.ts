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
import { OpenRouter } from "@openrouter/sdk";
import type { ChatMessages, ChatContentItems } from "@openrouter/sdk/models";
import type { ChatMessage } from "../types";

export interface StreamChatOptions {
  apiKey: string;
  model: string;
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
    .filter((m) => m.role !== "assistant" || !m.error) // drop failed assistant turns
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
}: StreamChatOptions): Promise<string> {
  if (!apiKey.trim()) {
    throw new OpenRouterRequestError("API 키가 설정되지 않았습니다. 설정에서 OpenRouter API 키를 입력해주세요.");
  }
  if (!model.trim()) {
    throw new OpenRouterRequestError("모델이 설정되지 않았습니다. 설정에서 사용할 모델명을 입력해주세요.");
  }

  const client = new OpenRouter({
    apiKey,
    httpReferer: typeof window !== "undefined" ? window.location.origin : undefined,
    appTitle: "CW.AI",
  });

  let full = "";
  let started = false;

  try {
    const result = await client.chat.send(
      {
        chatRequest: {
          model,
          messages: toSdkMessages(messages),
          stream: true,
        },
      },
      { signal },
    );

    // `result` is an EventStream<ChatStreamChunk> when stream: true
    for await (const chunk of result as AsyncIterable<{
      choices: Array<{ delta?: { content?: string | null } }>;
    }>) {
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) {
        if (!started) {
          started = true;
          onStart?.();
        }
        full += delta;
        onDelta(delta);
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
  id: `${string}:free`;
  label: string;
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

export async function getFreeModels(): Promise<ModelOption[]> {
  const res = await fetch(
    'https://openrouter.ai/api/frontend/v1/models/find?active=true&fmt=cards&order=newest&q=free'
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch models: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as OpenRouterResponse;

  // Deduplicate by id (API can return same model from different providers)
  const options = mapToOptions(json);
  return [...new Map(options.map(o => [o.id, o])).values()];
}

/** A short curated list shown as quick-pick suggestions in Settings. */
export const SUGGESTED_MODELS: { id: string; label: string }[] = [
  { id: "openai/gpt-5", label: "GPT-5" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek Chat" },
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B" },
];

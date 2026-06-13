import { buildAgentPrompt } from './agentPrompt';
import type { AgentRequest, AiProvider } from './agentTypes';

type AiProviderConfig = {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
};

export class UnconfiguredAiProvider implements AiProvider {
  readonly mode = 'unconfigured' as const;
  readonly model = '';

  complete(): Promise<never> {
    return Promise.reject(
      new Error(
        '真实 AI 尚未配置。请在 .env.local 中填写 VITE_AI_BASE_URL、VITE_AI_API_KEY 和 VITE_AI_MODEL，然后重启项目。',
      ),
    );
  }
}

export class OpenAiCompatibleProvider implements AiProvider {
  readonly mode = 'real' as const;
  readonly model: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: Required<Omit<AiProviderConfig, 'fetchImpl'>> & {
      fetchImpl?: typeof fetch;
    },
  ) {
    this.model = config.model;
    this.fetchImpl = config.fetchImpl ?? ((...args) => fetch(...args));
  }

  async complete(request: AgentRequest, options?: { signal?: AbortSignal }) {
    const response = await this.fetchImpl(
      `${this.config.baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: 'user', content: buildAgentPrompt(request) }],
          ...(this.config.baseUrl.includes('moonshot.cn')
            ? { response_format: { type: 'json_object' } }
            : {}),
        }),
        signal: options?.signal,
      },
    );

    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(
        `AI 请求失败：HTTP ${response.status}${detail ? ` - ${detail}` : ''}`,
      );
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new Error('AI 响应缺少文本内容');
    return content;
  }
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      error?: { message?: unknown };
      message?: unknown;
    };
    const message = payload.error?.message ?? payload.message;
    return typeof message === 'string' ? message : '';
  } catch {
    return '';
  }
}

export function createConfiguredAiProvider(config: AiProviderConfig = {}): AiProvider {
  const env = import.meta.env;
  const baseUrl = config.baseUrl ?? env.VITE_AI_BASE_URL;
  const apiKey = config.apiKey ?? env.VITE_AI_API_KEY;
  const model = config.model ?? env.VITE_AI_MODEL;
  if (!baseUrl || !apiKey || !model) return new UnconfiguredAiProvider();
  return new OpenAiCompatibleProvider({
    baseUrl,
    apiKey,
    model,
    fetchImpl: config.fetchImpl,
  });
}

/**
 * Model Router: Route lesson generation to Gemini, Anthropic, Groq, or local Ollama.
 *
 * Enables the EasyTutor merge: the same lesson request can be sent to any provider.
 * Providers are tried in order with automatic failover.
 */

export type ModelProvider = 'gemini' | 'anthropic' | 'groq' | 'ollama';

export interface ModelRouterConfig {
  primary: ModelProvider;
  fallback: ModelProvider[];
  ollamaBaseUrl?: string;
  ollamaModel?: string;
}

export interface GenerationRequest {
  systemInstruction: string;
  prompt: string;
  schema: Record<string, unknown>;
  provider?: ModelProvider;
}

export interface GenerationResult {
  data: unknown;
  inputTokens: number;
  outputTokens: number;
  provider: ModelProvider;
  model: string;
}

export const DEFAULT_ROUTER_CONFIG: ModelRouterConfig = {
  primary: 'gemini',
  fallback: ['ollama'],
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'gemma3:4b',
};

export class ModelRouter {
  /**
   * Generates structured JSON using the specified or primary provider, with fallback.
   */
  static async generate(request: GenerationRequest, config: ModelRouterConfig = DEFAULT_ROUTER_CONFIG): Promise<GenerationResult> {
    const providers = [request.provider ?? config.primary, ...config.fallback].filter(
      (p, i, arr) => arr.indexOf(p) === i
    );

    let lastError: unknown = null;

    for (const provider of providers) {
      try {
        switch (provider) {
          case 'gemini':
            return await this.viaGemini(request);
          case 'anthropic':
            return await this.viaAnthropic(request);
          case 'groq':
            return await this.viaGroq(request);
          case 'ollama':
            return await this.viaOllama(request, config);
        }
      } catch (err) {
        lastError = err;
        continue;
      }
    }

    throw new Error(`All model providers failed. Last error: ${lastError}`);
  }

  private static async viaGemini(request: GenerationRequest): Promise<GenerationResult> {
    const { GeminiService } = await import('./gemini.ts');
    const response = await GeminiService.generateStructuredJson<unknown>({
      systemInstruction: request.systemInstruction,
      prompt: request.prompt,
      schema: request.schema,
    });
    return {
      data: response.data,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      provider: 'gemini',
      model: 'gemini-3.8-flash',
    };
  }

  private static async viaAnthropic(request: GenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: request.systemInstruction,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);
    const data = await res.json();

    return {
      data: JSON.parse(data.content?.[0]?.text ?? '{}'),
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
      provider: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  private static async viaGroq(request: GenerationRequest): Promise<GenerationResult> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not configured');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        temperature: 0.7,
        messages: [
          { role: 'system', content: request.systemInstruction },
          { role: 'user', content: request.prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) throw new Error(`Groq error: ${res.status}`);
    const data = await res.json();

    return {
      data: JSON.parse(data.choices?.[0]?.message?.content ?? '{}'),
      inputTokens: data.usage?.prompt_tokens ?? 0,
      outputTokens: data.usage?.completion_tokens ?? 0,
      provider: 'groq',
      model: 'llama-3.1-70b-versatile',
    };
  }

  private static async viaOllama(
    request: GenerationRequest,
    config: ModelRouterConfig
  ): Promise<GenerationResult> {
    const res = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: `${request.systemInstruction}\n\n${request.prompt}`,
        stream: false,
        format: 'json',
      }),
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
    const data = await res.json();

    return {
      data: JSON.parse(data.response ?? '{}'),
      inputTokens: 0, // Ollama doesn't report token counts reliably
      outputTokens: 0,
      provider: 'ollama',
      model: config.ollamaModel,
    };
  }
}

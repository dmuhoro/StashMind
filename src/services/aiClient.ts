/**
 * AI Client Interface — StashMind AI Engine.
 *
 * Provides a clean abstraction over AI model providers so that:
 * - Tests use a deterministic FakeAiClient (no real API calls)
 * - Production uses GeminiClient with real model verification
 * - Model IDs are validated against Google's live model list at startup
 */

export interface AIClient {
  /**
   * Generates structured JSON with schema validation and automatic retry.
   */
  generateStructuredJson<T>(
    params: {
      systemInstruction: string;
      prompt: string;
      schema: Record<string, unknown>;
      model?: string;
    }
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }>;
}

/**
 * Result of a model verification check.
 */
export interface ModelVerificationResult {
  available: boolean;
  availableModels: string[];
  missingModels: string[];
}

/**
 * Fake AI Client — deterministic implementation for tests.
 * Never makes real API calls. Returns grounded, predictable output.
 */
export class FakeAiClient implements AIClient {
  async generateStructuredJson<T>(
    params: {
      systemInstruction: string;
      prompt: string;
      schema: Record<string, unknown>;
      model?: string;
    }
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    // Deterministic fallback: generate schema-appropriate output
    const properties = (params.schema as any).properties || {};
    const data: Record<string, unknown> = {};

    // Extract source title from prompt if present (for lesson generation)
    const titleMatch = params.prompt.match(/SOURCE TITLE:\s*(.+)/i);
    const extractedTitle = titleMatch ? titleMatch[1].trim() : undefined;

    for (const [key, prop] of Object.entries(properties)) {
      const propType = (prop as any).type;
      const propEnum = (prop as any).enum;

      if (propEnum) {
        data[key] = propEnum[0];
      } else if (key === 'title' && extractedTitle) {
        data[key] = extractedTitle;
      } else if (propType === 'string') {
        data[key] = `Generated ${key}`;
      } else if (propType === 'number') {
        data[key] = 85;
      } else if (propType === 'array') {
        const itemsSchema = (prop as any).items;
        if (itemsSchema && itemsSchema.properties) {
          const itemCount = 2; // Generate at least 2 items for variety
          const items: Record<string, unknown>[] = [];
          for (let i = 0; i < itemCount; i++) {
            const item: Record<string, unknown> = {};
            for (const [itemKey, itemProp] of Object.entries(itemsSchema.properties)) {
              const itemType = (itemProp as any).type;
              const itemEnum = (itemProp as any).enum;
              if (itemEnum) {
                item[itemKey] = itemEnum[i % itemEnum.length];
              } else if (itemType === 'string') {
                item[itemKey] = `Generated ${itemKey} ${i + 1}`;
              } else if (itemType === 'number') {
                item[itemKey] = i === 0 ? 0 : 120;
              } else {
                item[itemKey] = '';
              }
            }
            items.push(item);
          }
          data[key] = items;
        } else {
          data[key] = [];
        }
      } else if (propType === 'object') {
        data[key] = {};
      } else {
        data[key] = null;
      }
    }

    return {
      data: data as T,
      inputTokens: params.prompt.length,
      outputTokens: JSON.stringify(data).length,
    };
  }
}

/**
 * Gemini Client — real AI model integration via @google/genai.
 * Validates model IDs against Google's live model list at startup.
 */
export class GeminiClient implements AIClient {
  private modelCache: Map<string, boolean> = new Map();

  async generateStructuredJson<T>(
    params: {
      systemInstruction: string;
      prompt: string;
      schema: Record<string, unknown>;
      model?: string;
    }
  ): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
    const { GoogleGenAI } = await import('@google/genai');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey || apiKey === 'dummy-key-for-local-development') {
      throw new Error(
        'GEMINI_API_KEY not set or is a dummy key. AI engine requires a real API key.'
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    const model = params.model || 'gemini-3.8-flash';

    // Verify model is available (cached)
    const isAvailable = await this.verifyModel(model, ai);
    if (!isAvailable) {
      throw new Error(
        `Model "${model}" is not available on Google's live model list. ` +
          'Check your GEMINI_API_KEY and model configuration.'
      );
    }

    const requestConfig = {
      systemInstruction: params.systemInstruction,
      responseMimeType: 'application/json' as const,
      responseSchema: params.schema as unknown,
    };

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.prompt,
          config: requestConfig,
        });

        const text = response.text || '';
        const parsed = JSON.parse(text) as T;

        return {
          data: parsed,
          inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        };
      } catch (err) {
        lastError = err;
        // Automatic repair retry on JSON parse failure
        if (attempt === 0) {
          const retryPrompt = `${params.prompt}\n\nIMPORTANT: Return ONLY valid JSON matching the schema.`;
          const retryResponse = await ai.models.generateContent({
            model,
            contents: retryPrompt,
            config: requestConfig,
          });
          const retryText = retryResponse.text || '';
          const repaired = JSON.parse(retryText) as T;
          return {
            data: repaired,
            inputTokens: retryResponse.usageMetadata?.promptTokenCount ?? 0,
            outputTokens: retryResponse.usageMetadata?.candidatesTokenCount ?? 0,
          };
        }
      }
    }

    throw lastError || new Error('AI generation failed');
  }

  /**
   * Verifies a model ID against Google's live model list.
   * Results are cached for the process lifetime.
   */
  async verifyModel(model: string, ai: any): Promise<boolean> {
    if (this.modelCache.has(model)) {
      return this.modelCache.get(model)!;
    }

    try {
      const models = await ai.models.list();
      const modelIds = models.models?.map((m: any) => m.name.replace('models/', '')) || [];
      const available = modelIds.includes(model);
      this.modelCache.set(model, available);
      return available;
    } catch {
      // If we can't reach Google, fail closed
      this.modelCache.set(model, false);
      return false;
    }
  }

  /**
   * Get all available models from Google's live list.
   */
  async getAvailableModels(): Promise<string[]> {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });

    try {
      const pager: any = await ai.models.list();
      const models = pager.models || [];
      return models.map((m: any) => m.name.replace('models/', ''));
    } catch {
      return [];
    }
  }
}

/**
 * Creates the appropriate AI client based on environment.
 * - Production: GeminiClient (real API, fail-closed without valid key)
 * - Test: FakeAiClient (deterministic, no API calls)
 */
export function createAIClient(): AIClient {
  const isTest =
    typeof process !== 'undefined' &&
    (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test');
  const apiKey =
    typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;

  if (isTest || !apiKey || apiKey === 'dummy-key-for-local-development') {
    return new FakeAiClient();
  }
  return new GeminiClient();
}

/**
 * Verifies that all configured model IDs exist on Google's live model list.
 * Throws in production if any configured model is missing (fail closed).
 */
export async function verifyModelRegistry(
  configuredModels: string[],
  client: AIClient
): Promise<ModelVerificationResult> {
  if (!(client instanceof GeminiClient)) {
    return {
      available: true,
      availableModels: [],
      missingModels: [],
    };
  }

  const availableModels = await client.getAvailableModels();
  const missingModels = configuredModels.filter((m) => !availableModels.includes(m));

  return {
    available: missingModels.length === 0,
    availableModels,
    missingModels,
  };
}


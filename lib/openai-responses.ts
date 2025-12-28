/**
 * OpenAI Responses API Client
 * 
 * This client wraps OpenAI's new Responses API (v1/responses) which provides:
 * - Chain-of-thought (CoT) persistence via previous_response_id
 * - Reasoning effort control (none, low, medium, high, xhigh)
 * - Verbosity control (low, medium, high)
 * - Streaming support
 * 
 * @see https://platform.openai.com/docs/guides/latest-model
 */

export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';
export type Verbosity = 'low' | 'medium' | 'high';

export interface ResponsesAPIOptions {
  model: string;
  reasoning?: {
    effort?: ReasoningEffort;
  };
  text?: {
    verbosity?: Verbosity;
  };
  temperature?: number; // Only valid when reasoning.effort is 'none'
  maxOutputTokens?: number;
}

export interface ResponseMessage {
  role: 'system' | 'user' | 'assistant' | 'developer';
  content: string;
}

export interface GenerateOptions {
  input: string | ResponseMessage[];
  previousResponseId?: string;
  stream?: boolean;
}

export interface ResponseResult {
  id: string;
  text: string;
  reasoningTokens?: number;
  outputTokens?: number;
}

export interface StreamChunk {
  type: 'content' | 'reasoning' | 'done';
  content?: string;
  id?: string;
}

/**
 * OpenAI Responses API Client
 * 
 * Provides a clean interface for the new Responses API with support for:
 * - Chain-of-thought persistence
 * - Reasoning effort control
 * - Streaming responses
 */
export class ResponsesAPIClient {
  private apiKey: string;
  private baseUrl = 'https://api.openai.com/v1/responses';
  private options: ResponsesAPIOptions;

  constructor(options: ResponsesAPIOptions) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.apiKey = apiKey;
    this.options = options;
  }

  /**
   * Generate a response using the Responses API
   */
  async generate(options: GenerateOptions): Promise<ResponseResult> {
    const body = this.buildRequestBody(options);

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Responses API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return this.parseResponse(data);
  }

  /**
   * Generate a streaming response using the Responses API
   */
  async *generateStream(options: GenerateOptions): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody({ ...options, stream: true });

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Responses API error: ${response.status} - ${error}`);
    }

    if (!response.body) {
      throw new Error('No response body for streaming');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let responseId: string | undefined;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { type: 'done', id: responseId };
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              // Extract response ID from the first chunk
              if (parsed.id && !responseId) {
                responseId = parsed.id;
              }

              // Handle different output types
              if (parsed.type === 'response.output_text.delta') {
                yield { type: 'content', content: parsed.delta };
              } else if (parsed.type === 'response.reasoning.delta') {
                yield { type: 'reasoning', content: parsed.delta };
              } else if (parsed.type === 'response.done') {
                yield { type: 'done', id: parsed.response?.id || responseId };
              }
            } catch {
              // Skip malformed JSON lines
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Simple text generation (non-streaming)
   */
  async generateText(prompt: string, previousResponseId?: string): Promise<ResponseResult> {
    return this.generate({
      input: prompt,
      previousResponseId,
    });
  }

  /**
   * Generate with system and user messages
   */
  async generateWithMessages(
    messages: ResponseMessage[],
    previousResponseId?: string
  ): Promise<ResponseResult> {
    return this.generate({
      input: messages,
      previousResponseId,
    });
  }

  /**
   * Streaming text generation
   */
  async streamText(
    prompt: string,
    onChunk: (chunk: string) => void,
    previousResponseId?: string
  ): Promise<ResponseResult> {
    let fullText = '';
    let responseId: string | undefined;

    for await (const chunk of this.generateStream({
      input: prompt,
      previousResponseId,
    })) {
      if (chunk.type === 'content' && chunk.content) {
        fullText += chunk.content;
        onChunk(chunk.content);
      } else if (chunk.type === 'done') {
        responseId = chunk.id;
      }
    }

    return {
      id: responseId || '',
      text: fullText,
    };
  }

  /**
   * Streaming with messages
   */
  async streamWithMessages(
    messages: ResponseMessage[],
    onChunk: (chunk: string) => void,
    previousResponseId?: string
  ): Promise<ResponseResult> {
    let fullText = '';
    let responseId: string | undefined;

    for await (const chunk of this.generateStream({
      input: messages,
      previousResponseId,
    })) {
      if (chunk.type === 'content' && chunk.content) {
        fullText += chunk.content;
        onChunk(chunk.content);
      } else if (chunk.type === 'done') {
        responseId = chunk.id;
      }
    }

    return {
      id: responseId || '',
      text: fullText,
    };
  }

  private buildRequestBody(options: GenerateOptions): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.options.model,
      input: options.input,
    };

    // Add reasoning configuration
    if (this.options.reasoning) {
      body.reasoning = this.options.reasoning;
    }

    // Add text/verbosity configuration
    if (this.options.text) {
      body.text = this.options.text;
    }

    // Temperature only works with reasoning.effort: 'none'
    if (this.options.temperature !== undefined && 
        (!this.options.reasoning?.effort || this.options.reasoning.effort === 'none')) {
      body.temperature = this.options.temperature;
    }

    // Max output tokens
    if (this.options.maxOutputTokens) {
      body.max_output_tokens = this.options.maxOutputTokens;
    }

    // Chain-of-thought persistence
    if (options.previousResponseId) {
      body.previous_response_id = options.previousResponseId;
    }

    // Streaming
    if (options.stream) {
      body.stream = true;
    }

    return body;
  }

  private parseResponse(data: Record<string, unknown>): ResponseResult {
    // The Responses API returns output in a different format
    const output = data.output as Array<{ type: string; content?: Array<{ type: string; text?: string }> }> | undefined;
    
    let text = '';
    if (output) {
      for (const item of output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.text) {
              text += content.text;
            }
          }
        }
      }
    }

    // Fallback to legacy format if needed
    if (!text && typeof data.output === 'string') {
      text = data.output;
    }

    const usage = data.usage as { reasoning_tokens?: number; output_tokens?: number } | undefined;

    return {
      id: data.id as string || '',
      text,
      reasoningTokens: usage?.reasoning_tokens,
      outputTokens: usage?.output_tokens,
    };
  }
}

/**
 * Helper function for simple text generation
 */
export async function generateResponse(options: {
  model: string;
  prompt: string;
  reasoning?: { effort?: ReasoningEffort };
  text?: { verbosity?: Verbosity };
  temperature?: number;
  previousResponseId?: string;
}): Promise<ResponseResult> {
  const client = new ResponsesAPIClient({
    model: options.model,
    reasoning: options.reasoning,
    text: options.text,
    temperature: options.temperature,
  });

  return client.generateText(options.prompt, options.previousResponseId);
}

/**
 * Helper function for streaming text generation
 */
export async function streamResponse(options: {
  model: string;
  prompt: string;
  reasoning?: { effort?: ReasoningEffort };
  text?: { verbosity?: Verbosity };
  temperature?: number;
  previousResponseId?: string;
  onChunk: (chunk: string) => void;
}): Promise<ResponseResult> {
  const client = new ResponsesAPIClient({
    model: options.model,
    reasoning: options.reasoning,
    text: options.text,
    temperature: options.temperature,
  });

  return client.streamText(options.prompt, options.onChunk, options.previousResponseId);
}

/**
 * Create a reusable client instance
 */
export function createResponsesClient(options: ResponsesAPIOptions): ResponsesAPIClient {
  return new ResponsesAPIClient(options);
}



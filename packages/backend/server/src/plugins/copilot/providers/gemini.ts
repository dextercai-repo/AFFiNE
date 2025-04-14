import {
  createGoogleGenerativeAI,
  type GoogleGenerativeAIProvider,
} from '@ai-sdk/google';
import {
  AISDKError,
  generateObject,
  generateText,
  JSONParseError,
  streamText,
} from 'ai';

import {
  CopilotPromptInvalid,
  CopilotProviderSideError,
  metrics,
  UserFriendlyError,
} from '../../../base';
import { CopilotProvider } from './provider';
import type {
  CopilotChatOptions,
  CopilotImageOptions,
  ModelConditions,
  ModelFullConditions,
  PromptMessage,
} from './types';
import {
  ChatMessageRole,
  CopilotProviderType,
  ModelInputType,
  ModelOutputType,
} from './types';
import { chatToGPTMessage } from './utils';

export const DEFAULT_DIMENSIONS = 256;

export type GeminiConfig = {
  apiKey: string;
  baseUrl?: string;
};

export class GeminiProvider extends CopilotProvider<GeminiConfig> {
  override readonly type = CopilotProviderType.Gemini;

  readonly models = [
    {
      name: 'Gemini 2.0 Flash',
      id: 'gemini-2.0-flash-001',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
          ],
          output: [ModelOutputType.Text, ModelOutputType.Structured],
          defaultForOutputType: true,
        },
      ],
    },
    {
      name: 'Gemini 2.5 Pro',
      id: 'gemini-2.5-pro-preview-03-25',
      capabilities: [
        {
          input: [
            ModelInputType.Text,
            ModelInputType.Image,
            ModelInputType.Audio,
          ],
          output: [ModelOutputType.Text, ModelOutputType.Structured],
        },
      ],
    },
    {
      name: 'Text Embedding 004',
      id: 'text-embedding-004',
      capabilities: [
        {
          input: [ModelInputType.Text],
          output: [ModelOutputType.Embedding],
        },
      ],
    },
  ];

  #instance!: GoogleGenerativeAIProvider;

  override configured(): boolean {
    return !!this.config.apiKey;
  }

  protected override setup() {
    super.setup();
    this.#instance = createGoogleGenerativeAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
    });
  }

  protected async checkParams({
    cond,
    messages,
    embeddings,
  }: {
    cond: ModelFullConditions;
    messages?: PromptMessage[];
    embeddings?: string[];
    options?: CopilotChatOptions;
  }) {
    if (!(await this.isModelAvailable(cond))) {
      throw new CopilotPromptInvalid(`Invalid model: ${cond.modelId}`);
    }
    if (Array.isArray(messages) && messages.length > 0) {
      if (
        messages.some(
          m =>
            // check non-object
            typeof m !== 'object' ||
            !m ||
            // check content
            typeof m.content !== 'string' ||
            // content and attachments must exist at least one
            ((!m.content || !m.content.trim()) &&
              (!Array.isArray(m.attachments) || !m.attachments.length))
        )
      ) {
        throw new CopilotPromptInvalid('Empty message content');
      }
      if (
        messages.some(
          m =>
            typeof m.role !== 'string' ||
            !m.role ||
            !ChatMessageRole.includes(m.role)
        )
      ) {
        throw new CopilotPromptInvalid('Invalid message role');
      }
    } else if (
      Array.isArray(embeddings) &&
      embeddings.some(e => typeof e !== 'string' || !e || !e.trim())
    ) {
      throw new CopilotPromptInvalid('Invalid embedding');
    }
  }

  private handleError(e: any) {
    if (e instanceof UserFriendlyError) {
      return e;
    } else if (e instanceof AISDKError) {
      this.logger.error('Throw error from ai sdk:', e);
      return new CopilotProviderSideError({
        provider: this.type,
        kind: e.name || 'unknown',
        message: e.message,
      });
    } else {
      return new CopilotProviderSideError({
        provider: this.type,
        kind: 'unexpected_response',
        message: e?.message || 'Unexpected google response',
      });
    }
  }

  override async text(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ cond: fullCond, messages, options });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs] = await chatToGPTMessage(messages);

      const modelInstance = this.#instance(model.id, {
        structuredOutputs: Boolean(
          'jsonMode' in options ? options.jsonMode : false
        ),
      });
      const { text } = await generateText({
        model: modelInstance,
        system,
        messages: msgs,
        abortSignal: options.signal,
      });

      if (!text) throw new Error('Failed to generate text');
      return text.trim();
    } catch (e: any) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e);
    }
  }

  override async structure(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions = {}
  ): Promise<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Structured };
    await this.checkParams({ cond: fullCond, messages });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_calls').add(1, { model: model.id });

      const [system, msgs, schema] = await chatToGPTMessage(messages);
      if (!schema) {
        throw new CopilotPromptInvalid('Schema is required');
      }

      const modelInstance = this.#instance(model.id, {
        structuredOutputs: Boolean(options.jsonMode),
      });
      const { object } = await generateObject({
        model: modelInstance,
        system,
        messages: msgs,
        schema,
        abortSignal: options.signal,
        experimental_repairText: async ({ text, error }) => {
          if (error instanceof JSONParseError) {
            // strange fixed response, temporarily replace it
            const ret = text.replaceAll(/^ny\n/g, ' ').trim();
            if (ret.startsWith('```') || ret.endsWith('```')) {
              return ret
                .replace(/```[\w\s]+\n/g, '')
                .replace(/\n```/g, '')
                .trim();
            }
            return ret;
          }
          return null;
        },
      });

      return JSON.stringify(object);
    } catch (e: any) {
      metrics.ai.counter('chat_text_errors').add(1, { model: model.id });
      throw this.handleError(e);
    }
  }

  override async *streamText(
    cond: ModelConditions,
    messages: PromptMessage[],
    options: CopilotChatOptions | CopilotImageOptions = {}
  ): AsyncIterable<string> {
    const fullCond = { ...cond, outputType: ModelOutputType.Text };
    await this.checkParams({ cond: fullCond, messages });
    const model = this.selectModel(fullCond);

    try {
      metrics.ai.counter('chat_text_stream_calls').add(1, { model: model.id });
      const [system, msgs] = await chatToGPTMessage(messages);

      const { textStream } = streamText({
        model: this.#instance(model.id),
        system,
        messages: msgs,
        abortSignal: options.signal,
      });

      for await (const message of textStream) {
        if (message) {
          yield message;
          if (options.signal?.aborted) {
            await textStream.cancel();
            break;
          }
        }
      }
    } catch (e: any) {
      metrics.ai.counter('chat_text_stream_errors').add(1, { model: model.id });
      throw this.handleError(e);
    }
  }
}

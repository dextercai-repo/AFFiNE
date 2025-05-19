import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  Config,
  CopilotPromptInvalid,
  CopilotProviderNotSupported,
  OnEvent,
} from '../../../base';
import { CopilotProviderFactory } from './factory';
import {
  type CopilotChatOptions,
  type CopilotEmbeddingOptions,
  type CopilotImageOptions,
  CopilotProviderModel,
  CopilotProviderType,
  CopilotStructuredOptions,
  ModelCapability,
  ModelConditions,
  ModelFullConditions,
  type PromptMessage,
} from './types';

@Injectable()
export abstract class CopilotProvider<C = any> {
  protected readonly logger = new Logger(this.constructor.name);
  abstract readonly type: CopilotProviderType;
  abstract readonly models: CopilotProviderModel[];
  abstract configured(): boolean;

  @Inject() protected readonly AFFiNEConfig!: Config;
  @Inject() protected readonly factory!: CopilotProviderFactory;

  get config(): C {
    return this.AFFiNEConfig.copilot.providers[this.type] as C;
  }

  @OnEvent('config.init')
  async onConfigInit() {
    this.setup();
  }

  @OnEvent('config.changed')
  async onConfigChanged(event: Events['config.changed']) {
    if ('copilot' in event.updates) {
      this.setup();
    }
  }

  protected setup() {
    if (this.configured()) {
      this.factory.register(this);
    } else {
      this.factory.unregister(this);
    }
  }

  private findValidModel(
    cond: ModelFullConditions
  ): CopilotProviderModel | undefined {
    const { modelId, outputType, inputType } = cond;
    const matcher = (cap: ModelCapability) =>
      (!outputType || cap.output.includes(outputType)) &&
      (!inputType || cap.input.includes(inputType));

    if (modelId) {
      return this.models.find(
        m => m.id === modelId && m.capabilities.some(matcher)
      );
    }
    if (!outputType) return undefined;

    return this.models.find(m =>
      m.capabilities.some(c => matcher(c) && c.defaultForOutputType)
    );
  }

  // make it async to allow dynamic check available models in some providers
  async match(cond: ModelFullConditions = {}): Promise<boolean> {
    return this.configured() && !!this.findValidModel(cond);
  }

  protected selectModel(cond: ModelFullConditions): CopilotProviderModel {
    const model = this.findValidModel(cond);
    if (model) return model;

    const { modelId, outputType, inputType } = cond;
    throw new CopilotPromptInvalid(
      modelId
        ? `Model ${modelId} does not support ${outputType ?? '<any>'} output with ${inputType ?? '<any>'} input`
        : outputType
          ? `No model supports ${outputType} output with ${inputType ?? '<any>'} input for provider ${this.type}`
          : 'Output type is required when modelId is not provided'
    );
  }

  abstract text(
    model: ModelConditions,
    messages: PromptMessage[],
    options?: CopilotChatOptions
  ): Promise<string>;

  abstract streamText(
    model: ModelConditions,
    messages: PromptMessage[],
    options?: CopilotChatOptions
  ): AsyncIterable<string>;

  structure(
    _cond: ModelConditions,
    _messages: PromptMessage[],
    _options: CopilotStructuredOptions
  ): Promise<string> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'structure',
    });
  }

  streamImages(
    _model: ModelConditions,
    _messages: PromptMessage[],
    _options?: CopilotImageOptions
  ): AsyncIterable<string> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'image',
    });
  }

  embedding(
    _model: ModelConditions,
    _text: string,
    _options?: CopilotEmbeddingOptions
  ): Promise<number[][]> {
    throw new CopilotProviderNotSupported({
      provider: this.type,
      kind: 'embedding',
    });
  }
}

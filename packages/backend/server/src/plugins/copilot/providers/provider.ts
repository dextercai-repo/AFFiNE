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
  ModelInputType,
  ModelOutputType,
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

  isModelAvailable(
    conditions: ModelFullConditions = {}
  ): Promise<boolean> | boolean {
    const { modelId, outputType, inputType } = conditions;
    if (!this.configured()) {
      return false;
    }

    if (modelId) {
      const foundModel = this.models.find(m => m.id === modelId);
      if (!foundModel) {
        return false;
      }

      return foundModel.capabilities.some(
        cap =>
          (!outputType || cap.output.includes(outputType)) &&
          (!inputType || cap.input.includes(inputType))
      );
    }

    if (outputType) {
      return this.models.some(model =>
        model.capabilities.some(
          cap =>
            cap.output.includes(outputType) &&
            (!inputType || cap.input.includes(inputType))
        )
      );
    }

    return false;
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

  getModelsByOutputType(outputType: ModelOutputType): CopilotProviderModel[] {
    return this.models.filter(model =>
      model.capabilities.some(cap => cap.output.includes(outputType))
    );
  }

  getDefaultModelForOutputType(
    outputType: ModelOutputType,
    inputType?: ModelInputType
  ): CopilotProviderModel | undefined {
    // find the default model that matches both output type and input type
    if (inputType) {
      const modelWithInputType = this.models.find(model =>
        model.capabilities.some(
          cap =>
            cap.output.includes(outputType) &&
            cap.defaultForOutputType === true &&
            cap.input.includes(inputType)
        )
      );

      if (modelWithInputType) {
        return modelWithInputType;
      }
    }

    // if no input type is specified, find the default model for the outputType
    const defaultModel = this.models.find(model =>
      model.capabilities.some(
        cap =>
          cap.output.includes(outputType) && cap.defaultForOutputType === true
      )
    );

    if (defaultModel) {
      return defaultModel;
    }

    // if no default model is found, return the first model that supports the outputType
    // this is a fallback and may not be the intended behavior
    const firstSupportingModel = this.getModelsByOutputType(outputType)[0];
    return firstSupportingModel;
  }

  protected validateModelOutputType(
    model: CopilotProviderModel,
    outputType?: ModelOutputType,
    inputType?: ModelInputType
  ): ModelCapability | undefined {
    if (!outputType && !inputType) {
      return model.capabilities[0];
    }

    const matchingCapability = model.capabilities.find(
      cap =>
        (!outputType || cap.output.includes(outputType)) &&
        (!inputType || cap.input.includes(inputType))
    );

    if (!matchingCapability) {
      throw new CopilotPromptInvalid(
        `Model ${model.id} does not support ${outputType} output type with ${inputType} input type`
      );
    }

    return matchingCapability;
  }

  protected selectModel(cond: ModelFullConditions): CopilotProviderModel {
    if (cond.modelId) {
      const model = this.models.find(m => m.id === cond.modelId);
      if (!model) {
        throw new CopilotPromptInvalid(
          `Model ${cond.modelId} not found for provider ${this.type}`
        );
      }

      this.validateModelOutputType(model, cond.outputType, cond.inputType);
      return model;
    }

    if (!cond.outputType) {
      throw new CopilotPromptInvalid(
        `Output type is required when modelId is not provided`
      );
    }

    const defaultModel = this.getDefaultModelForOutputType(
      cond.outputType,
      cond.inputType
    );
    if (!defaultModel) {
      throw new CopilotPromptInvalid(
        `No model found supporting ${cond.outputType} output type with ${cond.inputType} input type for provider ${this.type}`
      );
    }

    return defaultModel;
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

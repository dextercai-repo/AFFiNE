import { Injectable, Logger } from '@nestjs/common';

import { ServerFeature, ServerService } from '../../../core';
import type { CopilotProvider } from './provider';
import { CopilotProviderType, ModelInputType, ModelOutputType } from './types';

@Injectable()
export class CopilotProviderFactory {
  constructor(private readonly server: ServerService) {}

  private readonly logger = new Logger(CopilotProviderFactory.name);

  readonly #providers = new Map<CopilotProviderType, CopilotProvider>();

  async getProvider(
    outputType: ModelOutputType,
    inputType: ModelInputType = ModelInputType.Text,
    filter: {
      model?: string;
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<CopilotProvider | null> {
    this.logger.debug(
      `Resolving copilot provider for output type: ${outputType}`
    );
    let candidate: CopilotProvider | null = null;
    for (const [type, provider] of this.#providers.entries()) {
      if (filter.prefer && filter.prefer !== type) {
        continue;
      }

      const isMatched = await provider.match({
        modelId: filter.model,
        outputType,
        inputType,
      });

      if (isMatched) {
        candidate = provider;
        this.logger.debug(`Copilot provider candidate found: ${type}`);
        break;
      }
    }

    return candidate;
  }

  async getProviderByModel(
    modelId: string,
    filter: {
      prefer?: CopilotProviderType;
    } = {}
  ): Promise<CopilotProvider | null> {
    this.logger.debug(`Resolving copilot provider for model: ${modelId}`);

    let candidate: CopilotProvider | null = null;
    for (const [type, provider] of this.#providers.entries()) {
      if (filter.prefer && filter.prefer !== type) {
        continue;
      }

      if (await provider.match({ modelId })) {
        candidate = provider;
        this.logger.debug(`Copilot provider candidate found: ${type}`);
      }
    }

    return candidate;
  }

  register(provider: CopilotProvider) {
    this.#providers.set(provider.type, provider);
    this.logger.log(`Copilot provider [${provider.type}] registered.`);
    this.server.enableFeature(ServerFeature.Copilot);
  }

  unregister(provider: CopilotProvider) {
    this.#providers.delete(provider.type);
    this.logger.log(`Copilot provider [${provider.type}] unregistered.`);
    if (this.#providers.size === 0) {
      this.server.disableFeature(ServerFeature.Copilot);
    }
  }
}

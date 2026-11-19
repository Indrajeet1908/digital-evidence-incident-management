import config from '../../config/environment';
import { AIProvider } from './ai-provider.interface';
import { MockAIProvider } from './mock-ai.provider';
import { GeminiAIProvider } from './gemini-ai.provider';
import { OpenAIProvider } from './openai-ai.provider';
import { AppError } from '../../utils/errors';

let activeProvider: AIProvider | null = null;

/**
 * Factory function to retrieve or instantiate the configured AI Provider.
 * Allows programmatic override in automated test suites without exposing secrets.
 */
export function getAIProvider(
  providerOrOverride?: string | AIProvider,
  overrideProvider?: AIProvider
): AIProvider {
  // If called as getAIProvider(new MockAIProvider()) or overrideProvider passed
  if (overrideProvider) {
    activeProvider = overrideProvider;
    return activeProvider;
  }

  if (typeof providerOrOverride === 'object' && providerOrOverride !== null && 'analyzeEvidence' in providerOrOverride) {
    activeProvider = providerOrOverride as AIProvider;
    return activeProvider;
  }

  // If a test override has been explicitly registered, return it
  if (activeProvider) {
    return activeProvider;
  }

  const requestedProvider = typeof providerOrOverride === 'string' ? providerOrOverride : undefined;
  const providerType = (requestedProvider || config.aiProvider).toLowerCase();

  switch (providerType) {
    case 'mock':
      return new MockAIProvider();

    case 'gemini':
      if (!config.geminiApiKey) {
        throw new AppError(
          'Gemini AI provider is selected but GEMINI_API_KEY environment variable is not configured.',
          400
        );
      }
      return new GeminiAIProvider(config.geminiApiKey, config.geminiModel);

    case 'openai':
      if (!config.openaiApiKey) {
        throw new AppError(
          'OpenAI provider is selected but OPENAI_API_KEY environment variable is not configured.',
          400
        );
      }
      return new OpenAIProvider(config.openaiApiKey, config.openaiModel);

    default:
      throw new AppError(
        `Unsupported AI provider: ${providerType}. Valid options are: gemini, openai.`,
        400
      );
  }
}

/**
 * Reset active provider instance (used during testing).
 */
export function resetAIProvider(): void {
  activeProvider = null;
}

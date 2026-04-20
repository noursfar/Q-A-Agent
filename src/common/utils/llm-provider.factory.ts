import { ConfigService } from '@nestjs/config';
import { createMistral } from '@ai-sdk/mistral';
//import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { LanguageModel } from 'ai';

/**
 * Factory to create the LLM Provider model instance.
 * We use an agnostic return type (LanguageModel) so that the application
 * logic never needs to know which underlying provider is being used.
 *
 * To swap providers, just change the code below.
 */
export function createLlmModel(configService: ConfigService): LanguageModel {
  // ─── OpenRouter (Default) ────────────────────────────────────────────────────
  // const openrouter = createOpenRouter({
  //   apiKey: configService.get<string>('OPENROUTER_API_KEY'),
  // });
  // return openrouter.chat(configService.get<string>('OPENROUTER_MODEL')!);

  // ─── Mistral (Alternative) ───────────────────────────────────────────────────
  const mistral = createMistral({
    apiKey: configService.get<string>('MISTRAL_API_KEY'),
  });
  return mistral(configService.get<string>('MISTRAL_MODEL')!);
}

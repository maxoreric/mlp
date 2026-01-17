/**
 * Translation Service Entry Point
 * Provides unified interface for all translation adapters
 */

import { TranslationAdapter, TranslationError } from './adapter.interface'
import { GoogleTranslateAdapter } from './google'
import { OpenAIAdapter, OpenAIConfig } from './openai'
import { ZaiClaudeAdapter, ZaiClaudeConfig } from './zai-claude'
import { ExtensionConfig } from '@/types/config'
/**
 * Get adapter instance based on service config
 */
function getAdapter(config: ExtensionConfig): TranslationAdapter {
    const serviceConfig = config.translationService

    const promptConfig = {
        customPrompts: config.customPrompts,
        activePromptId: config.activePromptId
    }

    switch (serviceConfig.type) {
        case 'openai':
        case 'z-ai':
        case 'custom':
            if (!serviceConfig.apiKey) {
                throw new TranslationError('API key is required for OpenAI/Custom service')
            }
            return new OpenAIAdapter({
                apiKey: serviceConfig.apiKey,
                endpoint: serviceConfig.endpoint,
                model: serviceConfig.model,
                ...promptConfig
            } as OpenAIConfig)

        case 'zai-claude':
            if (!serviceConfig.apiKey) {
                throw new TranslationError('API key is required for Z.AI Claude service')
            }
            return new ZaiClaudeAdapter({
                apiKey: serviceConfig.apiKey,
                model: serviceConfig.model || 'glm-4.7',
                endpoint: serviceConfig.endpoint,
                ...promptConfig
            } as ZaiClaudeConfig)

        case 'google':
        default:
            return new GoogleTranslateAdapter()
    }
}

/**
 * Translate texts with retry and fallback logic
 */
export async function translateWithAdapter(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    config: ExtensionConfig,
    retryConfig?: { maxRetries: number; retryDelay: number }
): Promise<string[]> {
    const adapter = getAdapter(config)

    // Default values if not provided
    const maxRetries = retryConfig?.maxRetries ?? config.maxRetries ?? 3
    const retryDelay = retryConfig?.retryDelay ?? config.retryDelay ?? 1000

    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await adapter.translate(texts, sourceLang, targetLang)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (error instanceof TranslationError && !error.retryable) {
                throw error
            }

            // Exponential backoff
            if (attempt < maxRetries - 1) {
                await sleep(retryDelay * Math.pow(2, attempt))
            }
        }
    }

    throw lastError || new TranslationError('Translation failed after retries')
}

/**
 * Streaming translation - only works with ZaiClaudeAdapter
 */
export async function translateStreamWithAdapter(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    config: ExtensionConfig,
    onChunk: (index: number, translation: string) => void
): Promise<void> {
    // Streaming only supported for zai-claude
    const adapter = getAdapter(config)

    // Check if adapter supports streaming
    if (adapter.translateStream) {
        await adapter.translateStream(texts, sourceLang, targetLang, onChunk)
        return
    }

    // Fallback to batch translation
    try {
        const results = await translateWithAdapter(texts, sourceLang, targetLang, config)
        results.forEach((result, index) => onChunk(index, result))
    } catch (error) {
        throw error
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}


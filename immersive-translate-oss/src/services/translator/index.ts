/**
 * Translation Service Entry Point
 * Provides unified interface for all translation adapters
 */

import { TranslationAdapter, TranslationError } from './adapter.interface'
import { GoogleTranslateAdapter } from './google'
import { OpenAIAdapter, OpenAIConfig } from './openai'
import { ZaiClaudeAdapter, ZaiClaudeConfig } from './zai-claude'
import { TranslationServiceConfig } from '@/types/config'

export type { TranslationAdapter, TranslationError }

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000

/**
 * Get adapter instance based on service config
 */
function getAdapter(config: TranslationServiceConfig): TranslationAdapter {
    switch (config.type) {
        case 'openai':
        case 'z-ai':
        case 'custom':
            if (!config.apiKey) {
                throw new TranslationError('API key is required for OpenAI/Custom service')
            }
            return new OpenAIAdapter({
                apiKey: config.apiKey,
                endpoint: config.endpoint,
                model: config.model,
            } as OpenAIConfig)

        case 'zai-claude':
            if (!config.apiKey) {
                throw new TranslationError('API key is required for Z.AI Claude service')
            }
            return new ZaiClaudeAdapter({
                apiKey: config.apiKey,
                model: config.model || 'glm-4.7',
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
    serviceConfig: TranslationServiceConfig
): Promise<string[]> {
    const adapter = getAdapter(serviceConfig)

    let lastError: Error | null = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            return await adapter.translate(texts, sourceLang, targetLang)
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error))

            if (error instanceof TranslationError && !error.retryable) {
                throw error
            }

            // Exponential backoff
            if (attempt < MAX_RETRIES - 1) {
                await sleep(RETRY_DELAY_MS * Math.pow(2, attempt))
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
    serviceConfig: TranslationServiceConfig,
    onChunk: (index: number, translation: string) => void
): Promise<void> {
    // Streaming only supported for zai-claude
    const adapter = getAdapter(serviceConfig)

    // Check if adapter supports streaming
    if (adapter.translateStream) {
        await adapter.translateStream(texts, sourceLang, targetLang, onChunk)
        return
    }

    // Fallback to batch translation
    try {
        const results = await translateWithAdapter(texts, sourceLang, targetLang, serviceConfig)
        results.forEach((result, index) => onChunk(index, result))
    } catch (error) {
        throw error
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}


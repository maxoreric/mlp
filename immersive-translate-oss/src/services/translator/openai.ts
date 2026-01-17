/**
 * OpenAI Compatible Adapter
 * Supports OpenAI, DeepSeek, GLM, and other OpenAI-compatible APIs
 */

import { TranslationAdapter, TranslationError } from './adapter.interface'

export interface OpenAIConfig {
    apiKey: string
    endpoint?: string  // Default: https://api.openai.com/v1
    model?: string     // Default: gpt-3.5-turbo
}

export class OpenAIAdapter implements TranslationAdapter {
    providerId = 'openai'

    private config: OpenAIConfig

    constructor(config: OpenAIConfig) {
        this.config = {
            endpoint: 'https://api.openai.com/v1',
            model: 'gpt-3.5-turbo',
            ...config,
        }
    }

    async translate(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        const isSenseMode = texts.some(t => t.startsWith('[SENSE_MODE]'));
        const cleanTexts = isSenseMode ? texts.map(t => t.replace('[SENSE_MODE]', '')) : texts;
        const prompt = this.buildPrompt(cleanTexts, sourceLang, targetLang)

        const systemContent = isSenseMode
            ? `You are an expert language tutor. Analyze the following English sentences. 
               1. Split each sentence into logical sense groups based heavily on PREPOSITIONS (in, on, at, with, by, to...) and conjunctions.
               2. Translate each sense group into ${targetLang}.
               3. Return a JSON array of arrays (one inner array per input sentence).
               4. Format: [[{"src": "part1", "tgt": "trans1"}, ...], [...]]
               5. STRICT JSON OUTPUT ONLY.`
            : `You are a professional translator. Translate the following JSON array of text segments from ${sourceLang} to ${targetLang}. Keep the JSON structure unchanged. Return ONLY the JSON array with translated texts, no explanation.`;

        try {
            const response = await fetch(
                `${this.config.endpoint}/chat/completions`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.config.apiKey}`,
                    },
                    body: JSON.stringify({
                        model: this.config.model,
                        messages: [
                            {
                                role: 'system',
                                content: systemContent,
                            },
                            {
                                role: 'user',
                                content: prompt,
                            },
                        ],
                        temperature: 0,
                    }),
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new TranslationError(
                    `OpenAI error: ${errorData.error?.message || response.statusText}`,
                    response.status === 429 || response.status >= 500,
                    response.status
                )
            }

            const data = await response.json()
            const content = data.choices?.[0]?.message?.content

            if (!content) {
                throw new TranslationError('Empty response from OpenAI')
            }

            return this.parseResponse(content, cleanTexts.length, isSenseMode)
        } catch (error) {
            if (error instanceof TranslationError) throw error
            throw new TranslationError(
                `OpenAI request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true
            )
        }
    }

    private buildPrompt(
        texts: string[],
        _sourceLang: string,
        _targetLang: string
    ): string {
        return JSON.stringify(texts)
    }

    private parseResponse(content: string, expectedCount: number, isSenseMode = false): string[] {
        try {
            // Try to extract JSON array from the response
            const jsonMatch = content.match(/\[[\s\S]*\]/)
            if (!jsonMatch) {
                throw new Error('No JSON array found in response')
            }

            const parsed = JSON.parse(jsonMatch[0])

            if (!Array.isArray(parsed) || parsed.length !== expectedCount) {
                // In sense mode, if length mismatch, we might return raw content or error
                // But generally prompt should be obeyed
                throw new Error('Response array length mismatch')
            }

            if (isSenseMode) {
                // For sense mode, we return the JSON string representation of each inner array
                // The shadow DOM is responsible for parsing it back
                return parsed.map(item => JSON.stringify(item))
            }

            return parsed.map(String)
        } catch {
            throw new TranslationError(
                `Failed to parse OpenAI response: ${content.substring(0, 100)}`
            )
        }
    }

    async validateConfig(config: unknown): Promise<boolean> {
        const { apiKey, endpoint } = config as OpenAIConfig

        if (!apiKey || typeof apiKey !== 'string') {
            return false
        }

        // Test the API with a simple request
        try {
            const testEndpoint = endpoint || 'https://api.openai.com/v1'
            const response = await fetch(`${testEndpoint}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            })

            return response.ok
        } catch {
            return false
        }
    }
}

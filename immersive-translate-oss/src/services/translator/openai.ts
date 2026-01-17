import { TranslationAdapter, TranslationError } from './adapter.interface'
import { PromptTemplate, ExtensionConfig } from '@/types/config'
import { getActivePrompt, renderPrompt } from './prompts'

export interface OpenAIConfig {
    apiKey: string
    endpoint?: string  // Default: https://api.openai.com/v1
    model?: string     // Default: gpt-3.5-turbo
    customPrompts?: PromptTemplate[]
    activePromptId?: string
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

        // Resolve generic config for prompt helper
        const mockConfig = {
            customPrompts: this.config.customPrompts || [],
            activePromptId: this.config.activePromptId || 'default-normal'
        } as ExtensionConfig

        const promptTemplate = getActivePrompt(mockConfig, isSenseMode ? 'sense' : 'normal')
        const systemContent = renderPrompt(promptTemplate.system, sourceLang, targetLang)

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

    /**
     * Streaming translation - calls onChunk as each translation is ready
     */
    async translateStream(
        texts: string[],
        sourceLang: string,
        targetLang: string,
        onChunk: (index: number, translation: string) => void
    ): Promise<void> {
        const isSenseMode = texts.some(t => t.startsWith('[SENSE_MODE]'));
        const cleanTexts = isSenseMode ? texts.map(t => t.replace('[SENSE_MODE]', '')) : texts;

        // Resolve generic config for prompt helper
        const mockConfig = {
            customPrompts: this.config.customPrompts || [],
            activePromptId: this.config.activePromptId || 'default-normal'
        } as ExtensionConfig

        const promptTemplate = getActivePrompt(mockConfig, isSenseMode ? 'sense' : 'normal')
        const systemContent = renderPrompt(promptTemplate.system, sourceLang, targetLang)

        const prompt = JSON.stringify(cleanTexts);

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
                            { role: 'system', content: systemContent },
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0,
                        stream: true
                    }),
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new TranslationError(
                    `OpenAI stream error: ${errorData.error?.message || response.statusText}`,
                    response.status === 429 || response.status >= 500,
                    response.status
                )
            }

            // Parse SSE stream
            const reader = response.body?.getReader()
            if (!reader) throw new TranslationError('No response body')

            const decoder = new TextDecoder()
            let buffer = ''
            let lineIndex = 0
            let accumulatedText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })
                const lines = buffer.split('\n')
                buffer = lines.pop() || ''

                for (const line of lines) {
                    if (line.trim().startsWith('data: ')) {
                        const data = line.trim().slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const event = JSON.parse(data)
                            const delta = event.choices?.[0]?.delta?.content || ''

                            if (delta) {
                                accumulatedText += delta

                                // Process complete lines
                                const textLines = accumulatedText.split('\n')
                                while (textLines.length > 1 && lineIndex < cleanTexts.length) {
                                    const completeLine = textLines.shift()!.trim()
                                    if (completeLine) {
                                        onChunk(lineIndex, completeLine)
                                        lineIndex++
                                    }
                                }
                                accumulatedText = textLines.join('\n')
                            }
                        } catch {
                            // Skip malformed chunks
                        }
                    }
                }
            }

            // Handle remaining text
            if (accumulatedText.trim() && lineIndex < cleanTexts.length) {
                const remainingLines = accumulatedText.split('\n')
                for (const line of remainingLines) {
                    if (line.trim() && lineIndex < cleanTexts.length) {
                        onChunk(lineIndex, line.trim())
                        lineIndex++
                    }
                }
            }

        } catch (error) {
            if (error instanceof TranslationError) throw error
            throw new TranslationError(
                `OpenAI streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true
            )
        }
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

import { TranslationAdapter, TranslationError } from './adapter.interface'
import { PromptTemplate, ExtensionConfig } from '@/types/config'
import { getActivePrompt, renderPrompt } from './prompts'

export interface ZaiClaudeConfig {
    apiKey: string
    model?: string  // Default: glm-4.7 (Z.AI Coding Plan uses GLM models via Anthropic API)
    endpoint?: string
    customPrompts?: PromptTemplate[]
    activePromptId?: string
}

export class ZaiClaudeAdapter implements TranslationAdapter {
    providerId = 'zai-claude'

    private config: ZaiClaudeConfig

    constructor(config: ZaiClaudeConfig) {
        this.config = {
            model: 'glm-4.7',
            endpoint: 'https://api.z.ai/api/anthropic/v1/messages',
            ...config,
        }
    }

    async translate(
        texts: string[],
        _sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        const isSenseMode = texts.some(t => t.startsWith('[SENSE_MODE]'));
        const cleanTexts = isSenseMode ? texts.map(t => t.replace('[SENSE_MODE]', '')) : texts;

        // Resolve generic config for prompt helper
        const mockConfig = {
            customPrompts: this.config.customPrompts || [],
            activePromptId: this.config.activePromptId || 'default-normal'
        } as ExtensionConfig

        const promptTemplate = getActivePrompt(mockConfig, isSenseMode ? 'sense' : 'normal')
        const systemPrompt = renderPrompt(promptTemplate.system, _sourceLang, targetLang)

        const userMessage = JSON.stringify(cleanTexts);

        try {
            const response = await fetch(this.config.endpoint!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: 4096,
                    system: systemPrompt,
                    messages: [
                        {
                            role: 'user',
                            content: userMessage,
                        },
                    ],
                }),
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                const errorMessage = errorData.error?.message || `HTTP ${response.status}`
                throw new TranslationError(
                    `Z.AI Claude error: ${errorMessage}`,
                    response.status === 429,
                    response.status
                )
            }

            const data = await response.json()
            return this.parseResponse(data, cleanTexts.length, isSenseMode)
        } catch (error) {
            if (error instanceof TranslationError) throw error
            throw new TranslationError(
                `Z.AI Claude request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true
            )
        }
    }

    /**
     * Streaming translation - calls onChunk as each translation is ready
     */
    async translateStream(
        texts: string[],
        _sourceLang: string,
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
        const systemPrompt = renderPrompt(promptTemplate.system, _sourceLang, targetLang)

        try {
            const response = await fetch(this.config.endpoint!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': '2023-06-01',
                },
                body: JSON.stringify({
                    model: this.config.model,
                    max_tokens: 8192,
                    stream: true,
                    system: systemPrompt,
                    messages: [{ role: 'user', content: JSON.stringify(cleanTexts) }],
                }),
            })

            if (!response.ok) {
                throw new TranslationError(`Z.AI Claude stream error: ${response.status}`)
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
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6)
                        if (data === '[DONE]') continue

                        try {
                            const event = JSON.parse(data)
                            const delta = event.delta?.text || ''
                            accumulatedText += delta

                            // Check for complete lines (newline separated)
                            const textLines = accumulatedText.split('\n')
                            while (textLines.length > 1 && lineIndex < cleanTexts.length) {
                                const completeLine = textLines.shift()!.trim()
                                if (completeLine) {
                                    onChunk(lineIndex, completeLine)
                                    lineIndex++
                                }
                            }
                            accumulatedText = textLines.join('\n')
                        } catch {
                            // Skip malformed JSON
                        }
                    }
                }
            }

            // Handle remaining text
            if (accumulatedText.trim() && lineIndex < cleanTexts.length) {
                for (const line of accumulatedText.split('\n')) {
                    if (line.trim() && lineIndex < cleanTexts.length) {
                        onChunk(lineIndex, line.trim())
                        lineIndex++
                    }
                }
            }
        } catch (error) {
            if (error instanceof TranslationError) throw error
            throw new TranslationError(
                `Z.AI Claude stream failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true
            )
        }
    }

    private parseResponse(data: any, expectedCount: number, isSenseMode: boolean): string[] {
        // Anthropic response format: { content: [{ type: 'text', text: '...' }] }
        let content = data.content?.[0]?.text
        if (!content) {
            throw new TranslationError('Empty response from Z.AI Claude')
        }

        // Clean up LLM output: extract JSON from markdown code blocks if present
        content = this.extractJson(content)

        try {
            const parsed = JSON.parse(content)

            if (isSenseMode) {
                // Sense mode: [[{src, tgt}, ...], [...]]
                // Flatten to stringified JSON per sentence
                if (Array.isArray(parsed)) {
                    return parsed.map((sentenceGroups: any) => JSON.stringify(sentenceGroups))
                }
            } else {
                // Normal mode: ["translation1", "translation2", ...]
                if (Array.isArray(parsed) && parsed.length === expectedCount) {
                    return parsed
                }
                // If length mismatch, try to return what we got
                if (Array.isArray(parsed)) {
                    return parsed.map(String)
                }
            }
        } catch {
            // If JSON parse fails, return raw content split by lines (fallback)
            return content.split('\n').filter((s: string) => s.trim())
        }

        throw new TranslationError('Invalid response format from Z.AI Claude')
    }

    /**
     * Extract JSON from LLM response that may contain markdown code blocks or extra text
     */
    private extractJson(text: string): string {
        // Remove markdown code blocks: ```json ... ``` or ``` ... ```
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) {
            return codeBlockMatch[1].trim()
        }

        // Try to find JSON array or object in the text
        const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
        if (jsonMatch) {
            return jsonMatch[1]
        }

        return text.trim()
    }

    async validateConfig(): Promise<boolean> {
        if (!this.config.apiKey) {
            return false
        }
        // Quick validation by making a minimal request
        try {
            await this.translate(['Hello'], 'en', 'zh-CN')
            return true
        } catch {
            return false
        }
    }
}

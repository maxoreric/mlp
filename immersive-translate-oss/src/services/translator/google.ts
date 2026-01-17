/**
 * Google Translate Adapter (Free API)
 * Uses the unofficial GTX endpoint
 */

import { TranslationAdapter, TranslationError } from './adapter.interface'

export class GoogleTranslateAdapter implements TranslationAdapter {
    providerId = 'google'

    private readonly endpoint = 'https://translate.googleapis.com/translate_a/single'

    async translate(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]> {
        const isSenseMode = texts.some(t => t.startsWith('[SENSE_MODE]'));
        const cleanTexts = isSenseMode ? texts.map(t => t.replace('[SENSE_MODE]', '')) : texts;

        const results: string[] = []

        for (const text of cleanTexts) {
            if (isSenseMode) {
                // Local regex segmentation
                const chunks = this.segmentSentence(text);
                const chunkTranslations = [];

                // Translate each chunk
                for (const chunk of chunks) {
                    // Adding generic catch to prevent one failed chunk from breaking the whole sentence
                    try {
                        const trans = await this.translateSingle(chunk, sourceLang, targetLang);
                        chunkTranslations.push({ src: chunk, tgt: trans });
                    } catch (e) {
                        chunkTranslations.push({ src: chunk, tgt: '...' });
                    }
                }

                // Return stringified JSON for the UI to parse
                results.push(JSON.stringify(chunkTranslations));
            } else {
                const translation = await this.translateSingle(text, sourceLang, targetLang)
                results.push(translation)
            }
        }

        return results
    }

    private segmentSentence(text: string): string[] {
        // Split before common prepositions and conjunctions
        // This is a heuristic approach for the "Free" engine
        const regex = /(?=\b(?:about|above|across|after|against|along|among|around|at|before|behind|below|beneath|beside|between|beyond|by|down|during|except|for|from|in|inside|into|like|near|of|off|on|out|outside|over|past|since|through|throughout|to|toward|under|until|up|upon|with|within|without|and|but|or|so|because|although|if|when|while)\b)/gi;

        return text.split(regex)
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    private async translateSingle(
        text: string,
        sourceLang: string,
        targetLang: string
    ): Promise<string> {
        const params = new URLSearchParams({
            client: 'gtx',
            sl: sourceLang === 'auto' ? 'auto' : sourceLang,
            tl: targetLang,
            dt: 't',
            q: text,
        })

        try {
            const response = await fetch(`${this.endpoint}?${params}`)

            if (!response.ok) {
                throw new TranslationError(
                    `Google Translate error: ${response.status}`,
                    response.status === 429, // Rate limit is retryable
                    response.status
                )
            }

            const data = await response.json()

            // Parse the response format: [[["translated text","original text",...],...],...]
            if (Array.isArray(data) && Array.isArray(data[0])) {
                const translatedParts = data[0]
                    .filter((part: unknown) => Array.isArray(part) && part[0])
                    .map((part: unknown[]) => part[0])

                return translatedParts.join('')
            }

            throw new TranslationError('Invalid response format from Google Translate')
        } catch (error) {
            if (error instanceof TranslationError) throw error
            throw new TranslationError(
                `Google Translate request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                true
            )
        }
    }

    async validateConfig(): Promise<boolean> {
        // Google free API doesn't require config
        return true
    }
}

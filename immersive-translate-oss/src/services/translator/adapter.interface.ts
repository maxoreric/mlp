/**
 * Translation Adapter Interface
 * All translation services must implement this interface
 */

export interface TranslationAdapter {
    providerId: string

    /**
     * Translate a batch of texts
     * @param texts Array of texts to translate
     * @param sourceLang Source language code (e.g., 'en', 'auto')
     * @param targetLang Target language code (e.g., 'zh-CN')
     * @returns Promise resolving to array of translated texts
     */
    translate(
        texts: string[],
        sourceLang: string,
        targetLang: string
    ): Promise<string[]>

    /**
     * Validate the adapter configuration
     * @param config Adapter-specific configuration
     * @returns Promise resolving to true if valid
     */
    validateConfig(config: unknown): Promise<boolean>
}

/**
 * Translation error with retry information
 */
export class TranslationError extends Error {
    constructor(
        message: string,
        public readonly retryable: boolean = false,
        public readonly statusCode?: number
    ) {
        super(message)
        this.name = 'TranslationError'
    }
}

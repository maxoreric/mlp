import { DubbingOptions, DEFAULT_DUBBING_OPTIONS } from '../content/video/dubbing/types'

export interface ExtensionConfig {
    enabled: boolean
    sourceLang: string
    targetLang: string
    translationService: TranslationServiceConfig
    displayStyle: DisplayStyle
    videoSubtitle: VideoSubtitleConfig
    dubbing: DubbingOptions
    siteRules: SiteRule[]
    requestBatchSize: number
    maxRetries: number
    retryDelay: number
    floatingBall: {
        position: { x: number; y: number }
    }
    customPrompts: PromptTemplate[]
    activePromptId: string // 'default-normal' | 'default-sense' | custom UUID
}

export interface PromptTemplate {
    id: string
    name: string
    type: 'normal' | 'sense'
    system: string
    user?: string
}

export type TranslationServiceType = 'google' | 'openai' | 'custom' | 'z-ai' | 'zai-claude'

export interface TranslationServiceConfig {
    type: TranslationServiceType
    apiKey?: string
    endpoint?: string
    model?: string
}

export type DisplayStyle = 'block' | 'underline' | 'blur' | 'sense'

export interface VideoSubtitleConfig {
    enabled: boolean
    fontSize: number
    opacity: number
    color: string
    backgroundColor: string
}

export interface SiteRule {
    matches: string[]
    selectors?: string[]
    excludeSelectors?: string[]
    enabled?: boolean
}

export const DEFAULT_CONFIG: ExtensionConfig = {
    enabled: true,
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    translationService: {
        type: 'google',
    },
    displayStyle: 'block',
    videoSubtitle: {
        enabled: true,
        fontSize: 20,
        opacity: 0.8,
        color: '#FFFFFF',
        backgroundColor: '#000000',
    },
    dubbing: DEFAULT_DUBBING_OPTIONS,
    siteRules: [],
    requestBatchSize: 30,
    maxRetries: 3,
    retryDelay: 1000,
    floatingBall: {
        position: { x: -1, y: -1 } // -1 indicates default position (calculated in CSS/JS)
    },
    customPrompts: [],
    activePromptId: 'default-normal'
}

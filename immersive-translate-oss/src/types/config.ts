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
}

/**
 * Video Subtitle Types
 * Shared types for subtitle processing
 */

// Basic subtitle cue
export interface SubtitleCue {
    startTime: number  // in seconds
    endTime: number
    text: string
    translation?: string
}

// Raw subtitle item (before processing)
export interface SubtitleItem {
    start: number      // Can be ms or seconds depending on source
    end: number
    text: string
    translation?: string
}

// Subtitle track info
export interface SubtitleTrack {
    id: string
    languageCode: string
    name: string
    url?: string
    isTranslatable?: boolean
    isDefault?: boolean
    kind?: 'asr' | 'captions'  // asr = auto-generated
}

// Video metadata
export interface VideoMeta {
    source: string
    videoId?: string
    title?: string
    duration?: number
    subtitleTracks?: SubtitleTrack[]
}

// Intercepted subtitle message
export interface SubtitleInterceptedMessage {
    source: string      // youtube, bilibili, netflix, etc.
    url: string
    body: any           // JSON or text content
    responseType?: string
}

// Intercepted video meta message
export interface VideoMetaMessage {
    source: string
    [key: string]: any  // Platform-specific metadata
}

// Subtitle rule configuration (from Immersive Translate)
export interface SubtitleRule {
    type: string                    // Platform type identifier
    subtitleUrlRegExp?: string      // Regex to match subtitle URLs
    hookType?: ('xhr' | 'fetch')[]  // Which APIs to hook
    videoSelector?: string          // Video element selector
    videoPlayerSelector?: string    // Player container selector
    attachRule?: AttachSubtitleRule // How to attach subtitle overlay
    disabled?: boolean
    autoEnableSubtitle?: boolean
    humanPreferred?: boolean        // Prefer human-written subtitles
    preTranslation?: boolean        // Pre-translate before display
}

// Attach subtitle overlay configuration
export interface AttachSubtitleRule {
    appendSelector: string          // Where to append overlay
    loadingContainerSelector?: string
    loadingStyle?: string
    injectedCSS?: string | string[]
    injectedGlobalCSS?: string | string[]
    injectedGlobalCSSContainer?: string
}

// Subtitle style settings
export interface SubtitleStyleSettings {
    sourceFontSize?: string         // e.g., "100" for 100%
    translationFontSize?: string
    sourceTextColor?: string        // Hex color
    translationTextColor?: string
    backgroundColor?: string
    backgroundOpacity?: string      // e.g., "75" for 75%
    textShadowType?: 'none' | 'shadow' | 'raised' | 'depressed' | 'outline'
    sourceFontFamily?: string
    translationFontFamily?: string
    sourceFontWeight?: string
    translationFontWeight?: string
    translationPosition?: 'top' | 'bottom'
    translationMode?: 'dual' | 'translation'
}

// YouTube specific types
export interface YouTubePlayerResponse {
    videoDetails?: {
        videoId: string
        title: string
        lengthSeconds: string
        isLive?: boolean
    }
    captions?: {
        playerCaptionsTracklistRenderer?: {
            captionTracks: YouTubeCaptionTrack[]
        }
    }
}

export interface YouTubeCaptionTrack {
    baseUrl: string
    name: { simpleText?: string; runs?: Array<{ text: string }> }
    languageCode: string
    vssId: string
    isTranslatable: boolean
    kind?: string  // 'asr' for auto-generated
}

export interface YouTubeTimedTextEvent {
    tStartMs: number
    dDurationMs?: number
    segs?: Array<{ utf8: string; tOffsetMs?: number }>
}

// Bilibili specific types
export interface BilibiliSubtitleInfo {
    id: number
    lan: string
    lan_doc: string
    subtitle_url: string
}

export interface BilibiliSubtitleContent {
    font_size: number
    font_color: string
    background_alpha: number
    background_color: string
    stroke: string
    body: Array<{
        from: number    // Start time in seconds
        to: number      // End time in seconds
        sid: number
        location: number
        content: string
    }>
}

// Netflix specific types
export interface NetflixTimedTextTrack {
    languageDescription: string
    new_track_id: string
    ttDownloadables: Record<string, {
        urls: Array<{ url: string }>
    }>
}

// Parse result from different formats
export interface ParsedSubtitles {
    subtitles: SubtitleItem[]
    format: 'json' | 'vtt' | 'srt' | 'ttml' | 'unknown'
    language?: string
}

/**
 * Video Subtitle Module Entry Point
 * Platform detection, hook initialization, and inject script injection
 */

import { YouTubeSubtitleHook, isYouTubePage } from './youtube'
import { BilibiliSubtitleHook, isBilibiliPage } from './bilibili'

export type VideoHook = YouTubeSubtitleHook | BilibiliSubtitleHook | null

// injectScript removed as it is handled by manifest.json content_scripts configuration

/**
 * Check if current page needs video subtitle support
 */
function needsVideoHook(): boolean {
    return isYouTubePage() || isBilibiliPage()
}

/**
 * Initialize video subtitle hook
 */
export function initVideoHook(): VideoHook {
    // Only proceed if page needs video support
    if (!needsVideoHook()) {
        return null
    }

    // Script injection is handled by manifest.json (World: MAIN)

    if (isYouTubePage()) {
        console.log('[Video] Initializing YouTube hook')
        return new YouTubeSubtitleHook()
    }

    if (isBilibiliPage()) {
        console.log('[Video] Initializing Bilibili hook')
        return new BilibiliSubtitleHook()
    }

    return null
}

// Re-export types and classes
export type { SubtitleCue } from './overlay'
export { SubtitleOverlay } from './overlay'
export { YouTubeSubtitleHook, isYouTubePage } from './youtube'
export { BilibiliSubtitleHook, isBilibiliPage } from './bilibili'
export * from './types'
export * from './parsers'

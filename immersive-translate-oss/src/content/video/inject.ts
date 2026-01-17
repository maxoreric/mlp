/**
 * Subtitle Inject Script
 * Runs in Main World (page context) to hook XHR/Fetch for subtitle interception
 * Ported from Immersive Translate target_extension
 */

// Message protocol for communication between inject script and content script
const IMT_SUBTITLE_INJECT = 'imt-subtitle-inject'

// Subtitle URL patterns for different platforms
const SUBTITLE_PATTERNS: Record<string, RegExp> = {
    // YouTube
    youtube: /timedtext.*fmt=(srv3|json3|vtt)|youtube\.com\/api\/timedtext/i,
    // Bilibili
    bilibili: /aisubtitle\.hdslb\.com|subtitle_url|bfs\/subtitle/i,
    // Netflix (TTML format)
    netflix: /netflix\..*\?o=\d+/i,
    // Generic VTT/SRT patterns
    webvtt: /\.(vtt|srt|sbv)(\?|$)/i,
    // Generic subtitle endpoints
    generic: /subtitle|caption|timedtext|track/i,
}

/**
 * Message Bridge for communication with content script
 */
class MessageBridge {
    private from: string
    private to: string

    constructor(from: string, to: string) {
        this.from = from
        this.to = to
    }

    sendMessage(data: { type: string; data?: any; id?: number }) {
        globalThis.postMessage({
            eventType: IMT_SUBTITLE_INJECT,
            to: this.to,
            from: this.from,
            type: data.type,
            data: data.data,
            id: data.id || Date.now(),
            isAsync: false
        }, '*')
    }

    sendAsyncMessage<T>(message: { type: string; data?: any }): Promise<T> {
        return new Promise((resolve) => {
            const id = Date.now() + Math.random()
            globalThis.postMessage({
                eventType: IMT_SUBTITLE_INJECT,
                to: this.to,
                from: this.from,
                type: message.type,
                data: message.data,
                id: id,
                isAsync: true
            }, '*')

            const handler = (event: MessageEvent) => {
                const msg = event.data
                if (msg?.eventType === IMT_SUBTITLE_INJECT &&
                    msg.id === id &&
                    msg.to === this.from) {
                    resolve(msg.data)
                    globalThis.removeEventListener('message', handler)
                }
            }
            globalThis.addEventListener('message', handler)
        })
    }

    handleMessages(callback: (msg: any) => void) {
        const handler = (event: MessageEvent) => {
            const msg = event.data
            if (msg?.eventType === IMT_SUBTITLE_INJECT && msg.to === this.from) {
                callback(msg)
            }
        }
        globalThis.addEventListener('message', handler)
        return () => globalThis.removeEventListener('message', handler)
    }
}

// Create bridges
const injectBridge = new MessageBridge('inject', 'content-script')

/**
 * Check if URL matches any subtitle pattern
 */
function isSubtitleRequest(url: string): string | null {
    if (!url) return null
    for (const [platform, pattern] of Object.entries(SUBTITLE_PATTERNS)) {
        if (pattern.test(url)) {
            return platform
        }
    }
    return null
}

/**
 * Normalize URL to absolute
 */
function normalizeUrl(url: string): string | null {
    if (!url) return null
    try {
        if (url.startsWith('//')) {
            return globalThis.location.protocol + url
        } else if (url.startsWith('/')) {
            return `${globalThis.location.protocol}//${globalThis.location.host}${url}`
        } else if (!url.startsWith('http')) {
            return `${globalThis.location.protocol}//${url}`
        }
        return new URL(url).toString()
    } catch {
        return url
    }
}

/**
 * Hook XMLHttpRequest to intercept subtitle requests
 */
function hookXHR() {
    const originalOpen = XMLHttpRequest.prototype.open
    const originalSend = XMLHttpRequest.prototype.send

    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest & { _url?: string }, ...args: any[]) {
        const url = typeof args[1] === 'string' ? args[1] : args[1]?.href
        this._url = url
        return originalOpen.apply(this, args as any)
    }

    XMLHttpRequest.prototype.send = function (this: XMLHttpRequest & { _url?: string }, ...args: any[]) {
        const url = this._url
        const platform = isSubtitleRequest(url || '')

        if (url && platform) {
            console.log(`[IMT Inject] XHR subtitle request detected: ${platform}`, url)

            this.addEventListener('load', () => {
                if (this.status === 200) {
                    try {
                        let body: any = this.responseText
                        // Try to parse as JSON
                        try {
                            body = JSON.parse(this.responseText)
                        } catch {
                            // Keep as text
                        }

                        injectBridge.sendMessage({
                            type: 'SUBTITLE_INTERCEPTED',
                            data: {
                                source: platform,
                                url: normalizeUrl(url),
                                body,
                                responseType: this.responseType
                            }
                        })
                    } catch (e) {
                        console.error('[IMT Inject] XHR parse error:', e)
                    }
                }
            })
        }

        return originalSend.apply(this, args as any)
    }
}

/**
 * Hook Fetch API to intercept subtitle requests
 */
function hookFetch() {
    const originalFetch = globalThis.fetch
        // Store original for potential bypass
        ; (globalThis as any).__originalFetch = originalFetch

    globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string'
            ? input
            : input instanceof URL
                ? input.href
                : input.url

        const platform = isSubtitleRequest(url || '')

        if (url && platform) {
            console.log(`[IMT Inject] Fetch subtitle request detected: ${platform}`, url)

            // Clone request and fetch
            const response = await originalFetch(input, init)

            // Clone response so we can read it and still return original
            const clonedResponse = response.clone()

            // Process in background
            clonedResponse.text().then(text => {
                let body: any = text
                try {
                    body = JSON.parse(text)
                } catch {
                    // Keep as text
                }

                injectBridge.sendMessage({
                    type: 'SUBTITLE_INTERCEPTED',
                    data: {
                        source: platform,
                        url: normalizeUrl(url),
                        body,
                        responseType: 'text'
                    }
                })
            }).catch(e => {
                console.error('[IMT Inject] Fetch clone error:', e)
            })

            return response
        }

        return originalFetch(input, init)
    }
}

/**
 * Hook JSON.parse for Netflix-style metadata extraction
 * SAFETY: Uses try-catch and deferred processing to avoid breaking host page
 */
function hookJSONParse() {
    const originalParse = JSON.parse

    JSON.parse = function (text: string, reviver?: any) {
        const result = originalParse.call(this, text, reviver)

        // Skip small/irrelevant JSON to reduce overhead (early exit for performance)
        if (typeof text !== 'string' || text.length < 100) {
            return result
        }

        // Process asynchronously to avoid blocking main thread
        try {
            // Use setTimeout to defer metadata extraction (non-blocking)
            setTimeout(() => {
                try {
                    // Netflix: timedtexttracks
                    if (result?.result?.timedtexttracks && result?.result?.movieId) {
                        injectBridge.sendMessage({
                            type: 'VIDEO_META_INTERCEPTED',
                            data: {
                                source: 'netflix',
                                movieId: result.result.movieId,
                                tracks: result.result.timedtexttracks
                            }
                        })
                    }

                    // YouTube: playerResponse
                    if (result?.captions?.playerCaptionsTracklistRenderer) {
                        injectBridge.sendMessage({
                            type: 'VIDEO_META_INTERCEPTED',
                            data: {
                                source: 'youtube',
                                captionTracks: result.captions.playerCaptionsTracklistRenderer.captionTracks
                            }
                        })
                    }
                } catch {
                    // Silently ignore - never break host page
                }
            }, 0)
        } catch {
            // Ignore any scheduling errors
        }

        return result
    }
}

/**
 * Platform-specific handlers
 */
const platformHandlers: Record<string, () => void> = {
    youtube: () => {
        // YouTube specific: try to trigger subtitles via player API
        const tryTriggerSubtitle = () => {
            try {
                const player = (document.querySelector('#movie_player') as any)
                if (player?.toggleSubtitles) {
                    // Check current state
                    const options = player.getOptions?.('captions')
                    if (options?.length > 0) {
                        console.log('[IMT Inject] YouTube captions available')
                    }
                }
            } catch {
                // Ignore
            }
        }
        setTimeout(tryTriggerSubtitle, 2000)
    },

    bilibili: () => {
        // Bilibili: extract CID from __INITIAL_STATE__
        let lastExtractedCid: number | null = null

        const extractCid = (): boolean => {
            try {
                const state = (window as any).__INITIAL_STATE__
                if (state?.videoData?.cid && state.videoData.cid !== lastExtractedCid) {
                    lastExtractedCid = state.videoData.cid
                    injectBridge.sendMessage({
                        type: 'VIDEO_META_INTERCEPTED',
                        data: {
                            source: 'bilibili',
                            cid: state.videoData.cid,
                            bvid: state.bvid,
                            aid: state.aid
                        }
                    })
                    return true
                }
            } catch {
                // Ignore
            }
            return false
        }

        // Initial extraction
        if (!extractCid()) {
            // Retry with longer timeout (30s instead of 10s for slow pages)
            const interval = setInterval(() => {
                if (extractCid()) clearInterval(interval)
            }, 500)
            setTimeout(() => clearInterval(interval), 30000)
        }

        // Watch for SPA navigation (Bilibili uses SPA for video transitions)
        let lastUrl = location.href
        const checkUrlChange = () => {
            if (location.href !== lastUrl) {
                lastUrl = location.href
                // Re-extract after URL change (wait for state update)
                setTimeout(() => extractCid(), 500)
            }
        }

        // Listen for popstate (back/forward)
        window.addEventListener('popstate', checkUrlChange)

        // Use MutationObserver to detect URL changes from pushState
        const observer = new MutationObserver(() => {
            checkUrlChange()
        })
        observer.observe(document.body, { childList: true, subtree: true })
    }
}

/**
 * Initialize all hooks
 */
function init() {
    console.log('[IMT Inject] Initializing subtitle hooks...')

    // Hook network requests
    hookXHR()
    hookFetch()
    hookJSONParse()

    // Detect platform and run specific handler
    const hostname = globalThis.location.hostname
    if (hostname.includes('youtube.com')) {
        platformHandlers.youtube()
    } else if (hostname.includes('bilibili.com')) {
        platformHandlers.bilibili()
    }

    // Notify content script that inject is ready
    injectBridge.sendMessage({ type: 'INJECT_READY' })

    console.log('[IMT Inject] Hooks initialized')
}

// Run immediately
init()

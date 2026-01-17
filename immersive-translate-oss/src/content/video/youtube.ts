/**
 * YouTube Subtitle Hook
 * Captures and translates YouTube video captions
 * Updated to use inject script for passive interception
 */

import { SubtitleOverlay, SubtitleCue } from './overlay'
import { parseSubtitles } from './parsers'
import { MessagePayload, MessageResponse } from '@/types/messages'
import { SyncController } from './dubbing'
import { getConfig } from '@/lib/storage'
import { DEFAULT_DUBBING_OPTIONS } from './dubbing/types'

const IMT_SUBTITLE_INJECT = 'imt-subtitle-inject'

export class YouTubeSubtitleHook {
    private overlay: SubtitleOverlay
    private videoElement: HTMLVideoElement | null = null
    private currentVideoId: string | null = null
    private cues: SubtitleCue[] = []
    private observer: MutationObserver | null = null
    private isListening = false

    // Dubbing support
    private dubbingController: SyncController | null = null
    private dubbingEnabled = false

    constructor() {
        this.overlay = new SubtitleOverlay()
        this.init()
    }

    private init(): void {
        this.waitForVideo()
        this.setupNavigationWatch()
        this.setupInterceptionListener()
    }

    /**
     * Setup listener for intercepted subtitles from inject script
     */
    private setupInterceptionListener(): void {
        if (this.isListening) return
        this.isListening = true

        window.addEventListener('message', (event) => {
            const msg = event.data
            if (msg?.eventType !== IMT_SUBTITLE_INJECT) return
            if (msg.to !== 'content-script') return

            switch (msg.type) {
                case 'SUBTITLE_INTERCEPTED':
                    this.handleSubtitleIntercepted(msg.data)
                    break
                case 'VIDEO_META_INTERCEPTED':
                    this.handleVideoMetaIntercepted(msg.data)
                    break
                case 'INJECT_READY':
                    console.log('[YouTube Hook] Inject script ready')
                    break
            }
        })
    }

    /**
     * Handle intercepted subtitle data
     */
    private handleSubtitleIntercepted(data: any): void {
        if (data.source !== 'youtube') return

        console.log('[YouTube Hook] Subtitle intercepted:', data.url)

        const parsed = parseSubtitles(data.body)
        if (parsed.subtitles.length === 0) {
            console.log('[YouTube Hook] No subtitles found in response')
            return
        }

        // Convert to cues (SubtitleItem has start/end, SubtitleCue has startTime/endTime)
        this.cues = parsed.subtitles.map(sub => ({
            startTime: sub.start,
            endTime: sub.end,
            text: sub.text
        }))

        this.overlay.setCues(this.cues)
        this.showToast(`${this.cues.length} subtitles loaded`)
        this.translateSubtitles()

        // Initialize dubbing if video is ready
        this.initDubbing()
    }

    /**
     * Handle intercepted video metadata
     */
    private handleVideoMetaIntercepted(data: any): void {
        if (data.source !== 'youtube') return

        console.log('[YouTube Hook] Video meta intercepted:', data)

        if (data.captionTracks) {
            // Could display available tracks or auto-select
            console.log('[YouTube Hook] Available tracks:', data.captionTracks.length)
        }
    }

    /**
     * Wait for video element to appear
     */
    /**
     * Wait for video element to appear
     */
    private waitForVideo(): void {
        const checkVideo = () => {
            const allVideos = Array.from(document.querySelectorAll('video'))
            if (allVideos.length === 0) return

            // Sort videos by priority:
            // 1. Is playing (!paused && currentTime > 0)
            // 2. Has specific class (html5-main-video)
            // 3. Size (area)
            const sortedVideos = allVideos.sort((a, b) => {
                const aIsPlaying = !a.paused && a.currentTime > 0
                const bIsPlaying = !b.paused && b.currentTime > 0
                if (aIsPlaying !== bIsPlaying) return bIsPlaying ? 1 : -1

                const aHasClass = a.classList.contains('html5-main-video')
                const bHasClass = b.classList.contains('html5-main-video')
                if (aHasClass !== bHasClass) return bHasClass ? 1 : -1

                const aArea = a.offsetWidth * a.offsetHeight
                const bArea = b.offsetWidth * b.offsetHeight
                return bArea - aArea
            })

            const bestVideo = sortedVideos[0] as HTMLVideoElement

            // Heuristic to avoid generic background videos or tiny previews
            if (bestVideo && bestVideo.offsetWidth > 100 && bestVideo.offsetHeight > 100) {
                if (bestVideo !== this.videoElement) {
                    console.log('[YouTube Hook] Found new video element:', bestVideo)
                    this.videoElement = bestVideo
                    this.onVideoFound()
                }
            }
        }

        checkVideo()

        // Use efficient MutationObserver
        this.observer = new MutationObserver((mutations) => {
            let shouldCheck = false
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    shouldCheck = true
                    break
                }
            }
            if (shouldCheck) checkVideo()
        })

        this.observer.observe(document.body, { childList: true, subtree: true })

        // Polling ensuring we catch state changes (like play/pause) that affect priority
        // Using 2s interval to be less aggressive than 1s, but sufficient
        setInterval(() => {
            checkVideo()
        }, 2000)
    }

    /**
     * Watch for YouTube SPA navigation
     */
    private setupNavigationWatch(): void {
        const handleNavigation = () => {
            const videoId = this.extractVideoId()
            if (videoId && videoId !== this.currentVideoId) {
                this.currentVideoId = videoId
                this.onVideoChange()
            }
        }

        window.addEventListener('popstate', handleNavigation)

        const originalPushState = history.pushState.bind(history)
        history.pushState = (...args) => {
            originalPushState(...args)
            setTimeout(handleNavigation, 100)
        }
    }

    /**
     * Extract video ID from URL
     */
    private extractVideoId(): string | null {
        const match = location.href.match(/[?&]v=([^&]+)/)
        return match ? match[1] : null
    }

    /**
     * Called when video element is found
     */
    private onVideoFound(): void {
        if (!this.videoElement) return

        console.log('[YouTube Hook] Video element found')
        this.overlay.attachToVideo(this.videoElement)

        this.currentVideoId = this.extractVideoId()
    }

    /**
     * Called when video changes (navigation)
     */
    private onVideoChange(): void {
        console.log('[YouTube Hook] Video changed:', this.currentVideoId)
        this.cues = []
        // Wait for inject to capture subtitles
    }

    /**
     * Translate all subtitle cues
     */
    private async translateSubtitles(): Promise<void> {
        if (this.cues.length === 0) return

        console.log(`[YouTube Hook] Translating ${this.cues.length} subtitle cues...`)
        this.showToast('Translating subtitles...')

        const BATCH_SIZE = 20
        const translations = new Map<number, string>()
        let failureCount = 0
        let lastError = ''

        const config = await getConfig()
        const targetLang = config.targetLang || 'zh-CN'

        for (let i = 0; i < this.cues.length; i += BATCH_SIZE) {
            const batch = this.cues.slice(i, i + BATCH_SIZE)
            const texts = batch.map(cue => cue.text)

            try {
                const response = await this.sendMessage({
                    action: 'TRANSLATE_BATCH',
                    data: {
                        texts,
                        sourceLang: 'auto',
                        targetLang: targetLang,
                    },
                })

                if (response.success && Array.isArray(response.data)) {
                    response.data.forEach((translation, idx) => {
                        const cueIndex = i + idx
                        translations.set(cueIndex, translation)

                        // Update dubbing controller if active
                        this.dubbingController?.updateCueTranslation(cueIndex, translation)
                    })
                } else {
                    console.warn('[YouTube Hook] Batch translation error:', response.error)
                    failureCount++
                    lastError = response.error || 'Unknown API Error'
                }
            } catch (error) {
                console.error('[YouTube Hook] Translation batch failed:', error)
                failureCount++
                lastError = error instanceof Error ? error.message : 'Network Error'
            }
        }

        this.overlay.setTranslations(translations)

        if (failureCount > 0) {
            this.showToast(`Translation failed (${failureCount} batches). Error: ${lastError}`)
        } else {
            console.log('[YouTube Hook] Subtitles translated')
            this.showToast('Translation complete')
        }
    }

    /**
     * Show toast notification
     */
    private showToast(message: string): void {
        const toast = document.createElement('div')
        toast.textContent = message
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'rgba(0,0,0,0.8)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '4px',
            zIndex: '2147483647',
            fontSize: '14px',
            pointerEvents: 'none',
            transition: 'opacity 0.5s'
        })
        document.body.appendChild(toast)
        setTimeout(() => {
            toast.style.opacity = '0'
            setTimeout(() => toast.remove(), 500)
        }, 3000)
    }

    /**
     * Send message to background
     */
    private async sendMessage(payload: MessagePayload): Promise<MessageResponse> {
        return chrome.runtime.sendMessage(payload)
    }

    /**
     * Initialize dubbing controller
     */
    private async initDubbing(): Promise<void> {
        if (!this.videoElement || this.cues.length === 0) {
            return
        }

        // Cleanup existing controller
        if (this.dubbingController) {
            this.dubbingController.destroy()
        }

        // Load config
        const config = await getConfig()
        const dubbingOptions = config.dubbing || DEFAULT_DUBBING_OPTIONS

        // Create new controller
        this.dubbingController = new SyncController(this.videoElement, {
            ...dubbingOptions,
            // Override with local state if managed, but here allow config to drive defaults
            // If runtime toggle overrides config enabled, we should handle that.
            // But dubbingEnabled is local state.
            enabled: this.dubbingEnabled
        })

        // Set cues for dubbing (will use translation when available)
        this.dubbingController.setCues(this.cues)

        console.log('[YouTube Hook] Dubbing controller initialized', dubbingOptions)
    }

    /**
     * Enable dubbing playback
     */
    enableDubbing(): void {
        this.dubbingEnabled = true

        if (this.dubbingController) {
            this.dubbingController.start()
            this.showToast('Dubbing enabled')
        } else if (this.videoElement && this.cues.length > 0) {
            this.initDubbing()
            // initDubbing creates the controller, use non-null assertion
            this.dubbingController!.start()
            this.showToast('Dubbing enabled')
        }
    }

    /**
     * Disable dubbing playback
     */
    disableDubbing(): void {
        this.dubbingEnabled = false

        if (this.dubbingController) {
            this.dubbingController.stop()
            this.showToast('Dubbing disabled')
        }
    }

    /**
     * Check if dubbing is active
     */
    isDubbingEnabled(): boolean {
        return this.dubbingEnabled && (this.dubbingController?.isActive() ?? false)
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.observer?.disconnect()
        this.overlay.destroy()
        this.dubbingController?.destroy()
    }
}

/**
 * Check if current page is YouTube
 */
export function isYouTubePage(): boolean {
    return location.hostname === 'www.youtube.com' || location.hostname === 'youtube.com'
}

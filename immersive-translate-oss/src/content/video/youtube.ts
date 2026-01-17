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
    private controlButton: HTMLElement | null = null
    private loadingOverlay: HTMLElement | null = null
    private currentRequestId = 0



    constructor() {
        this.overlay = new SubtitleOverlay()
        this.init()
    }

    private init(): void {
        this.waitForVideo()
        this.setupNavigationWatch()
        this.setupInterceptionListener()
        this.setupStreamListener()
    }

    /**
     * Setup listener for streaming translation chunks
     */
    private setupStreamListener(): void {
        chrome.runtime.onMessage.addListener((message: MessagePayload) => {
            if (message.action === 'STREAM_CHUNK') {
                const { requestId, index, translation } = message.data as any
                // Verify requestId matches current request to avoid old stream conflict
                if (parseInt(requestId) === this.currentRequestId && this.dubbingController) {
                    this.dubbingController.updateCueTranslation(index, translation)
                }
            } else if (message.action === 'STREAM_COMPLETE') {
                console.log('[YouTube Hook] Stream translation complete')
                this.showToast('Translation complete')
            }
            return false
        })
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

        const config = await getConfig()
        const targetLang = config.targetLang || 'zh-CN'

        // Use streaming translation for better performance and to avoid rate limits
        // Send all texts in one large request

        const texts = this.cues.map(cue => cue.text)
        this.currentRequestId++
        const requestId = this.currentRequestId.toString()

        try {
            this.showToast('Starting streaming translation...')

            // Send signal to start stream
            const response = await this.sendMessage({
                action: 'TRANSLATE_STREAM',
                data: {
                    texts,
                    sourceLang: 'auto',
                    targetLang: targetLang,
                    requestId
                },
            })

            if (!response.success) {
                console.error('[YouTube Hook] Stream start failed:', response.error)
                this.showToast(`Translation failed: ${response.error}`)
            }
        } catch (error) {
            console.error('[YouTube Hook] Translation error:', error)
            this.showToast('Translation error')
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


    /**
     * Initialize Dubbing Controller
     */
    private async initDubbing(): Promise<void> {
        if (this.dubbingController) {
            this.dubbingController.setCues(this.cues)
            return
        }

        if (!this.videoElement) return

        // Load config
        const config = await getConfig()
        const dubbingOptions = config.dubbing || DEFAULT_DUBBING_OPTIONS

        this.dubbingController = new SyncController(this.videoElement, {
            ...dubbingOptions,
            enabled: this.dubbingEnabled
        })

        // Setup UI callbacks
        this.dubbingController.onStartCallback = () => this.updateButtonState(true)
        this.dubbingController.onStopCallback = () => this.updateButtonState(false)
        this.dubbingController.onBufferingStartCallback = () => this.showLoading(true)
        this.dubbingController.onBufferingEndCallback = () => this.showLoading(false)

        this.dubbingController.setCues(this.cues)

        // Auto-enable if previously active
        if (this.dubbingEnabled) {
            this.dubbingController.start()
        }

        // Inject UI controls
        this.injectControl()
    }

    /**
     * Inject Dubbing Control Button
     */
    private injectControl(): void {
        if (this.controlButton && document.body.contains(this.controlButton)) return

        const rightControls = document.querySelector('.ytp-right-controls')
        if (!rightControls) return

        const button = document.createElement('button')
        button.className = 'ytp-button imt-dubbing-btn'
        button.title = 'Enable Dubbing (Immersive Translate)'
        button.setAttribute('aria-pressed', 'false')
        button.innerHTML = `
            <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
                <path d="M11,11 L11,25 L24,18 L11,11 Z" fill="currentColor"></path>
            </svg>
        `
        // Custom styling for the button
        button.style.verticalAlign = 'top'
        button.style.width = '30px'
        button.style.opacity = '0.9'

        button.onclick = () => {
            this.toggleDubbing()
        }

        // Insert before settings button (usually last or second to last)
        rightControls.insertBefore(button, rightControls.firstChild)
        this.controlButton = button
        this.updateButtonState(this.dubbingEnabled)
    }

    /**
     * Update button visual state
     */
    private updateButtonState(active: boolean): void {
        if (!this.controlButton) return

        const path = this.controlButton.querySelector('path')
        if (active) {
            this.controlButton.setAttribute('aria-pressed', 'true')
            this.controlButton.title = 'Disable Dubbing'
            if (path) path.style.fill = '#f87171' // Red/Pink accent color
        } else {
            this.controlButton.setAttribute('aria-pressed', 'false')
            this.controlButton.title = 'Enable Dubbing'
            if (path) path.style.fill = 'currentColor'
        }
    }

    /**
     * Show/Hide Loading Overlay
     */
    private showLoading(show: boolean): void {
        const player = document.querySelector('.html5-video-player')
        if (!player) return

        if (!this.loadingOverlay) {
            this.loadingOverlay = document.createElement('div')
            this.loadingOverlay.className = 'imt-loading-overlay'
            this.loadingOverlay.innerHTML = `
                <div class="imt-spinner"></div>
                <div class="imt-loading-text">Generating Dubbing...</div>
            `
            // CSS Injection for spinner
            const style = document.createElement('style')
            style.textContent = `
                .imt-loading-overlay {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    z-index: 60;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    background: rgba(0, 0, 0, 0.7);
                    padding: 20px;
                    border-radius: 12px;
                    backdrop-filter: blur(4px);
                }
                .imt-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #f87171;
                    border-radius: 50%;
                    animation: imt-spin 1s linear infinite;
                    margin-bottom: 10px;
                }
                .imt-loading-text {
                    color: white;
                    font-size: 14px;
                    font-family: Roboto, Arial, sans-serif;
                }
                @keyframes imt-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `
            document.head.appendChild(style)
        }

        if (show) {
            if (!player.contains(this.loadingOverlay)) {
                player.appendChild(this.loadingOverlay)
            }
        } else {
            if (player.contains(this.loadingOverlay)) {
                player.removeChild(this.loadingOverlay)
            }
        }
    }

    /**
     * Toggle dubbing on/off
     */
    private toggleDubbing(): void {
        this.dubbingEnabled = !this.dubbingEnabled

        if (this.dubbingEnabled) {
            this.dubbingController?.start()
        } else {
            this.dubbingController?.stop()
        }

        // Persist setting if needed (TODO)
        this.updateButtonState(this.dubbingEnabled)
    }

    /**
     * Enable dubbing playback
     */
    public enableDubbing(): void {
        if (!this.dubbingEnabled) {
            this.toggleDubbing()
        }
    }

    /**
     * Disable dubbing playback
     */
    public disableDubbing(): void {
        if (this.dubbingEnabled) {
            this.toggleDubbing()
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

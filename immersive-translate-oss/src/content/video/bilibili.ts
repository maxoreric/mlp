/**
 * Bilibili Subtitle Hook
 * Captures and translates Bilibili video subtitles
 * Updated to use inject script for passive interception
 */

import { SubtitleOverlay, SubtitleCue } from './overlay'
import { parseSubtitles } from './parsers'
import { MessagePayload, MessageResponse } from '@/types/messages'

const IMT_SUBTITLE_INJECT = 'imt-subtitle-inject'

export class BilibiliSubtitleHook {
    private overlay: SubtitleOverlay
    private videoElement: HTMLVideoElement | null = null
    private currentBvid: string | null = null
    private currentCid: number | null = null
    private cues: SubtitleCue[] = []
    private observer: MutationObserver | null = null
    private isListening = false

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
                    console.log('[Bilibili Hook] Inject script ready')
                    break
            }
        })
    }

    /**
     * Handle intercepted subtitle data
     */
    private handleSubtitleIntercepted(data: any): void {
        if (data.source !== 'bilibili') return

        console.log('[Bilibili Hook] Subtitle intercepted:', data.url)

        const parsed = parseSubtitles(data.body)
        if (parsed.subtitles.length === 0) {
            console.log('[Bilibili Hook] No subtitles found in response')
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
    }

    /**
     * Handle intercepted video metadata
     */
    private handleVideoMetaIntercepted(data: any): void {
        if (data.source !== 'bilibili') return

        console.log('[Bilibili Hook] Video meta intercepted:', data)

        if (data.cid) {
            this.currentCid = data.cid
        }
        if (data.bvid) {
            this.currentBvid = data.bvid
        }
    }

    /**
     * Wait for video element
     */
    private waitForVideo(): void {
        const checkVideo = () => {
            const video = document.querySelector('video') as HTMLVideoElement
            if (video && video !== this.videoElement) {
                this.videoElement = video
                this.onVideoFound()
            }
        }

        checkVideo()

        this.observer = new MutationObserver(checkVideo)
        this.observer.observe(document.body, { childList: true, subtree: true })
    }

    /**
     * Watch for Bilibili SPA navigation
     */
    private setupNavigationWatch(): void {
        const handleNavigation = () => {
            const { bvid, cid } = this.extractVideoInfo()
            if (bvid && (bvid !== this.currentBvid || cid !== this.currentCid)) {
                this.currentBvid = bvid
                this.currentCid = cid
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
     * Extract bvid from URL
     */
    private extractVideoInfo(): { bvid: string | null; cid: number | null } {
        const bvidMatch = location.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/)
        const bvid = bvidMatch ? bvidMatch[1] : null

        return { bvid, cid: this.currentCid }
    }

    /**
     * Called when video element is found
     */
    private onVideoFound(): void {
        if (!this.videoElement) return

        console.log('[Bilibili Hook] Video element found')
        this.overlay.attachToVideo(this.videoElement)

        const { bvid } = this.extractVideoInfo()
        this.currentBvid = bvid
    }

    /**
     * Called when video changes
     */
    private onVideoChange(): void {
        console.log('[Bilibili Hook] Video changed:', this.currentBvid, this.currentCid)
        this.cues = []
        // Wait for inject to capture subtitles
    }

    /**
     * Translate subtitles
     */
    private async translateSubtitles(): Promise<void> {
        if (this.cues.length === 0) return

        console.log(`[Bilibili Hook] Translating ${this.cues.length} subtitle cues...`)
        this.showToast('Translating subtitles...')

        const BATCH_SIZE = 20
        const translations = new Map<number, string>()
        let failureCount = 0
        let lastError = ''

        for (let i = 0; i < this.cues.length; i += BATCH_SIZE) {
            const batch = this.cues.slice(i, i + BATCH_SIZE)
            const texts = batch.map(cue => cue.text)

            try {
                const response = await this.sendMessage({
                    action: 'TRANSLATE_BATCH',
                    data: {
                        texts,
                        sourceLang: 'auto',
                        targetLang: 'zh-CN',
                    },
                })

                if (response.success && Array.isArray(response.data)) {
                    response.data.forEach((translation, idx) => {
                        translations.set(i + idx, translation)
                    })
                } else {
                    console.warn('[Bilibili Hook] Batch translation error:', response.error)
                    failureCount++
                    lastError = response.error || 'Unknown API Error'
                }
            } catch (error) {
                console.error('[Bilibili Hook] Translation batch failed:', error)
                failureCount++
                lastError = error instanceof Error ? error.message : 'Network Error'
            }
        }

        this.overlay.setTranslations(translations)

        if (failureCount > 0) {
            this.showToast(`Translation failed (${failureCount} batches). Error: ${lastError}`)
        } else {
            console.log('[Bilibili Hook] Subtitles translated')
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
     * Cleanup
     */
    destroy(): void {
        this.observer?.disconnect()
        this.overlay.destroy()
    }
}

/**
 * Check if current page is Bilibili
 */
export function isBilibiliPage(): boolean {
    return location.hostname === 'www.bilibili.com' || location.hostname === 'bilibili.com'
}

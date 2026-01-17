/**
 * Video Subtitle Overlay
 * Universal subtitle display layer for video players
 */

const SUBTITLE_OVERLAY_STYLES = `
  :host {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 60px;
    z-index: 2147483646;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  
  .subtitle-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 0 20px;
  }
  
  .subtitle-line {
    background: rgba(0, 0, 0, 0.75);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 18px;
    line-height: 1.4;
    text-align: center;
    max-width: 80%;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  }
  
  .subtitle-original {
    font-size: 16px;
    opacity: 0.9;
  }
  
  .subtitle-translation {
    font-size: 18px;
    color: #fef08a; /* Yellow tint for translation */
  }
  
  /* Compact mode */
  .compact .subtitle-line {
    font-size: 14px;
    padding: 4px 8px;
  }
  
  /* Hidden state */
  .hidden {
    display: none;
  }
`

export interface SubtitleCue {
    startTime: number  // in seconds
    endTime: number
    text: string
    translation?: string
}

export class SubtitleOverlay {
    private wrapper: HTMLElement
    private shadow: ShadowRoot
    private container: HTMLElement
    private originalLine: HTMLElement
    private translationLine: HTMLElement
    private videoElement: HTMLVideoElement | null = null
    private cues: SubtitleCue[] = []
    private currentCueIndex = -1
    private animationFrameId: number | null = null

    constructor() {
        // Create wrapper
        this.wrapper = document.createElement('immersive-subtitle-overlay')
        this.shadow = this.wrapper.attachShadow({ mode: 'open' })

        // Add styles
        const style = document.createElement('style')
        style.textContent = SUBTITLE_OVERLAY_STYLES
        this.shadow.appendChild(style)

        // Create container
        this.container = document.createElement('div')
        this.container.className = 'subtitle-container'

        // Create subtitle lines
        this.originalLine = document.createElement('div')
        this.originalLine.className = 'subtitle-line subtitle-original'

        this.translationLine = document.createElement('div')
        this.translationLine.className = 'subtitle-line subtitle-translation'

        this.container.appendChild(this.originalLine)
        this.container.appendChild(this.translationLine)
        this.shadow.appendChild(this.container)

        // Initially hidden
        this.hide()
    }

    /**
     * Attach overlay to a video player container
     */
    attachToVideo(videoElement: HTMLVideoElement): void {
        this.videoElement = videoElement

        // Find suitable parent container
        const container = this.findVideoContainer(videoElement)
        if (!container) {
            console.warn('[Subtitle Overlay] Could not find video container')
            return
        }

        // Ensure container has position
        const style = getComputedStyle(container)
        if (style.position === 'static') {
            (container as HTMLElement).style.position = 'relative'
        }

        // Check for existing overlay to prevent duplicates (Single Instance Policy)
        const existingOverlay = container.querySelector('immersive-subtitle-overlay')
        if (existingOverlay) {
            console.log('[Subtitle Overlay] Removing existing overlay instance')
            existingOverlay.remove()
        }

        container.appendChild(this.wrapper)
        this.startSync()
    }

    /**
     * Find the video player container
     */
    private findVideoContainer(video: HTMLVideoElement): Element | null {
        // Try common player container patterns
        let container: Element | null = video.closest('.html5-video-container')  // YouTube
        if (container) return container.parentElement

        container = video.closest('.bpx-player-video-wrap')  // Bilibili
        if (container) return container.parentElement

        container = video.closest('.video-container')
        if (container) return container

        // Fallback: use video's parent
        return video.parentElement
    }

    /**
     * Set subtitle cues
     */
    setCues(cues: SubtitleCue[]): void {
        this.cues = cues.sort((a, b) => a.startTime - b.startTime)
        this.currentCueIndex = -1
    }

    /**
     * Add translated cues
     */
    setTranslations(translations: Map<number, string>): void {
        this.cues.forEach((cue, index) => {
            if (translations.has(index)) {
                cue.translation = translations.get(index)
            }
        })
    }

    /**
     * Start syncing subtitles with video time
     */
    private startSync(): void {
        if (this.animationFrameId) return

        const sync = () => {
            if (this.videoElement) {
                this.updateSubtitle(this.videoElement.currentTime)
            }
            this.animationFrameId = requestAnimationFrame(sync)
        }

        sync()
    }

    /**
     * Stop syncing
     */
    private stopSync(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId)
            this.animationFrameId = null
        }
    }

    /**
     * Update displayed subtitle based on current time
     */
    private updateSubtitle(currentTime: number): void {
        // Binary search for current cue
        const cueIndex = this.findCueAtTime(currentTime)

        if (cueIndex === this.currentCueIndex) return

        this.currentCueIndex = cueIndex

        if (cueIndex === -1) {
            this.hide()
            return
        }

        const cue = this.cues[cueIndex]
        this.show(cue.text, cue.translation)
    }

    /**
     * Binary search for cue at given time
     */
    private findCueAtTime(time: number): number {
        let left = 0
        let right = this.cues.length - 1

        while (left <= right) {
            const mid = Math.floor((left + right) / 2)
            const cue = this.cues[mid]

            if (time >= cue.startTime && time < cue.endTime) {
                return mid
            } else if (time < cue.startTime) {
                right = mid - 1
            } else {
                left = mid + 1
            }
        }

        return -1
    }

    /**
     * Show subtitle with optional translation
     * If translation is JSON (Sense Group Mode), parse and display with delimiters
     */
    show(original: string, translation?: string): void {
        this.container.classList.remove('hidden')

        // Try to parse translation as Sense Group JSON
        if (translation) {
            try {
                const senseGroups = JSON.parse(translation) as Array<{ src: string, tgt: string }>
                if (Array.isArray(senseGroups) && senseGroups.length > 0 && senseGroups[0].src) {
                    // Sense Group Mode: render with delimiters
                    const srcLine = senseGroups.map(g => g.src).join(' | ')
                    const tgtLine = senseGroups.map(g => g.tgt).join(' | ')

                    this.originalLine.textContent = srcLine
                    this.translationLine.textContent = tgtLine
                    this.translationLine.classList.remove('hidden')
                    return
                }
            } catch {
                // Not JSON, fall through to normal rendering
            }

            // Normal mode
            this.originalLine.textContent = original
            this.translationLine.textContent = translation
            this.translationLine.classList.remove('hidden')
        } else {
            this.originalLine.textContent = original
            this.translationLine.classList.add('hidden')
        }
    }

    /**
     * Hide subtitle overlay
     */
    hide(): void {
        this.container.classList.add('hidden')
    }

    /**
     * Cleanup
     */
    destroy(): void {
        this.stopSync()
        this.wrapper.remove()
    }
}

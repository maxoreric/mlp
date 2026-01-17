/**
 * Volume Ducker
 * Controls original video volume during dubbing playback
 * 
 * Pattern reference: youtube-dubbing-extension uses VTTCue enter/exit events
 * for precise timing of volume ducking.
 */

import { SubtitleCue } from '../overlay'

/**
 * Volume ducker options
 */
export interface VolumeDuckerOptions {
    /** Volume level during dubbing (0-1), default 0 */
    duckedVolume: number
    /** Fade duration in ms, default 100 */
    fadeDuration: number
}

const DEFAULT_OPTIONS: VolumeDuckerOptions = {
    duckedVolume: 0,
    fadeDuration: 100
}

/**
 * VolumeDucker class
 * Lowers original video volume when dubbed audio is playing
 */
export class VolumeDucker {
    private video: HTMLVideoElement
    private options: VolumeDuckerOptions
    private originalVolume: number = 1
    private isDucked: boolean = false
    private track: TextTrack | null = null
    private cueListeners: Map<VTTCue, { enter: () => void; exit: () => void }> = new Map()
    private activeCueCount: number = 0

    constructor(
        video: HTMLVideoElement,
        options: Partial<VolumeDuckerOptions> = {}
    ) {
        this.video = video
        this.options = { ...DEFAULT_OPTIONS, ...options }
        this.originalVolume = video.volume
    }

    /**
     * Setup ducking based on subtitle timing
     * Uses VTTCue enter/exit events for precise timing (pattern from youtube-dubbing-extension)
     */
    setupWithCues(cues: SubtitleCue[]): void {
        // Remove any existing track
        this.cleanup()

        // Create a hidden text track for timing
        this.track = this.video.addTextTrack('metadata', 'dubbing-ducker', 'en')
        this.track.mode = 'hidden'

        // Add cues and listeners
        cues.forEach((cue, index) => {
            const vttCue = new VTTCue(cue.startTime, cue.endTime, `ducker-${index}`)

            const enterHandler = () => this.onCueEnter()
            const exitHandler = () => this.onCueExit()

            vttCue.addEventListener('enter', enterHandler)
            vttCue.addEventListener('exit', exitHandler)

            this.cueListeners.set(vttCue, { enter: enterHandler, exit: exitHandler })
            this.track!.addCue(vttCue)
        })

        console.log(`[VolumeDucker] Setup with ${cues.length} cues`)
    }

    /**
     * Handle cue enter - duck the volume
     */
    private onCueEnter(): void {
        this.activeCueCount++

        if (!this.isDucked) {
            this.duck()
        }
    }

    /**
     * Handle cue exit - restore volume if no active cues
     * Note: Checks for overlapping cues (pattern from youtube-dubbing-extension)
     */
    private onCueExit(): void {
        this.activeCueCount = Math.max(0, this.activeCueCount - 1)

        // Only unduck if no more active cues
        if (this.activeCueCount === 0 && this.isDucked) {
            this.unduck()
        }
    }

    /**
     * Duck (lower) original video volume
     */
    duck(): void {
        if (this.isDucked) return

        // Store current volume
        this.originalVolume = this.video.volume

        // Apply ducked volume with optional fade
        if (this.options.fadeDuration > 0) {
            this.fadeVolume(this.video.volume, this.options.duckedVolume, this.options.fadeDuration)
        } else {
            this.video.volume = this.options.duckedVolume
        }

        this.isDucked = true
        console.log('[VolumeDucker] Ducked to', this.options.duckedVolume)
    }

    /**
     * Restore original video volume
     */
    unduck(): void {
        if (!this.isDucked) return

        if (this.options.fadeDuration > 0) {
            this.fadeVolume(this.video.volume, this.originalVolume, this.options.fadeDuration)
        } else {
            this.video.volume = Math.max(0, Math.min(1, this.originalVolume))
        }

        this.isDucked = false
        console.log('[VolumeDucker] Restored to', this.originalVolume)
    }

    /**
     * Fade volume over time
     */
    private fadeVolume(from: number, to: number, durationMs: number): void {
        const startTime = performance.now()
        const diff = to - from

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime
            const progress = Math.min(elapsed / durationMs, 1)

            // Ease out quad
            const eased = 1 - (1 - progress) * (1 - progress)
            this.video.volume = Math.max(0, Math.min(1, from + diff * eased))

            if (progress < 1) {
                requestAnimationFrame(animate)
            }
        }

        requestAnimationFrame(animate)
    }

    /**
     * Force duck regardless of cue state
     */
    forceDuck(): void {
        this.originalVolume = this.video.volume
        this.video.volume = this.options.duckedVolume
        this.isDucked = true
    }

    /**
     * Force unduck regardless of cue state
     */
    forceUnduck(): void {
        this.video.volume = Math.max(0, Math.min(1, this.originalVolume))
        this.isDucked = false
    }

    /**
     * Update ducked volume level
     */
    setDuckedVolume(volume: number): void {
        this.options.duckedVolume = Math.max(0, Math.min(1, volume))
        if (this.isDucked) {
            this.video.volume = this.options.duckedVolume
        }
    }

    /**
     * Check if currently ducked
     */
    getIsDucked(): boolean {
        return this.isDucked
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        // Remove cue listeners
        this.cueListeners.forEach((listeners, cue) => {
            cue.removeEventListener('enter', listeners.enter)
            cue.removeEventListener('exit', listeners.exit)
        })
        this.cueListeners.clear()

        // Remove cues from track
        if (this.track?.cues) {
            while (this.track.cues.length > 0) {
                this.track.removeCue(this.track.cues[0])
            }
        }

        // Restore volume
        if (this.isDucked) {
            this.video.volume = Math.max(0, Math.min(1, this.originalVolume))
            this.isDucked = false
        }

        this.activeCueCount = 0
        this.track = null
    }

    /**
     * Destroy and cleanup
     */
    destroy(): void {
        this.cleanup()
    }
}

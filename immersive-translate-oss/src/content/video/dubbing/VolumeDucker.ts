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
    private static TRACK_LABEL = 'imt-dubbing-ducker'

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
     * 
     * IMPORTANT: Reuses existing track to avoid memory leak (TextTrack cannot be removed from video)
     */
    setupWithCues(cues: SubtitleCue[]): void {
        // Clean up existing cues and listeners, but try to reuse the track
        this.cleanupCues()

        // Try to find existing track or create new one
        if (!this.track) {
            // Check if track already exists from previous instance
            for (let i = 0; i < this.video.textTracks.length; i++) {
                const existingTrack = this.video.textTracks[i]
                if (existingTrack.label === VolumeDucker.TRACK_LABEL) {
                    this.track = existingTrack
                    console.log('[VolumeDucker] Reusing existing text track')
                    break
                }
            }

            // Only create if not found
            if (!this.track) {
                this.track = this.video.addTextTrack('metadata', VolumeDucker.TRACK_LABEL, 'en')
                console.log('[VolumeDucker] Created new text track')
            }
        }

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
     * Clean up cues only (not the track itself)
     */
    private cleanupCues(): void {
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

        this.activeCueCount = 0
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
     * Cleanup (restore volume, remove listeners, clear cues)
     */
    cleanup(): void {
        this.cleanupCues()

        // Restore volume
        if (this.isDucked) {
            this.video.volume = Math.max(0, Math.min(1, this.originalVolume))
            this.isDucked = false
        }

        // Note: we don't set track to null here to allow reuse
    }

    /**
     * Destroy and cleanup
     */
    destroy(): void {
        this.cleanup()
        this.track = null
    }
}

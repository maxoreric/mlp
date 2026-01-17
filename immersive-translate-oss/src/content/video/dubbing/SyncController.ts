/**
 * Sync Controller
 * Main orchestrator for video dubbing synchronization
 * 
 * Pattern reference: youtube-dubbing-extension class 'wy' binds to video events
 * (timeupdate, pause, playing, seeking, ratechange) to sync audio playback.
 */

import { SubtitleCue } from '../overlay'
import { getAudioEngine } from './AudioEngine'
import { VolumeDucker } from './VolumeDucker'
import {
    DubbingOptions,
    DEFAULT_DUBBING_OPTIONS,
    IAudioEngine,
    SyncState
} from './types'


/**
 * SyncController - manages dubbing audio playback synchronized with video
 */
export class SyncController {
    private video: HTMLVideoElement
    private cues: SubtitleCue[] = []
    private options: DubbingOptions
    private audioEngine: IAudioEngine
    private volumeDucker: VolumeDucker
    private waitingForTranslation: boolean = false
    private waitingForCueIndex: number = -1
    private waitingTimeout: ReturnType<typeof setTimeout> | null = null

    // Smart Pause State
    private isSpeaking: boolean = false
    private pausedForDubbing: boolean = false

    private state: SyncState = {
        isActive: false,
        isPaused: false,
        currentCueIndex: -1,
        originalVolume: 1,
        playbackRate: 1
    }

    private boundHandlers: {
        timeupdate: () => void
        pause: () => void
        playing: () => void
        seeking: () => void
        seeked: () => void
        ratechange: () => void
    }

    // Callbacks for UI
    public onStartCallback?: () => void
    public onStopCallback?: () => void
    public onBufferingStartCallback?: () => void
    public onBufferingEndCallback?: () => void

    constructor(
        video: HTMLVideoElement,
        options: Partial<DubbingOptions> = {}
    ) {
        this.video = video
        this.options = { ...DEFAULT_DUBBING_OPTIONS, ...options }

        // Initialize Audio Engine
        this.audioEngine = getAudioEngine(this.options.engine)

        this.volumeDucker = new VolumeDucker(video, {
            duckedVolume: this.options.originalVolumeLevel,
            fadeDuration: 100
        })

        // Bind event handlers
        this.boundHandlers = {
            timeupdate: this.onTimeUpdate.bind(this),
            pause: this.onPause.bind(this),
            playing: this.onPlaying.bind(this),
            seeking: this.onSeeking.bind(this),
            seeked: this.onSeeked.bind(this),
            ratechange: this.onRateChange.bind(this)
        }

        this.state.originalVolume = video.volume
        this.state.playbackRate = video.playbackRate
    }

    /**
     * Set subtitle cues for dubbing
     */
    setCues(cues: SubtitleCue[]): void {
        this.cues = cues.sort((a, b) => a.startTime - b.startTime)

        // Setup volume ducker with cues
        if (this.options.duckOriginalAudio) {
            this.volumeDucker.setupWithCues(cues)
        }

        console.log(`[SyncController] Set ${cues.length} cues for dubbing`)
    }

    /**
     * Update translation for a specific cue
     */
    updateCueTranslation(index: number, translation: string): void {
        if (this.cues[index]) {
            this.cues[index].translation = translation
            console.log(`[SyncController] Updated translation for cue ${index}`)

            // Check if we were waiting for THIS SPECIFIC translation
            if (this.waitingForTranslation && this.waitingForCueIndex === index) {
                console.log('[SyncController] Translation arrived, resuming...')
                this.clearWaitingState()
                this.playDubbing(index)
                this.video.play() // Resume playback
            }
        }
    }

    /**
     * Clear waiting state and timeout
     */
    private clearWaitingState(): void {
        const wasWaiting = this.waitingForTranslation
        this.waitingForTranslation = false
        this.waitingForCueIndex = -1
        if (this.waitingTimeout) {
            clearTimeout(this.waitingTimeout)
            this.waitingTimeout = null
        }
        if (wasWaiting) {
            this.onBufferingEndCallback?.()
        }
    }

    /**
     * Start dubbing synchronization
     */
    start(): void {
        if (this.state.isActive) return
        if (!this.audioEngine.isSupported()) {
            console.error('[SyncController] Audio engine not supported')
            return
        }

        this.state.isActive = true
        this.bindVideoEvents()

        this.onStartCallback?.()
        console.log('[SyncController] Started dubbing sync')
    }

    /**
     * Stop dubbing synchronization
     */
    stop(): void {
        if (!this.state.isActive) return

        this.unbindVideoEvents()
        this.audioEngine.stop()
        this.isSpeaking = false
        this.pausedForDubbing = false

        this.volumeDucker.forceUnduck()

        this.state.isActive = false
        this.state.currentCueIndex = -1

        this.onStopCallback?.()
        console.log('[SyncController] Stopped dubbing sync')
    }

    /**
     * Bind to video element events
     */
    private bindVideoEvents(): void {
        this.video.addEventListener('timeupdate', this.boundHandlers.timeupdate)
        this.video.addEventListener('pause', this.boundHandlers.pause)
        this.video.addEventListener('playing', this.boundHandlers.playing)
        this.video.addEventListener('seeking', this.boundHandlers.seeking)
        this.video.addEventListener('seeked', this.boundHandlers.seeked)
        this.video.addEventListener('ratechange', this.boundHandlers.ratechange)
    }

    /**
     * Unbind from video element events
     */
    private unbindVideoEvents(): void {
        this.video.removeEventListener('timeupdate', this.boundHandlers.timeupdate)
        this.video.removeEventListener('pause', this.boundHandlers.pause)
        this.video.removeEventListener('playing', this.boundHandlers.playing)
        this.video.removeEventListener('seeking', this.boundHandlers.seeking)
        this.video.removeEventListener('seeked', this.boundHandlers.seeked)
        this.video.removeEventListener('ratechange', this.boundHandlers.ratechange)
    }

    /**
     * Handle video timeupdate event
     * Main sync loop - checks if current time matches a cue and speaks translation
     */
    private onTimeUpdate(): void {
        if (!this.state.isActive) return

        // If manually paused, do nothing (respect user pause)
        if (this.video.paused && !this.waitingForTranslation && !this.pausedForDubbing) return

        const currentTime = this.video.currentTime

        // --- Smart Pause Logic ---
        // If we are currently speaking a cue, and we are nearing the end of that cue
        if (this.isSpeaking && this.state.currentCueIndex >= 0) {
            const currentCue = this.cues[this.state.currentCueIndex]
            if (currentCue) {
                // Buffer zone: pause 0.2s before the literal end to avoid frame skipping over it
                const timeToFinish = currentCue.endTime - currentTime
                if (timeToFinish < 0.25 && timeToFinish > -1.0) { // Tolerance range
                    if (!this.pausedForDubbing) {
                        console.log(`[SyncController] Smart Pause: waiting for TTS (Cue ${this.state.currentCueIndex})`)
                        this.pausedForDubbing = true
                        this.video.pause()
                    }
                    return // Stay here, do not look for new cues
                }
            }
        }
        // -------------------------

        const cueIndex = this.findCueAtTime(currentTime)

        // Different cue than currently playing
        if (cueIndex !== this.state.currentCueIndex) {

            // Don't switch if we are paused for dubbing (should be caught above, but safety check)
            if (this.pausedForDubbing) return

            this.state.currentCueIndex = cueIndex

            if (cueIndex >= 0) {
                const cue = this.cues[cueIndex]

                // Smart Buffering: Wait for translation if needed (with timeout)
                if (!cue.translation && cue.text) {
                    console.log(`[SyncController] Translation missing for cue ${cueIndex}, buffering...`)
                    this.waitingForTranslation = true
                    this.waitingForCueIndex = cueIndex
                    this.video.pause() // Pause video

                    // Set timeout to avoid indefinite waiting (5 seconds max)
                    this.waitingTimeout = setTimeout(() => {
                        if (this.waitingForTranslation && this.waitingForCueIndex === cueIndex) {
                            console.log('[SyncController] Translation timeout, skipping cue...')
                            this.clearWaitingState() // This will trigger onBufferingEnd via clearWaitingState logic if updated
                            this.video.play() // Resume without dubbing for this cue
                        }
                    }, 5000)

                    this.onBufferingStartCallback?.()
                    return
                }

                this.playDubbing(cueIndex)
            }
        }
    }

    /**
     * Handle video pause event
     */
    private onPause(): void {
        if (!this.state.isActive) return

        // Ignore if we paused it ourselves for dubbing
        if (this.pausedForDubbing) return
        // Ignore if we paused for buffering translation
        if (this.waitingForTranslation) return

        this.state.isPaused = true
        this.audioEngine.pause()

        console.log('[SyncController] Paused')
    }

    /**
     * Handle video playing event
     */
    private onPlaying(): void {
        if (!this.state.isActive) return

        this.state.isPaused = false

        // If user manually hit play while we were smart-paused, cancel the smart pause
        if (this.pausedForDubbing) {
            console.log('[SyncController] User forced play during Smart Pause')
            this.pausedForDubbing = false
            // We don't stop audio here, let it finish overlapping
        }

        this.audioEngine.resume()

        console.log('[SyncController] Resumed')
    }

    /**
     * Handle video seeking event
     */
    private onSeeking(): void {
        if (!this.state.isActive) return

        // Stop current audio when seeking
        this.audioEngine.stop()
        this.isSpeaking = false

        // Reset Smart Pause state
        this.pausedForDubbing = false

        this.state.currentCueIndex = -1

        // Clear waiting state to avoid stale resume
        this.clearWaitingState()
    }

    /**
     * Handle video seeked event
     */
    private onSeeked(): void {
        if (!this.state.isActive) return

        // Immediately check for cue at new position
        this.onTimeUpdate()
    }

    /**
     * Handle video ratechange event
     * Adjusts TTS rate to match video playback rate (pattern from youtube-dubbing-extension)
     */
    private onRateChange(): void {
        if (!this.state.isActive) return

        const newRate = this.video.playbackRate
        if (newRate !== this.state.playbackRate) {
            this.state.playbackRate = newRate

            // Adjust TTS rate proportionally
            // Clamp to reasonable range (0.5 - 2.0)
            const adjustedRate = Math.max(0.5, Math.min(2.0, newRate * this.options.rate))
            this.audioEngine.setRate(adjustedRate)

            console.log(`[SyncController] Rate changed to ${adjustedRate}`)
        }
    }

    /**
     * Play dubbing for a specific cue
     */
    private playDubbing(cueIndex: number): void {
        const cue = this.cues[cueIndex]
        if (!cue) return

        // Get text to speak (prefer translation, fallback to original)
        const textToSpeak = cue.translation || cue.text
        if (!textToSpeak) return

        // Stop any current audio
        this.audioEngine.stop()
        this.isSpeaking = false
        this.pausedForDubbing = false // Safety reset

        // Duck volume if enabled
        if (this.options.duckOriginalAudio) {
            this.volumeDucker.duck()
        }

        this.isSpeaking = true

        // Use audio engine (unified for both browser and piper)
        const instance = this.audioEngine.speak(textToSpeak, {
            lang: this.options.language,
            rate: this.state.playbackRate * this.options.rate,
            pitch: this.options.pitch,
            volume: this.options.volume
        })

        if (instance) {
            instance.onEnd(() => {
                this.isSpeaking = false // TTS finished

                // Unduck when speech ends
                if (this.options.duckOriginalAudio) {
                    this.volumeDucker.unduck()
                }

                // Smart Resume: If we were paused waiting for this, resume now
                if (this.pausedForDubbing) {
                    console.log('[SyncController] Smart Resume: TTS finished')
                    this.pausedForDubbing = false
                    this.video.play()
                }
            })

            // Optional: Handle errors to unduck
            if (instance.onError) {
                instance.onError((err) => {
                    console.error('[SyncController] TTS Error:', err)
                    this.isSpeaking = false
                    if (this.options.duckOriginalAudio) {
                        this.volumeDucker.unduck()
                    }
                    // Also resume if we were paused
                    if (this.pausedForDubbing) {
                        this.pausedForDubbing = false
                        this.video.play()
                    }
                })
            }
        }

        console.log(`[SyncController] Speaking cue ${cueIndex}: "${textToSpeak.substring(0, 30)}..."`)
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
     * Update dubbing options
     */
    updateOptions(options: Partial<DubbingOptions>): void {
        const oldEngine = this.options.engine
        this.options = { ...this.options, ...options }

        // Switch engine if needed
        if (options.engine && options.engine !== oldEngine) {
            this.audioEngine.stop()
            this.audioEngine = getAudioEngine(options.engine)
            console.log(`[SyncController] Switched to ${options.engine} engine`)
        }

        if (options.originalVolumeLevel !== undefined) {
            this.volumeDucker.setDuckedVolume(options.originalVolumeLevel)
        }
    }

    /**
     * Get current state
     */
    getState(): SyncState {
        return { ...this.state }
    }

    /**
     * Check if dubbing is active
     */
    isActive(): boolean {
        return this.state.isActive
    }

    /**
     * Cleanup and destroy
     */
    destroy(): void {
        this.stop()
        this.volumeDucker.destroy()
        this.cues = []
        // Clean up audio engine resources if needed
        if ((this.audioEngine as any).destroy) {
            (this.audioEngine as any).destroy()
        }
    }
}

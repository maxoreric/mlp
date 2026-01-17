/**
 * Audio Engine - Web Speech API Implementation
 * MVP implementation using browser's built-in speech synthesis
 * 
 * Pattern reference: youtube-dubbing-extension uses Howler.js for production,
 * but Web Speech API provides a zero-dependency starting point.
 */

import {
    IAudioEngine,
    AudioInstance,
    SpeakOptions,
    VoiceInfo
} from './types'
// NOTE: PiperAudioEngine is no longer imported here.
// Piper TTS runs in the offscreen document to avoid WASM issues in content script.

/**
 * Generate unique ID for audio instances
 */
function generateId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Web Speech API based audio engine
 * Limitations:
 * - Cannot pre-generate audio duration
 * - Cannot seek within audio
 * - Limited control over playback timing
 */
export class WebSpeechEngine implements IAudioEngine {
    private synth: SpeechSynthesis
    private currentInstance: WebSpeechAudioInstance | null = null
    private voices: SpeechSynthesisVoice[] = []
    private defaultOptions: Partial<SpeakOptions> = {
        lang: 'zh-CN',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0
    }

    constructor() {
        this.synth = window.speechSynthesis
        this.loadVoices()

        // Voices may load asynchronously
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.loadVoices()
        }
    }

    /**
     * Load available voices
     */
    private loadVoices(): void {
        this.voices = this.synth.getVoices()
        console.log(`[WebSpeechEngine] Loaded ${this.voices.length} voices`)
    }

    /**
     * Check if Web Speech API is supported
     */
    isSupported(): boolean {
        return 'speechSynthesis' in window
    }

    /**
     * Get available voices
     */
    getVoices(): VoiceInfo[] {
        return this.voices.map(voice => ({
            id: voice.voiceURI,
            name: voice.name,
            lang: voice.lang,
            localService: voice.localService,
            default: voice.default
        }))
    }

    /**
     * Speak text with given options
     */
    speak(text: string, options?: Partial<SpeakOptions>): AudioInstance | null {
        if (!this.isSupported()) {
            console.error('[WebSpeechEngine] Speech synthesis not supported')
            return null
        }

        // Cancel any ongoing speech
        this.stop()

        const opts = { ...this.defaultOptions, ...options }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = opts.lang || 'zh-CN'
        utterance.rate = opts.rate || 1.0
        utterance.pitch = opts.pitch || 1.0
        utterance.volume = opts.volume || 1.0

        // Set voice if specified
        if (opts.voice) {
            const voice = this.voices.find(v =>
                v.voiceURI === opts.voice ||
                v.name === opts.voice ||
                v.name.includes(opts.voice!)
            )
            if (voice) {
                utterance.voice = voice
            }
        } else {
            // Try to find a voice for the language
            const langVoice = this.voices.find(v => v.lang.startsWith(opts.lang || 'zh'))
            if (langVoice) {
                utterance.voice = langVoice
            }
        }

        // Create audio instance
        const instance = new WebSpeechAudioInstance(generateId(), text, utterance, this.synth)

        // Wire up callbacks
        utterance.onstart = () => {
            instance.isPlaying = true
            opts.onStart?.()
        }

        utterance.onend = () => {
            instance.isPlaying = false
            instance._triggerEnd()
            opts.onEnd?.()
        }

        utterance.onerror = (event) => {
            instance.isPlaying = false
            console.error('[WebSpeechEngine] Speech error:', event.error)
            opts.onError?.(new Error(event.error))
        }

        this.currentInstance = instance

        // Start speaking
        this.synth.speak(utterance)

        return instance
    }

    /**
     * Pause current speech
     */
    pause(): void {
        if (this.synth.speaking) {
            this.synth.pause()
            if (this.currentInstance) {
                this.currentInstance.isPlaying = false
            }
        }
    }

    /**
     * Resume paused speech
     */
    resume(): void {
        if (this.synth.paused) {
            this.synth.resume()
            if (this.currentInstance) {
                this.currentInstance.isPlaying = true
            }
        }
    }

    /**
     * Stop and cancel all speech
     */
    stop(): void {
        this.synth.cancel()
        if (this.currentInstance) {
            this.currentInstance.isPlaying = false
        }
        this.currentInstance = null
    }

    /**
     * Set speech rate (will affect next utterance)
     */
    setRate(rate: number): void {
        this.defaultOptions.rate = Math.max(0.1, Math.min(10, rate))
    }

    /**
     * Set volume (will affect next utterance)
     */
    setVolume(volume: number): void {
        this.defaultOptions.volume = Math.max(0, Math.min(1, volume))
    }
}

/**
 * Audio instance for Web Speech API
 */
class WebSpeechAudioInstance implements AudioInstance {
    id: string
    text: string
    startTime: number = 0
    endTime: number = 0
    isPlaying: boolean = false

    private synth: SpeechSynthesis
    private endCallbacks: Array<() => void> = []

    constructor(
        id: string,
        text: string,
        _utterance: SpeechSynthesisUtterance,
        synth: SpeechSynthesis
    ) {
        this.id = id
        this.text = text
        // utterance is not stored as Web Speech API doesn't support seeking
        this.synth = synth
    }

    play(): void {
        if (!this.isPlaying) {
            this.synth.resume()
            this.isPlaying = true
        }
    }

    pause(): void {
        if (this.isPlaying) {
            this.synth.pause()
            this.isPlaying = false
        }
    }

    stop(): void {
        this.synth.cancel()
        this.isPlaying = false
    }

    seek(_time: number): void {
        // Not supported by Web Speech API
    }

    onEnd(callback: () => void): void {
        this.endCallbacks.push(callback)
    }

    /**
     * Internal method to trigger end callbacks
     */
    _triggerEnd(): void {
        this.endCallbacks.forEach(cb => cb())
    }
}

/**
 * Export singleton instances
 */
let webSpeechInstance: WebSpeechEngine | null = null

export function getAudioEngine(_type: 'browser' | 'piper' = 'browser'): IAudioEngine {
    // Always return WebSpeechEngine in content script.
    // When 'piper' is selected, actual TTS runs in offscreen document via messages.
    // This function just provides audio control methods (pause/resume/stop).
    if (!webSpeechInstance) {
        webSpeechInstance = new WebSpeechEngine()
    }
    return webSpeechInstance
}

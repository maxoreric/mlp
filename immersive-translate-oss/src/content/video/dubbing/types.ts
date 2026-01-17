/**
 * Video Dubbing Types
 * Type definitions for the dubbing module
 */

/**
 * Dubbing configuration options
 */
// DubbingOptions interface
export interface DubbingOptions {
    enabled: boolean
    engine: 'browser' | 'piper'  // New property
    voice: string
    language: string
    rate: number
    pitch: number
    volume: number
    duckOriginalAudio: boolean
    originalVolumeLevel: number
}

// Default options
export const DEFAULT_DUBBING_OPTIONS: DubbingOptions = {
    enabled: false,
    engine: 'browser', // Default to browser
    voice: '',
    language: 'zh-CN',
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    duckOriginalAudio: true,
    originalVolumeLevel: 0
}

/**
 * Audio instance interface for tracking playback
 */
export interface AudioInstance {
    id: string
    text: string
    startTime: number
    endTime: number
    isPlaying: boolean
    play(): void
    pause(): void
    stop(): void
    onEnd(callback: () => void): void
}

/**
 * Audio engine interface - abstraction for different TTS implementations
 */
export interface IAudioEngine {
    speak(text: string, options?: Partial<SpeakOptions>): AudioInstance | null
    pause(): void
    resume(): void
    stop(): void
    setRate(rate: number): void
    setVolume(volume: number): void
    getVoices(): VoiceInfo[]
    isSupported(): boolean
}

/**
 * Options for speak command
 */
export interface SpeakOptions {
    voice: string
    lang: string
    rate: number
    pitch: number
    volume: number
    onStart?: () => void
    onEnd?: () => void
    onError?: (error: Error) => void
}

/**
 * Voice information
 */
export interface VoiceInfo {
    id: string
    name: string
    lang: string
    localService: boolean
    default: boolean
}

/**
 * Dubbing state for a subtitle cue
 */
export interface DubbingCueState {
    cueIndex: number
    text: string
    translation: string
    startTime: number
    endTime: number
    audioInstance: AudioInstance | null
    status: 'pending' | 'speaking' | 'completed' | 'error'
}

/**
 * Sync controller state
 */
export interface SyncState {
    isActive: boolean
    isPaused: boolean
    currentCueIndex: number
    originalVolume: number
    playbackRate: number
}

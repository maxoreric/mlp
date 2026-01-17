# YouTube Dubbing Project Research & Feature List

## 1. Project Overview
**Target**: [https://www.youtube-dubbing.com/en/](https://www.youtube-dubbing.com/en/)
**Type**: Browser Extension (Chrome/Edge) + Mobile wrapper.
**Core Value**: Real-time video translation with synchronized dubbed audio (TTS), allowing users to "watch" foreign videos in their native language with audio overlay.

## 2. Feature Breakdown

### 2.1 Core Functionality (The "Magic")
*   **Real-time AI Dubbing**: Generates audio tracks in the target language that play in sync with the video.
*   **Intelligent Audio Mixing (Ducking)**: Automatically lowers the volume of the original video track when the dubbed voice is speaking, while preserving background music (BGM).
*   **Text-to-Speech (TTS) Engine**:
    *   High-quality AI voices (likely Azure/OpenAI).
    *   Multi-voice support (Male/Female).
    *   Speaker Identification (attempts to assign different voices to different speakers).
*   **Subtitle Generation**: Generates bilingual subtitles alongside the audio.

### 2.2 User Interface & Interaction
*   **Video Overlay**: A control panel injected into the video player (YouTube/Bilibili/Netflix).
    *   Toggle Dubbing On/Off.
    *   Volume Mixer (Original vs. Dubbing).
    *   Voice Speed Settings.
*   **Browser Action (Popup)**: Global settings and quick access.
*   **Multi-Platform Support**: YouTube, Bilibili, Udemy, Coursera, Netflix, etc.

### 2.3 Technical Architecture Inferences
*   **Client**: Browser Extension (Manifest V3).
*   **Audio Pipeline**: 
    1.  **Capture**: Get video subtitles (CC) or Audio (ASR).
    2.  **Translate**: LLM-based translation (OpenAI/Claude) or MT.
    3.  **Synthesize**: TTS API to generate audio segments.
    4.  **Playback**: HTML5 Audio Context to play segments in sync with `<video>` timestamps.
*   **Backend**: API for handling auth, billing, and proxying TTS/LLM requests.

## 3. Potential "Replication" Candidates for MVP
To replicate this, we need to decide on the complexity level:

*   **Level 1 (Basic)**: Text-to-Speech only. Read existing YouTube CC subtitles using browser TTS. (Simplest, "Read Aloud")
*   **Level 2 (Std)**: Translate Subtitles + External TTS. Fetch subtitles, translate them, and play high-quality TTS audio synced to start times.
*   **Level 3 (Pro)**: ASR + Voice Cloning + Ducking. Process raw audio (if no subs exist), identify speakers, and mix audio professionally.

## 4. Pending Questions for User
1.  **Scope**: Do we focus only on **YouTube** initially?
2.  **Input Source**: Do we rely on **existing subtitles (CC)** or do we need ASR (Speech-to-Text) for raw videos? (ASR is much more expensive/complex).
3.  **Output**: Is **TTS (Audio)** the main goal, or just improved Subtitles?
4.  **TTS Quality**: Browser built-in TTS (Free, robotic) vs. API TTS (Azure/OpenAI, Paid, realistic)?

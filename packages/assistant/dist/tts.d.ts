export interface TTSOptions {
    voice?: string;
    speed?: number;
    pitch?: number;
    format?: 'wav' | 'mp3' | 'ogg' | 'flac';
    sampleRate?: number;
    engine?: string;
}
export interface TTSResult {
    audioPath: string;
    duration?: number;
    format: string;
    engine: string;
    voice?: string;
}
/**
 * Main TTS function that routes to appropriate TTS provider
 * Defaults to Piper (OSS) with fallbacks to other providers
 */
export declare function textToSpeech(text: string, outputPath: string, options?: TTSOptions): Promise<TTSResult>;
/**
 * Convenience function to generate TTS with automatic file naming
 */
export declare function generateSpeech(text: string, options?: TTSOptions): Promise<TTSResult>;
/**
 * List available voices for the current TTS engine
 */
export declare function listVoices(): Promise<string[]>;
//# sourceMappingURL=tts.d.ts.map
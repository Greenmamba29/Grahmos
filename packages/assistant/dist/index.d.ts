/**
 * Grahmos Assistant Package
 * AI Assistant abstraction layer with Gemma-3N LLM default and OSS TTS default
 */
export { chat, simpleChat, systemChat, type ChatMessage, type LLMOptions, type LLMResponse } from './llm.js';
export { textToSpeech, generateSpeech, listVoices, type TTSOptions, type TTSResult } from './tts.js';
/**
 * Combined assistant function that handles both LLM and TTS
 */
export declare function assistantChat(prompt: string, options?: {
    systemPrompt?: string;
    includeTTS?: boolean;
    ttsOptions?: import('./tts.js').TTSOptions;
    llmOptions?: import('./llm.js').LLMOptions;
}): Promise<{
    text: string;
    audio?: import("./tts.js").TTSResult;
}>;
/**
 * Utility to check available providers
 */
export declare function getProviderStatus(): {
    llm: {
        primary: string;
        fallback: string;
        gemma3nUrl: string;
        openaiAvailable: boolean;
    };
    tts: {
        primary: string;
        piperExec: string;
        openaiAvailable: boolean;
        coquiUrl: string;
        elevenlabsAvailable: boolean;
    };
};
//# sourceMappingURL=index.d.ts.map
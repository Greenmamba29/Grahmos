/**
 * Grahmos Assistant Package
 * AI Assistant abstraction layer with Gemma-3N LLM default and OSS TTS default
 */
export { chat, simpleChat, systemChat } from './llm.js';
export { textToSpeech, generateSpeech, listVoices } from './tts.js';
/**
 * Combined assistant function that handles both LLM and TTS
 */
export async function assistantChat(prompt, options = {}) {
    const { systemChat, simpleChat } = await import('./llm.js');
    // Generate text response
    const textResponse = options.systemPrompt
        ? await systemChat(options.systemPrompt, prompt, options.llmOptions)
        : await simpleChat(prompt, options.llmOptions);
    const result = {
        text: textResponse
    };
    // Optionally generate audio
    if (options.includeTTS) {
        const { generateSpeech } = await import('./tts.js');
        try {
            result.audio = await generateSpeech(textResponse, options.ttsOptions);
        }
        catch (error) {
            console.warn('TTS generation failed, returning text-only response:', error);
        }
    }
    return result;
}
/**
 * Utility to check available providers
 */
export function getProviderStatus() {
    return {
        llm: {
            primary: process.env.LLM_PROVIDER || 'gemma3n',
            fallback: process.env.LLM_PROVIDER === 'openai' ? 'gemma3n' : 'openai',
            gemma3nUrl: process.env.GEMMA3N_BASE_URL || 'http://localhost:8000/v1/chat/completions',
            openaiAvailable: !!process.env.OPENAI_API_KEY
        },
        tts: {
            primary: process.env.TTS_ENGINE || 'piper',
            piperExec: process.env.PIPER_EXEC || 'piper',
            openaiAvailable: !!process.env.OPENAI_API_KEY,
            coquiUrl: process.env.COQUI_TTS_URL || 'http://localhost:5002/api/tts',
            elevenlabsAvailable: !!process.env.ELEVENLABS_API_KEY
        }
    };
}
//# sourceMappingURL=index.js.map
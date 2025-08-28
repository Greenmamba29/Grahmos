export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}
export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    model?: string;
}
export interface LLMResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    model?: string;
    finishReason?: string;
}
/**
 * Main chat function that routes to appropriate LLM provider
 * Defaults to Gemma-3N with OpenAI fallback
 */
export declare function chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
/**
 * Helper to create a simple chat completion
 */
export declare function simpleChat(prompt: string, options?: LLMOptions): Promise<string>;
/**
 * Helper to create a chat with system prompt
 */
export declare function systemChat(systemPrompt: string, userPrompt: string, options?: LLMOptions): Promise<string>;
//# sourceMappingURL=llm.d.ts.map
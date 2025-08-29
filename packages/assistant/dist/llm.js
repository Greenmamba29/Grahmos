// Use built-in fetch (Node.js 18+)
// @ts-ignore - fetch is available globally in Node 18+
/**
 * Main chat function that routes to appropriate LLM provider
 * Defaults to Gemma-3N with OpenAI fallback
 */
export async function chat(messages, options = {}) {
    const provider = (process.env.LLM_PROVIDER || 'gemma3n').toLowerCase();
    try {
        switch (provider) {
            case 'openai':
                return await openaiChat(messages, options);
            case 'gemma3n':
            case 'gemma':
            default:
                return await gemma3nChat(messages, options);
        }
    }
    catch (error) {
        console.error(`❌ LLM provider '${provider}' failed:`, error);
        // Fallback to the other provider if primary fails
        if (provider !== 'openai') {
            console.log('🔄 Falling back to OpenAI...');
            try {
                return await openaiChat(messages, options);
            }
            catch (fallbackError) {
                console.error('❌ OpenAI fallback also failed:', fallbackError);
            }
        }
        throw new Error(`All LLM providers failed. Primary error: ${error}`);
    }
}
/**
 * Gemma-3N chat implementation (default)
 */
async function gemma3nChat(messages, options = {}) {
    const baseUrl = process.env.GEMMA3N_BASE_URL || 'http://localhost:8000/v1/chat/completions';
    const model = options.model || process.env.GEMMA3N_MODEL || 'gemma-3n-instruct';
    const apiKey = process.env.GEMMA3N_API_KEY;
    const headers = {
        'Content-Type': 'application/json'
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    const body = {
        model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1000,
        stream: false // Force non-streaming for simplicity
    };
    const response = await fetch(baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        throw new Error(`Gemma-3N API error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from Gemma-3N model');
    }
    return {
        content: data.choices[0].message?.content || '',
        usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
        } : undefined,
        model,
        finishReason: data.choices[0].finish_reason || 'complete'
    };
}
/**
 * OpenAI chat implementation (fallback)
 */
async function openaiChat(messages, options = {}) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY environment variable is required for OpenAI provider');
    }
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const body = {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1000,
        stream: false
    };
    const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    if (!data.choices || data.choices.length === 0) {
        throw new Error('No response from OpenAI model');
    }
    return {
        content: data.choices[0].message?.content || '',
        usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
        } : undefined,
        model,
        finishReason: data.choices[0].finish_reason || 'stop'
    };
}
/**
 * Helper to create a simple chat completion
 */
export async function simpleChat(prompt, options = {}) {
    const messages = [
        { role: 'user', content: prompt }
    ];
    const response = await chat(messages, options);
    return response.content;
}
/**
 * Helper to create a chat with system prompt
 */
export async function systemChat(systemPrompt, userPrompt, options = {}) {
    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ];
    const response = await chat(messages, options);
    return response.content;
}
//# sourceMappingURL=llm.js.map
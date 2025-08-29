import { NextRequest, NextResponse } from 'next/server';

// Dynamic import to avoid bundling issues with the assistant package in the browser
let assistantModule: typeof import('@packages/assistant') | null = null;

const getAssistant = async () => {
  if (!assistantModule) {
    try {
      assistantModule = await import('@packages/assistant');
    } catch (error) {
      console.error('Failed to load assistant module:', error);
      throw new Error('AI Assistant module is not available');
    }
  }
  return assistantModule;
};

export async function POST(request: NextRequest) {
  try {
    const { message, history = [], options = {} } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const assistant = await getAssistant();
    
    // Convert history to chat messages format if needed (for future use)
    // const chatHistory = history.map((msg: { role: string; content: string }) => ({
    //   role: msg.role === 'user' ? 'user' : 'assistant',
    //   content: msg.content
    // }));

    // Use the system prompt from options or default
    const systemPrompt = options.systemPrompt || 
      'You are GrahmOS AI Assistant, an emergency preparedness and general knowledge assistant. ' +
      'Provide helpful, accurate, and concise responses. Focus on safety, emergency preparedness, ' +
      'navigation, and general assistance. Keep responses conversational but informative.';

    // Generate AI response
    const response = await assistant.assistantChat(message, {
      systemPrompt,
      includeTTS: options.includeTTS || false,
      ttsOptions: options.ttsOptions,
      llmOptions: {
        temperature: 0.7,
        maxTokens: 500,
        ...options.llmOptions
      }
    });

    return NextResponse.json({
      content: response.text,
      text: response.text, // Legacy compatibility
      audio: response.audio?.audioPath ? await encodeAudioToBase64(response.audio.audioPath) : undefined,
      model: 'gemma-3n-instruct',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Chat API error:', error);
    
    // Return different error messages based on the error type
    if (error instanceof Error && error.message.includes('not available')) {
      return NextResponse.json({ 
        error: 'AI Assistant is temporarily unavailable',
        fallback: true
      }, { status: 503 });
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      fallback: true
    }, { status: 500 });
  }
}

// Helper function to encode audio file to base64
async function encodeAudioToBase64(audioPath: string): Promise<string | undefined> {
  try {
    const fs = await import('fs/promises');
    const audioBuffer = await fs.readFile(audioPath);
    return audioBuffer.toString('base64');
  } catch (error) {
    console.error('Failed to encode audio to base64:', error);
    return undefined;
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

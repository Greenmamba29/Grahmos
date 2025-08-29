import { NextResponse } from 'next/server';

// Dynamic import to avoid bundling issues
let assistantModule: typeof import('@packages/assistant') | null = null;

const getAssistant = async () => {
  if (!assistantModule) {
    try {
      assistantModule = await import('@packages/assistant');
    } catch (error) {
      console.error('Failed to load assistant module:', error);
      return null;
    }
  }
  return assistantModule;
};

export async function GET() {
  try {
    const assistant = await getAssistant();
    
    if (!assistant) {
      return NextResponse.json({ 
        status: 'unavailable',
        error: 'Assistant module not available' 
      }, { status: 503 });
    }

    // Get provider status
    const providerStatus = assistant.getProviderStatus();
    
    // Test basic connectivity to primary LLM provider
    let llmStatus = 'unavailable';
    try {
      if (providerStatus.llm.primary === 'gemma3n') {
        // Test Gemma-3N endpoint
        const response = await fetch(providerStatus.llm.gemma3nUrl.replace('/chat/completions', '/models'), {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        llmStatus = response.ok ? 'online' : 'error';
      } else if (providerStatus.llm.openaiAvailable) {
        // Test OpenAI endpoint
        const response = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
          },
          signal: AbortSignal.timeout(5000)
        });
        llmStatus = response.ok ? 'online' : 'error';
      }
    } catch (error) {
      console.log('LLM connectivity test failed:', error);
      llmStatus = 'offline';
    }

    return NextResponse.json({
      status: 'available',
      llm: {
        provider: providerStatus.llm.primary,
        status: llmStatus,
        fallback: providerStatus.llm.fallback
      },
      tts: {
        provider: providerStatus.tts.primary,
        available: true // TTS is always available with offline fallbacks
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Status API error:', error);
    return NextResponse.json({ 
      status: 'error',
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// HEAD request for simple connectivity check
export async function HEAD() {
  try {
    const assistant = await getAssistant();
    return new NextResponse(null, { 
      status: assistant ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

// OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

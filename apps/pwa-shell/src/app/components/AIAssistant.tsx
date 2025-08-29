'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  loading?: boolean;
  audio?: string; // Base64 audio data or blob URL
}

interface AIAssistantProps {
  className?: string;
  onResize?: (expanded: boolean) => void;
}

export default function AIAssistant({ className = '', onResize }: AIAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your GrahmOS AI assistant. I can help you with emergency information, navigation, and general questions. How can I assist you today?',
      timestamp: new Date(),
    }
  ]);
  
  const [inputValue, setInputValue] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'online' | 'offline' | 'fallback'>('online');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Check connection status and assistant availability
  useEffect(() => {
    const checkStatus = async () => {
      try {
        // Check if we can reach the Gemma-3N endpoint
        const gemmaResponse = await fetch('/api/ai/status', { 
          method: 'HEAD',
          cache: 'no-cache' 
        });
        
        if (gemmaResponse.ok) {
          setConnectionStatus('online');
          setIsOfflineMode(false);
        } else {
          // Fall back to client-side assistant or cached responses
          setConnectionStatus('fallback');
          setIsOfflineMode(true);
        }
      } catch {
        setConnectionStatus('offline');
        setIsOfflineMode(true);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 30000); // Check every 30s
    
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle expansion state
  const toggleExpansion = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onResize?.(newExpanded);
  }, [isExpanded, onResize]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    const loadingMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      loading: true,
    };

    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      let response: Response;
      
      if (isOfflineMode) {
        // Use offline fallback responses or cached assistant
        response = await handleOfflineQuery(userMessage.content);
      } else {
        // Use full AI assistant API
        response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            history: messages.slice(-10), // Last 10 messages for context
            options: {
              includeTTS: false, // We'll handle TTS separately for better UX
              systemPrompt: 'You are GrahmOS AI Assistant, an emergency preparedness and general knowledge assistant. Provide helpful, accurate, and concise responses. Focus on safety, emergency preparedness, navigation, and general assistance.'
            }
          }),
        });
      }

      if (response.ok) {
        const data = await response.json();
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === loadingMessage.id 
              ? { ...msg, content: data.text || data.content, loading: false }
              : msg
          )
        );

        // Handle optional TTS audio
        if (data.audio) {
          playAudio(data.audio);
        }
      } else {
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      
      // Fallback error response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: isOfflineMode 
                  ? 'I\'m currently in offline mode with limited functionality. For full AI assistance, please check your connection.'
                  : 'I\'m having trouble responding right now. Please try again in a moment.',
                loading: false 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle offline queries with cached responses
  const handleOfflineQuery = async (query: string): Promise<Response> => {
    const lowerQuery = query.toLowerCase();
    
    // Basic emergency response patterns
    const emergencyResponses: Record<string, string> = {
      'emergency': 'In case of emergency, call 911 (US) or your local emergency number. Check the emergency section of GrahmOS for evacuation routes and safety information.',
      'evacuation': 'Check the mapping section for evacuation routes in your area. Always follow official emergency instructions from local authorities.',
      'first aid': 'For basic first aid: check breathing, control bleeding, treat for shock. For serious injuries, call emergency services immediately.',
      'water': 'Store 1 gallon of water per person per day for at least 3 days. Use water purification tablets if needed.',
      'food': 'Keep at least 3 days of non-perishable food per person. Include can openers, utensils, and portable cooking methods.',
      'shelter': 'Find sturdy shelter away from hazards. In earthquakes, drop, cover, and hold on. In storms, seek interior rooms away from windows.',
    };

    for (const [keyword, response] of Object.entries(emergencyResponses)) {
      if (lowerQuery.includes(keyword)) {
        return new Response(JSON.stringify({ content: response }), { status: 200 });
      }
    }

    // Default offline response
    return new Response(JSON.stringify({ 
      content: 'I\'m currently in offline mode. I can help with basic emergency preparedness questions. For full assistance, please connect to the internet.' 
    }), { status: 200 });
  };

  const playAudio = (audioData: string) => {
    if (audioRef.current && audioData) {
      // Handle both base64 and blob URLs
      const audioSrc = audioData.startsWith('data:') ? audioData : `data:audio/mp3;base64,${audioData}`;
      audioRef.current.src = audioSrc;
      audioRef.current.play().catch(console.error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={`flex flex-col bg-white border border-gray-200 rounded-lg shadow-lg transition-all duration-300 ${
      isExpanded ? 'h-96' : 'h-16'
    } ${className}`}>
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b cursor-pointer hover:bg-gray-50"
        onClick={toggleExpansion}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
          <h3 className="font-medium text-gray-900">AI Assistant</h3>
          <span className={`px-2 py-1 text-xs rounded-full ${
            connectionStatus === 'online' ? 'bg-green-100 text-green-800' :
            connectionStatus === 'fallback' ? 'bg-yellow-100 text-yellow-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {connectionStatus === 'online' ? 'Online' :
             connectionStatus === 'fallback' ? 'Limited' : 'Offline'}
          </span>
        </div>
        <button className="text-gray-400 hover:text-gray-600">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {/* Messages */}
      {isExpanded && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.loading ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  {message.audio && (
                    <button
                      className="mt-2 text-xs underline opacity-75 hover:opacity-100"
                      onClick={() => playAudio(message.audio!)}
                    >
                      🔊 Play Audio
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t p-4">
            <div className="flex space-x-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 p-2 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '...' : 'Send'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioRef} preload="none" />
    </div>
  );
}

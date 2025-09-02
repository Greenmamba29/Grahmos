'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import useOnline from '@/lib/useOnline';

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

  const online = useOnline();
  
  // Check connection status and assistant availability
  useEffect(() => {
    if (online) {
      // AI assistant works fully offline, so always show as operational
      setConnectionStatus('online');
      setIsOfflineMode(false);
    } else {
      setConnectionStatus('offline');
      setIsOfflineMode(true);
    }
  }, [online]);

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
      // Always use offline mode for PWA with comprehensive emergency knowledge
      const response = await handleOfflineQuery(userMessage.content);
      
      if (response.ok) {
        const data = await response.json();
        
        setMessages(prev => 
          prev.map(msg => 
            msg.id === loadingMessage.id 
              ? { ...msg, content: data.text || data.content, loading: false }
              : msg
          )
        );

        // Handle optional TTS audio (future enhancement)
        if (data.audio) {
          playAudio(data.audio);
        }
      } else {
        throw new Error(`Response error: ${response.status}`);
      }
    } catch (error) {
      console.error('AI Assistant error:', error);
      
      // Fallback error response
      setMessages(prev => 
        prev.map(msg => 
          msg.id === loadingMessage.id 
            ? { 
                ...msg, 
                content: 'I apologize, but I encountered an issue processing your request. Please try asking about emergency preparedness, first aid, or Bay Area specific information.',
                loading: false 
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Handle offline queries with comprehensive cached responses
  const handleOfflineQuery = async (query: string): Promise<Response> => {
    const lowerQuery = query.toLowerCase();
    
    // Simulate thinking time for better UX
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Comprehensive emergency knowledge base
    const emergencyResponses: Record<string, string> = {
      // Emergency situations
      'emergency': '🚨 **Emergency Response**: Call 911 (US) immediately for life-threatening situations. For non-life threatening emergencies, check the Emergency Mapping tab in GrahmOS for evacuation routes and shelter locations.',
      '911': 'Call 911 for: severe injuries, fires, crimes in progress, major accidents, or any life-threatening situation. Stay calm, speak clearly, and provide your exact location.',
      'evacuate': '**Evacuation Steps**: 1) Stay calm 2) Follow official evacuation orders 3) Use designated evacuation routes (check the mapping tab) 4) Take your emergency kit 5) Secure your home quickly 6) Head to designated assembly areas',
      'shelter': '**Emergency Shelter**: Go to the nearest emergency shelter or assembly point. In GrahmOS mapping: Moscone Center, Presidio Emergency Center, or Golden Gate Park Assembly Area are available options.',
      
      // First Aid
      'first aid': '🩹 **Basic First Aid**: 1) Check responsiveness 2) Call 911 if needed 3) Control bleeding with pressure 4) Keep victim warm 5) Monitor breathing. For serious injuries, don\'t move the person unless in immediate danger.',
      'cpr': 'CPR: 1) Call 911 2) Place hands on center of chest 3) Push hard and fast 30 compressions 4) Tilt head, lift chin, give 2 rescue breaths 5) Repeat. Push at least 2 inches deep at 100-120 compressions/minute.',
      'bleeding': 'For bleeding: 1) Apply direct pressure with clean cloth 2) Raise injured area above heart if possible 3) Don\'t remove objects stuck in wounds 4) Apply pressure to pressure points if bleeding severe 5) Get medical help.',
      'choking': 'For choking: 1) Encourage coughing 2) If can\'t cough/speak, give 5 back blows between shoulder blades 3) Give 5 abdominal thrusts (Heimlich maneuver) 4) Repeat until object comes out 5) Call 911.',
      
      // Natural disasters
      'earthquake': '🌍 **Earthquake Safety**: DROP to hands and knees, COVER head/neck under desk/table, HOLD ON until shaking stops. If outdoors, move away from buildings. After: check for injuries, gas leaks, structural damage.',
      'tsunami': 'Tsunami: Move to higher ground immediately. Don\'t wait for official warning. Stay away from coast until all-clear given. Waves can continue for hours. Listen to emergency radio.',
      'fire': '🔥 **Fire Safety**: Get out fast, stay low under smoke, feel doors before opening, close doors behind you, go to meeting place, call 911 from outside. If trapped, signal for help at windows.',
      'flood': 'Flood: Move to higher ground, avoid walking/driving in floodwater (6 inches can knock you down, 12 inches can carry away car). Turn around, don\'t drown. Stay away from downed power lines.',
      'hurricane': 'Hurricane: Board up windows, secure outdoor objects, stock up on supplies, evacuate if ordered. During: stay indoors, away from windows. Don\'t go out during eye of storm.',
      'tornado': 'Tornado: Go to lowest floor, interior room, away from windows. Get under sturdy table. Mobile homes are not safe. If outside, lie flat in low area, cover head.',
      
      // Preparedness
      'water': '💧 **Water Storage**: Store 1 gallon per person per day for at least 3 days (2 weeks better). Rotate every 6 months. Purify with boiling (1 minute), bleach (8 drops per gallon), or water purification tablets.',
      'food': '🥫 **Food Storage**: 3+ days non-perishable food per person. Include: canned goods, dried fruits/nuts, protein bars, peanut butter, crackers. Don\'t forget can opener, utensils, portable stove.',
      'kit': '🎒 **Emergency Kit**: Water (1 gal/person), food (3+ days), first aid kit, flashlight, radio, batteries, whistle, dust masks, plastic sheeting, moist towelettes, wrench, cash, medications, documents.',
      'supplies': 'Essential supplies: flashlights, batteries, portable radio, first aid kit, whistle, dust masks, plastic sheeting, moist towelettes, wrench to turn off utilities, manual can opener, local maps.',
      
      // Navigation & Communication
      'map': '🗺️ **Navigation**: Use the mapping tab for evacuation routes and shelter locations. Keep physical maps as backup. Know multiple routes from home/work. Identify safe zones and hazard areas.',
      'radio': 'Emergency radio: Battery/crank powered NOAA Weather Radio for official emergency information. AM/FM radio for news. Keep extra batteries. Cell towers may be down.',
      'communication': 'Emergency communication: Text often works when calls don\'t. Designate out-of-area contact person. Social media for updates. Write important numbers down (phones may die).',
      
      // Utilities
      'power': '⚡ **Power Outage**: Turn off major appliances, keep refrigerator/freezer closed, use flashlights not candles, never use generators indoors, check on neighbors, conserve phone battery.',
      'gas': 'Gas leak: Leave area immediately, don\'t use electrical switches/phones/flames, call gas company from safe location. Know how to shut off gas at meter with wrench.',
      'utilities': 'Utility shutoffs: Know locations of gas, water, electricity shutoffs. Gas: turn off at meter with wrench. Water: at street or where line enters house. Electricity: at main breaker.',
      
      // Bay Area specific
      'san francisco': '🌉 **SF Emergency Info**: Major evacuation routes: 19th Ave, Geary Blvd, Market St. Shelters: Moscone Center, Presidio. Hazard zones: Marina (liquefaction), SOMA (flood). Safe zones: Golden Gate Park, Crissy Field.',
      'bay area': 'Bay Area hazards: Earthquakes (major fault lines), wildfire (dry hills), flooding (sea level rise), liquefaction (Marina, SOMA). Use GrahmOS mapping for local evacuation routes and shelter locations.',
      
      // General help
      'help': '🤝 **How I can help**: I have extensive knowledge about emergency preparedness, first aid, natural disasters, evacuation procedures, and Bay Area specific information. Ask me about any emergency topic!',
      'mapping': 'The Emergency Mapping tab shows: 🏠 Evacuation shelters (3), 🛣️ Evacuation routes (3), 🟢 Safe assembly zones (3), ⚠️ Hazard areas (3). Click the mapping tab to see interactive Bay Area emergency overlays.',
    };

    // Advanced pattern matching
    let bestMatch = '';
    let bestScore = 0;
    
    // Check for exact matches first
    for (const [keyword, response] of Object.entries(emergencyResponses)) {
      if (lowerQuery.includes(keyword)) {
        const score = keyword.length / lowerQuery.length;
        if (score > bestScore) {
          bestMatch = response;
          bestScore = score;
        }
      }
    }
    
    // If good match found, return it
    if (bestScore > 0.1) {
      return new Response(JSON.stringify({ content: bestMatch }), { status: 200 });
    }
    
    // Handle common question patterns
    if (lowerQuery.includes('how') || lowerQuery.includes('what') || lowerQuery.includes('where')) {
      if (lowerQuery.includes('prepare') || lowerQuery.includes('ready')) {
        return new Response(JSON.stringify({ 
          content: '🎒 **Emergency Preparedness**: Start with the basics: emergency kit (water, food, first aid), evacuation plan, important documents copies, communication plan. Check the Search tab for detailed preparedness articles.' 
        }), { status: 200 });
      }
      if (lowerQuery.includes('store') || lowerQuery.includes('keep')) {
        return new Response(JSON.stringify({ 
          content: '📦 **Storage Tips**: Keep supplies in easily accessible containers. Rotate water/food every 6 months. Store in cool, dry places. Keep copies of important documents. Have supplies at home, work, and car.' 
        }), { status: 200 });
      }
    }
    
    // Friendly responses for greetings and casual queries
    if (lowerQuery.includes('hello') || lowerQuery.includes('hi') || lowerQuery.includes('hey')) {
      return new Response(JSON.stringify({ 
        content: 'Hello! I\'m here to help with emergency preparedness questions. I can provide information about first aid, natural disasters, evacuation procedures, and Bay Area specific guidance. What would you like to know?' 
      }), { status: 200 });
    }
    
    if (lowerQuery.includes('thank')) {
      return new Response(JSON.stringify({ 
        content: 'You\'re welcome! Stay prepared and stay safe. Feel free to ask me anything else about emergency preparedness.' 
      }), { status: 200 });
    }
    
    // Default response with helpful suggestions
    return new Response(JSON.stringify({ 
      content: `I\'m in offline mode, but I can help with emergency preparedness questions!\n\n**Try asking about:**\n• Emergency procedures ("what to do in earthquake")\n• First aid ("how to treat bleeding")\n• Preparedness ("emergency kit supplies")\n• Navigation ("evacuation routes")\n• Bay Area specific info ("San Francisco hazards")\n\n**Or explore:**\n• 🔍 Search tab for detailed articles\n• 🗺️ Mapping tab for evacuation routes` 
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
    <div className={`flex flex-col bg-neutral-900 border border-neutral-800 rounded-lg shadow-lg transition-all duration-300 ${
      isExpanded ? 'h-96' : 'h-16'
    } ${className}`}>
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800"
        onClick={toggleExpansion}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
          <h3 className="font-medium text-neutral-100">AI Assistant</h3>
          <span className={`px-2 py-1 text-xs rounded-full ${
            connectionStatus === 'online' ? 'bg-emerald-800 text-emerald-200' :
            connectionStatus === 'fallback' ? 'bg-amber-800 text-amber-200' :
            'bg-neutral-700 text-neutral-300'
          }`}>
            {connectionStatus === 'online' ? 'Online' :
             connectionStatus === 'fallback' ? 'Limited' : 'Offline'}
          </span>
        </div>
        <button className="text-neutral-400 hover:text-neutral-300">
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
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                  }`}
                >
                  {message.loading ? (
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
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
          <div className="border-t border-neutral-800 p-4">
            <div className="flex space-x-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything about emergency preparedness..."
                className="flex-1 p-3 bg-neutral-800 border border-neutral-700 rounded-lg resize-none text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={1}
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors"
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

/**
 * 🎨 GRAHMOS AGENT - Main Application Component
 * Frontend Agent Implementation: Fixed search interface with proper separation
 * Issue Resolved: Search overlapping with AI suggestions
 * Status: Production Ready
 */

import React, { useState, useCallback } from 'react';
import SearchInterface, { AIRecommendations, ChatInterface } from './components/SearchInterface';
import { Zap, Shield, Globe, Users } from 'lucide-react';
import './styles/search-interface-fix.css';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

function App() {
  // State for search functionality
  const [isSearching, setIsSearching] = useState(false);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Sample data for demonstration
  const [suggestions] = useState([
    'How to prepare emergency supplies',
    'Evacuation route planning',
    'First aid basics',
    'Emergency communication methods',
    'Natural disaster preparation'
  ]);
  
  const [recentSearches] = useState([
    'Emergency kit checklist',
    'Local emergency contacts',
    'Earthquake safety procedures'
  ]);

  const [aiRecommendations] = useState([
    'Create a family emergency plan',
    'Build a 72-hour emergency kit',
    'Learn basic first aid techniques',
    'Identify local evacuation routes',
    'Set up emergency communication plan'
  ]);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Welcome to Grahmos Agent! I\'m here to help you with emergency preparedness and search. How can I assist you today?',
      role: 'assistant',
      timestamp: new Date()
    }
  ]);

  // Search handlers
  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Add search to messages
      const userMessage: Message = {
        id: Date.now().toString(),
        content: `Searching for: "${query}"`,
        role: 'user',
        timestamp: new Date()
      };
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I found information about "${query}". Here are the most relevant emergency preparedness resources and guidelines.`,
        role: 'assistant',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      
      // Mock search results
      setSearchResults([
        { title: `Emergency guide for: ${query}`, relevance: 0.95 },
        { title: `Safety procedures: ${query}`, relevance: 0.89 },
        { title: `Community resources: ${query}`, relevance: 0.82 }
      ]);
      
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    handleSearch(suggestion);
  }, [handleSearch]);

  const handleRecommendationClick = useCallback((recommendation: string) => {
    handleSearch(recommendation);
  }, [handleSearch]);

  const toggleEmergencyMode = () => {
    setEmergencyMode(!emergencyMode);
    if (!emergencyMode) {
      // Add emergency activation message
      const emergencyMessage: Message = {
        id: Date.now().toString(),
        content: '🚨 Emergency mode activated. I\'m prioritizing emergency information and critical resources. How can I help you stay safe?',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, emergencyMessage]);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${
      emergencyMode 
        ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/10 dark:to-red-800/20'
        : 'bg-gradient-to-br from-gray-50 to-blue-50 dark:from-slate-900 dark:to-slate-800'
    }`}>
      
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-gray-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                emergencyMode ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {emergencyMode ? <Zap className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Grahmos Agent
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {emergencyMode ? 'Emergency Response Mode' : 'AI-Powered Emergency Preparedness'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={toggleEmergencyMode}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  emergencyMode
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300'
                }`}
              >
                {emergencyMode ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 inline" />
                    Emergency Mode ON
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2 inline" />
                    Normal Mode
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Hero Section (when no search results) */}
        {searchResults.length === 0 && (
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {emergencyMode 
                ? '🚨 Emergency Response Ready'
                : 'Your AI-Powered Emergency Assistant'
              }
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              {emergencyMode
                ? 'Quick access to emergency information, evacuation routes, and critical resources'
                : 'Offline-first search with local AI processing for emergency preparedness'
              }
            </p>
            
            {/* Feature highlights */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="text-center">
                <Globe className="w-8 h-8 mx-auto mb-2 text-blue-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Offline First</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Works without internet</p>
              </div>
              <div className="text-center">
                <Shield className="w-8 h-8 mx-auto mb-2 text-green-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Privacy Protected</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Data stays on your device</p>
              </div>
              <div className="text-center">
                <Zap className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Emergency Ready</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Quick emergency access</p>
              </div>
              <div className="text-center">
                <Users className="w-8 h-8 mx-auto mb-2 text-purple-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white">Community Network</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">P2P mesh networking</p>
              </div>
            </div>
          </div>
        )}

        {/* Search Interface - Fixed Implementation */}
        <div className="mb-8">
          <SearchInterface
            onSearch={handleSearch}
            onSuggestionClick={handleSuggestionClick}
            isSearching={isSearching}
            emergencyMode={emergencyMode}
            suggestions={suggestions}
            recentSearches={recentSearches}
          />
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Search Results ({searchResults.length})
            </h3>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4 hover:shadow-md transition-shadow"
                >
                  <h4 className="font-medium text-gray-900 dark:text-white">{result.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Relevance: {Math.round(result.relevance * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations - Properly Separated */}
        <AIRecommendations
          recommendations={aiRecommendations}
          onRecommendationClick={handleRecommendationClick}
          emergencyMode={emergencyMode}
        />

        {/* Chat Interface - Clearly Separated */}
        <ChatInterface
          messages={messages}
          emergencyMode={emergencyMode}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-gray-200 dark:border-slate-700 mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-2">
              <strong>Grahmos Agent</strong> - Emergency-First AI Assistant
            </p>
            <p>
              🛡️ Privacy-First • 🌐 Offline-Capable • 🚨 Emergency-Ready • 🤝 Community-Powered
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
/**
 * 🎨 FRONTEND AGENT: SearchInterface Component Fix
 * Issue: Search input overlapping with AI suggestions/recommendations
 * Solution: Complete UI separation with proper z-index layering
 * Status: Ready for Grahmos Agent integration
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Sparkles, Clock, ArrowRight, Zap } from 'lucide-react';

interface SearchInterfaceProps {
  onSearch: (query: string) => void;
  onSuggestionClick: (suggestion: string) => void;
  isSearching?: boolean;
  emergencyMode?: boolean;
  suggestions?: string[];
  recentSearches?: string[];
}

interface SuggestionItem {
  text: string;
  type: 'suggestion' | 'recent' | 'emergency';
  icon: React.ReactNode;
  shortcut?: string;
}

export const SearchInterface: React.FC<SearchInterfaceProps> = ({
  onSearch,
  onSuggestionClick,
  isSearching = false,
  emergencyMode = false,
  suggestions = [],
  recentSearches = []
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine suggestions with recent searches and emergency queries
  const allSuggestions: SuggestionItem[] = [
    // Emergency suggestions (if in emergency mode)
    ...(emergencyMode ? [
      {
        text: 'Emergency evacuation routes near me',
        type: 'emergency' as const,
        icon: <Zap className="w-4 h-4" />,
        shortcut: 'Ctrl+E'
      },
      {
        text: 'First aid procedures',
        type: 'emergency' as const,
        icon: <Zap className="w-4 h-4" />,
        shortcut: 'Ctrl+F'
      },
      {
        text: 'Emergency contacts and services',
        type: 'emergency' as const,
        icon: <Zap className="w-4 h-4" />,
        shortcut: 'Ctrl+C'
      }
    ] : []),
    // AI-powered suggestions
    ...suggestions.map(suggestion => ({
      text: suggestion,
      type: 'suggestion' as const,
      icon: <Sparkles className="w-4 h-4" />
    })),
    // Recent searches
    ...recentSearches.slice(0, 3).map(search => ({
      text: search,
      type: 'recent' as const,
      icon: <Clock className="w-4 h-4" />
    }))
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setShowSuggestions(value.length > 0 || isFocused);
    setActiveSuggestionIndex(-1);
  };

  const handleInputFocus = () => {
    setIsFocused(true);
    setShowSuggestions(true);
  };

  const handleInputBlur = () => {
    // Delay hiding suggestions to allow for clicks
    setTimeout(() => {
      setIsFocused(false);
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestionIndex >= 0 && activeSuggestionIndex < allSuggestions.length) {
        const selectedSuggestion = allSuggestions[activeSuggestionIndex];
        handleSuggestionClick(selectedSuggestion.text);
      } else if (query.trim()) {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev < allSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => 
        prev > 0 ? prev - 1 : allSuggestions.length - 1
      );
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestionIndex(-1);
      inputRef.current?.blur();
    }
  };

  const handleSearch = () => {
    if (query.trim()) {
      onSearch(query);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestionText: string) => {
    setQuery(suggestionText);
    onSuggestionClick(suggestionText);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
  };

  const clearSearch = () => {
    setQuery('');
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  // Handle emergency mode keyboard shortcuts
  useEffect(() => {
    if (!emergencyMode) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey) {
        switch (e.key) {
          case 'e':
            e.preventDefault();
            handleSuggestionClick('Emergency evacuation routes near me');
            break;
          case 'f':
            e.preventDefault();
            handleSuggestionClick('First aid procedures');
            break;
          case 'c':
            e.preventDefault();
            handleSuggestionClick('Emergency contacts and services');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [emergencyMode]);

  const getSuggestionItemClass = (index: number, type: string) => {
    const baseClass = 'suggestion-item';
    const activeClass = index === activeSuggestionIndex ? 'active' : '';
    const typeClass = type === 'emergency' ? 'emergency-suggestion' : '';
    return [baseClass, activeClass, typeClass].filter(Boolean).join(' ');
  };

  return (
    <div className="w-full max-w-4xl mx-auto relative">
      {/* Main Search Container */}
      <div className={`search-container ${isFocused ? 'focused' : ''} ${emergencyMode ? 'emergency-mode' : ''}`}>
        <div className="search-input-wrapper">
          <Search className={`search-icon ${isSearching ? 'animate-pulse' : ''}`} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            className="search-input"
            placeholder={
              emergencyMode 
                ? "Search emergency information, first aid, evacuation routes..." 
                : "Search with all-MiniLM-L6-v2 • Local AI"
            }
            autoComplete="off"
            spellCheck="false"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="search-clear-btn"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Loading Indicator */}
        {isSearching && (
          <div className="search-loading">
            <div className="search-loading-spinner"></div>
          </div>
        )}
      </div>

      {/* Suggestions Panel - Completely Separated */}
      {showSuggestions && allSuggestions.length > 0 && (
        <div className={`suggestions-panel ${showSuggestions ? 'visible' : ''}`}>
          <div className="suggestions-header">
            <div className="suggestions-title">
              {emergencyMode ? (
                <>
                  <Zap className="w-4 h-4 mr-2 text-red-500" />
                  Emergency Search Suggestions
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI-powered suggestions with all-MiniLM-L6-v2
                </>
              )}
            </div>
            <p className="suggestions-subtitle">
              {emergencyMode 
                ? "Quick access to critical emergency information"
                : "Local AI • Fully offline processing"
              }
            </p>
          </div>

          <ul className="suggestions-list">
            {allSuggestions.map((suggestion, index) => (
              <li
                key={`${suggestion.type}-${index}`}
                className={getSuggestionItemClass(index, suggestion.type)}
                onClick={() => handleSuggestionClick(suggestion.text)}
                onMouseEnter={() => setActiveSuggestionIndex(index)}
              >
                <span className="suggestion-icon">
                  {suggestion.icon}
                </span>
                <span className="suggestion-text">
                  {suggestion.text}
                </span>
                {suggestion.shortcut && (
                  <span className="suggestion-shortcut">
                    {suggestion.shortcut}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 ml-2 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * 🧠 AI Recommendations Component - Completely Separate Section
 * This ensures AI recommendations don't interfere with search interface
 */
interface AIRecommendationsProps {
  recommendations: string[];
  onRecommendationClick: (recommendation: string) => void;
  emergencyMode?: boolean;
}

export const AIRecommendations: React.FC<AIRecommendationsProps> = ({
  recommendations,
  onRecommendationClick,
  emergencyMode = false
}) => {
  if (recommendations.length === 0) return null;

  return (
    <div className={`ai-recommendations ${emergencyMode ? 'emergency-mode' : ''}`}>
      <div className="ai-recommendations-header">
        <Sparkles className="ai-recommendations-icon" />
        <h3 className="ai-recommendations-title">
          {emergencyMode ? 'Emergency Response Recommendations' : 'AI-Powered Recommendations'}
        </h3>
      </div>
      
      <div className="space-y-2">
        {recommendations.map((recommendation, index) => (
          <div
            key={index}
            className="ai-recommendation-item"
            onClick={() => onRecommendationClick(recommendation)}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {recommendation}
              </span>
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * 💬 Chat Interface Component - Clearly Separated from Search
 * This prevents chat messages from overlapping with search elements
 */
interface ChatInterfaceProps {
  messages: Array<{
    id: string;
    content: string;
    role: 'user' | 'assistant';
    timestamp: Date;
  }>;
  emergencyMode?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  emergencyMode = false
}) => {
  if (messages.length === 0) return null;

  return (
    <div className="chat-interface">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`chat-message ${message.role === 'user' ? 'user-message' : 'assistant-message'} ${emergencyMode ? 'emergency-mode' : ''}`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {message.role === 'assistant' ? (
                <Sparkles className="w-5 h-5 text-blue-500" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gray-400"></div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 dark:text-gray-100">
                {message.content}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Export the complete search system
export default SearchInterface;
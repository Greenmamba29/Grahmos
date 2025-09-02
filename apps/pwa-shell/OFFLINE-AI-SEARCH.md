# GrahmOS Offline AI Search Architecture

## 🚀 Overview

GrahmOS implements a comprehensive offline-first AI search system that works without internet connectivity while optionally integrating with local OpenAI GPT-OSS instances for enhanced capabilities.

## 🏗️ Architecture Components

### 1. Multi-Layer Search System

```
┌─────────────────────────────────────────────────┐
│                Frontend UI                      │
│  (AISearchBar, ContentViewer, Search Results)  │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│              Smart AI Search                    │
│  (Handles fallbacks and routing)                │
└─────────────────────┬───────────────────────────┘
                      │
        ┌─────────────▼─────────────┐
        │                           │
┌───────▼────────┐         ┌────────▼────────────┐
│  Offline AI    │         │  Local OpenAI API  │
│  Search Engine │         │  (Optional)         │
│                │         │                     │
│ • Pattern      │         │ • GPT-3.5-turbo    │
│   Matching     │         │ • Custom Models     │
│ • Context      │         │ • Full AI Features  │
│   Memory       │         │                     │
│ • Smart        │         │                     │
│   Scoring      │         │                     │
└───────┬────────┘         └─────────────────────┘
        │
┌───────▼────────┐
│  Search Core   │
│                │
│ • Local Index  │
│ • Term Search  │
│ • Doc Storage  │
│                │
│ Emergency      │
│ Catalog Data   │
└────────────────┘
```

### 2. Core Components

#### **Offline AI Search Engine** (`/packages/ai-search/src/offline-ai.ts`)
- **Fully offline**: No external model downloads required
- **Context aware**: Learns from search history  
- **Smart scoring**: Advanced relevance algorithms
- **Emergency focused**: Optimized for emergency preparedness content

#### **Local OpenAI Integration** (`/apps/pwa-shell/src/app/api/ai/chat/route.ts`)
- **Local GPT-OSS**: Connects to local OpenAI-compatible APIs
- **Graceful fallback**: Falls back to offline responses if local AI unavailable
- **Configurable**: Support for multiple local AI setups

#### **Search Core** (`/packages/search-core/src/index.ts`)
- **In-memory indexing**: Fast local search
- **Emergency catalog**: Pre-loaded emergency preparedness content
- **Offline storage**: No external dependencies

## 🔧 Configuration

### Environment Variables

Create `.env.local` in `apps/pwa-shell/`:

```env
# Local OpenAI GPT-OSS Configuration
LOCAL_OPENAI_BASE_URL=http://localhost:1337/v1
LOCAL_OPENAI_API_KEY=sk-local
LOCAL_OPENAI_MODEL=gpt-3.5-turbo

# Enable AI features
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_OFFLINE_AI_ENABLED=true
```

### Supported Local AI Setups

| Setup | Base URL | Notes |
|-------|----------|-------|
| OpenAI GPT-OSS | `http://localhost:1337/v1` | Default configuration |
| LM Studio | `http://localhost:1234/v1` | Popular local AI server |
| Ollama | `http://localhost:11434/v1` | Requires OpenAI compatibility mode |
| LocalAI | `http://localhost:8080/v1` | Self-hosted OpenAI alternative |
| text-generation-webui | `http://localhost:5000/v1` | Advanced local setup |

## ⚡ Features

### Offline AI Search Capabilities

#### **Smart Pattern Matching**
- **Emergency Knowledge Base**: 100+ emergency scenarios and responses
- **Contextual Understanding**: Recognizes question patterns and intent
- **Multi-term Matching**: Handles complex queries with multiple concepts

#### **Context-Aware Search**
- **Search History**: Learns from previous queries
- **Related Topics**: Suggests relevant emergency topics
- **User Preferences**: Adapts to frequently searched categories

#### **Enhanced Results**
- **AI Summaries**: Generated summaries tailored to search queries
- **Relevance Scoring**: Advanced algorithms considering:
  - Direct term matches
  - Context relevance
  - Priority levels
  - Category preferences
  - Title matches

#### **Smart Suggestions**
- **Emergency-Specific**: Contextual suggestions for emergency topics
- **History-Based**: Suggestions from search patterns
- **Category-Aware**: Suggestions based on content categories

### Local AI Integration

#### **Chat Interface** 
- **Full Conversation**: Context-aware multi-turn conversations
- **Emergency Expertise**: Specialized in emergency preparedness
- **Graceful Degradation**: Falls back to offline responses

#### **Advanced Features** (with local AI)
- **Dynamic Responses**: Generated using local AI models
- **Context Memory**: Maintains conversation history
- **Personalization**: Adapts to user communication style

## 📚 Emergency Knowledge Base

### Categories Covered

| Category | Topics | Examples |
|----------|--------|----------|
| **Medical** | First aid, CPR, bleeding, choking | "How to perform CPR", "Stop severe bleeding" |
| **Natural Disasters** | Earthquakes, fires, floods, storms | "Earthquake safety", "Wildfire evacuation" |
| **Preparedness** | Kits, supplies, water, food | "Emergency kit", "Water storage" |
| **Navigation** | Evacuation, routes, shelters | "Evacuation routes", "Bay Area shelters" |
| **Communication** | Radio, phones, coordination | "Emergency communication", "Family contact plan" |
| **Utilities** | Power, gas, electricity | "Power outage", "Gas leak response" |

### Bay Area Specific Content

- **Earthquake Preparedness**: Fault lines, liquefaction zones
- **Wildfire Safety**: High-risk areas, evacuation routes
- **Flood Response**: SOMA flood zones, sea-level rise
- **Local Resources**: Moscone Center, Presidio shelters

## 🔍 Search Query Examples

### Basic Queries
```
"first aid"           → CPR, bleeding control, shock treatment
"earthquake"          → Drop/Cover/Hold On, aftershock safety
"water storage"       → 1 gallon/person/day, purification methods
"evacuation routes"   → Bay Area routes, shelter locations
```

### Advanced Queries
```
"what to do in earthquake"     → Comprehensive earthquake response
"how to stop bleeding"         → Step-by-step bleeding control
"emergency kit supplies"       → Complete supply checklist
"san francisco evacuation"     → SF-specific evacuation info
```

### Context-Aware Responses
The system remembers previous searches and provides contextually relevant follow-ups:

```
Search: "earthquake"
Follow-up: "first aid" → Enhanced focus on earthquake-related injuries

Search: "water" + "fire"
Context: → Water for fire suppression, emergency hydration during fires
```

## 🛠️ Implementation Details

### Performance Optimizations

#### **Efficient Indexing**
- **In-memory search**: Sub-100ms response times
- **Smart tokenization**: Filters stop words, optimizes term matching
- **Relevance caching**: Caches scoring calculations

#### **Progressive Enhancement**
1. **Base Search**: Always works, basic term matching
2. **Offline AI**: Enhanced with context and smart scoring
3. **Local AI**: Full conversational capabilities

#### **Service Worker Caching**
- **API Response Caching**: 24-hour cache for AI responses
- **Emergency Data**: Critical content cached for 7 days
- **Progressive Loading**: Loads content incrementally

### Error Handling

#### **Graceful Degradation**
```
Local AI Unavailable → Offline AI Search → Base Search → Error Message
```

#### **Fallback Chain**
1. **Try Local AI**: Connect to local OpenAI API
2. **Offline AI**: Use pattern matching and context
3. **Base Search**: Simple term matching
4. **Cache**: Return cached responses if available
5. **Error**: Friendly error with offline guidance

## 🚦 Status Indicators

### Connection States
- **🟢 Online**: Local AI + Offline AI available
- **🟡 Limited**: Offline AI only (no local AI connection)
- **🔴 Offline**: Base search + cached responses only

### AI Assistant States
- **Online**: Full conversational AI with local OpenAI
- **Fallback**: Advanced offline responses with context
- **Offline**: Basic emergency knowledge base

## 🔧 Troubleshooting

### Common Issues

#### **"AI search not working"**
1. Check if local OpenAI server is running
2. Verify environment variables in `.env.local`
3. Check browser console for connection errors
4. Try offline mode - should still provide results

#### **"No search results"**
1. Ensure `catalog.seed.json` is loading
2. Check network tab for API calls
3. Try basic terms like "emergency" or "first aid"
4. Clear browser cache and reload

#### **"Slow responses"**
1. Local AI server may be overloaded
2. Check available system resources
3. Try reducing model complexity
4. Use offline mode for faster responses

### Performance Tips

#### **Optimize Local AI**
- Use smaller models (e.g., 7B instead of 13B+)
- Allocate sufficient RAM (8GB+ recommended)
- Use GPU acceleration if available
- Set appropriate context length limits

#### **Browser Optimization**
- Enable service worker for caching
- Use modern browser with good JavaScript performance
- Clear cache periodically to prevent bloat
- Monitor memory usage in developer tools

## 🎯 Usage Recommendations

### **For Development**
- Enable both online and offline AI features
- Test fallback scenarios by disabling local AI
- Monitor performance with browser dev tools
- Use different query patterns to test context awareness

### **For Production**
- Configure reliable local AI endpoint
- Set appropriate cache expiration times  
- Monitor API response times and error rates
- Provide clear status indicators to users

### **For Offline Use**
- Pre-load all emergency content
- Test functionality without internet
- Ensure service worker is properly configured
- Verify critical features work offline

## 📈 Future Enhancements

### Planned Features
- **Voice Input**: Speech-to-text for hands-free queries
- **Multi-language**: Support for multiple languages
- **Advanced Context**: Cross-session learning and preferences
- **Real-time Updates**: Live emergency information integration

### Technical Improvements  
- **Vector Search**: Semantic similarity for better matching
- **Model Fine-tuning**: Emergency-specialized AI models
- **Edge Caching**: Distributed caching for faster responses
- **Progressive Web App**: Enhanced offline capabilities

---

*This architecture ensures GrahmOS provides reliable emergency information regardless of connectivity while leveraging local AI when available for enhanced user experience.*

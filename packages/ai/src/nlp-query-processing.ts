/**
 * Natural Language Query Processing System
 * 
 * This module provides conversational search capabilities including:
 * - Intent recognition and classification
 * - Entity extraction and query understanding
 * - Natural language to structured query conversion
 * - Contextual conversation management
 * - Intelligent response generation
 */

import { z } from 'zod';
import OpenAI from 'openai';
import natural from 'natural';

// Types and Schemas
export interface QueryIntent {
  intent: string;
  confidence: number;
  entities: ExtractedEntity[];
  parameters: Record<string, any>;
}

export interface ExtractedEntity {
  type: string;
  value: string;
  confidence: number;
  start: number;
  end: number;
}

export interface ConversationContext {
  sessionId: string;
  userId?: string;
  messages: ConversationMessage[];
  currentIntent?: QueryIntent;
  previousIntents: QueryIntent[];
  metadata: Record<string, any>;
  timestamp: number;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  intent?: QueryIntent;
  metadata?: Record<string, any>;
}

export interface StructuredQuery {
  type: 'search' | 'filter' | 'aggregate' | 'command' | 'question';
  operation: string;
  parameters: Record<string, any>;
  filters: QueryFilter[];
  sorting?: QuerySort;
  pagination?: QueryPagination;
  confidence: number;
}

export interface QueryFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'regex';
  value: any;
}

export interface QuerySort {
  field: string;
  order: 'asc' | 'desc';
}

export interface QueryPagination {
  limit: number;
  offset: number;
}

export interface QueryResponse {
  id: string;
  query: string;
  intent: QueryIntent;
  structuredQuery: StructuredQuery;
  results: QueryResult[];
  response: string;
  suggestions: string[];
  confidence: number;
  processingTime: number;
  metadata: Record<string, any>;
}

export interface QueryResult {
  id: string;
  type: string;
  title: string;
  content: string;
  relevanceScore: number;
  metadata: Record<string, any>;
}

// Configuration Schema
export const NLPQueryConfigSchema = z.object({
  openai: z.object({
    apiKey: z.string(),
    model: z.string().default('gpt-4-turbo-preview'),
    maxTokens: z.number().default(2000),
    temperature: z.number().default(0.1)
  }),
  intents: z.object({
    threshold: z.number().default(0.7),
    supportedIntents: z.array(z.string()).default([
      'search', 'filter', 'compare', 'summarize', 'explain', 'find', 'list', 'count', 'help'
    ])
  }),
  entities: z.object({
    customEntities: z.record(z.array(z.string())).default({}),
    threshold: z.number().default(0.6)
  }),
  conversation: z.object({
    maxHistory: z.number().default(10),
    sessionTimeout: z.number().default(30 * 60 * 1000) // 30 minutes
  }),
  search: z.object({
    maxResults: z.number().default(20),
    defaultSort: z.string().default('relevance'),
    enableFacets: z.boolean().default(true)
  })
});

export type NLPQueryConfig = z.infer<typeof NLPQueryConfigSchema>;

/**
 * Intent Classification System
 */
export class IntentClassifier {
  private tokenizer: natural.WordTokenizer;
  private stemmer: natural.PorterStemmer;
  private tfidf: natural.TfIdf;
  private intentPatterns: Map<string, RegExp[]> = new Map();

  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
    this.tfidf = new natural.TfIdf();
    this.initializeIntentPatterns();
  }

  private initializeIntentPatterns(): void {
    this.intentPatterns.set('search', [
      /\b(search|find|look|locate)\b/i,
      /\b(show me|get me|give me)\b/i,
      /\b(what is|what are|where is|where are)\b/i
    ]);

    this.intentPatterns.set('filter', [
      /\b(filter|where|only|exclude)\b/i,
      /\b(between|from|to|after|before)\b/i,
      /\b(greater than|less than|equal to)\b/i
    ]);

    this.intentPatterns.set('compare', [
      /\b(compare|versus|vs|difference|similar)\b/i,
      /\b(better|worse|best|worst)\b/i,
      /\b(like|unlike|same as|different from)\b/i
    ]);

    this.intentPatterns.set('summarize', [
      /\b(summarize|summary|overview|brief)\b/i,
      /\b(tell me about|explain briefly)\b/i,
      /\b(main points|key points|highlights)\b/i
    ]);

    this.intentPatterns.set('explain', [
      /\b(explain|how|why|what does)\b/i,
      /\b(meaning|definition|concept)\b/i,
      /\b(help me understand|clarify)\b/i
    ]);

    this.intentPatterns.set('count', [
      /\b(count|number|how many|total)\b/i,
      /\b(statistics|stats|metrics)\b/i
    ]);

    this.intentPatterns.set('list', [
      /\b(list|show all|display|enumerate)\b/i,
      /\b(everything|all items|complete list)\b/i
    ]);
  }

  classifyIntent(query: string): QueryIntent {
    const tokens = this.tokenizer.tokenize(query.toLowerCase()) || [];
    const stemmedTokens = tokens.map(token => this.stemmer.stem(token));
    
    let bestIntent = 'search';
    let maxScore = 0;
    const entities: ExtractedEntity[] = [];

    // Pattern-based classification
    for (const [intent, patterns] of this.intentPatterns) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(query)) {
          score += 1;
        }
      }
      
      if (score > maxScore) {
        maxScore = score;
        bestIntent = intent;
      }
    }

    // Extract entities
    const extractedEntities = this.extractEntities(query);
    entities.push(...extractedEntities);

    // Calculate confidence
    const confidence = Math.min(0.9, Math.max(0.3, maxScore / 3));

    return {
      intent: bestIntent,
      confidence,
      entities,
      parameters: this.extractParameters(query, bestIntent)
    };
  }

  private extractEntities(query: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Extract dates
    const datePatterns = [
      /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\b/g,
      /\b(today|yesterday|tomorrow|last week|next week)\b/gi,
      /\b(\d{1,2}\s+(days?|weeks?|months?|years?)\s+ago)\b/gi
    ];

    for (const pattern of datePatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        entities.push({
          type: 'date',
          value: match[1],
          confidence: 0.8,
          start: match.index,
          end: match.index + match[1].length
        });
      }
    }

    // Extract numbers
    const numberPattern = /\b(\d+(?:\.\d+)?)\b/g;
    let match;
    while ((match = numberPattern.exec(query)) !== null) {
      entities.push({
        type: 'number',
        value: match[1],
        confidence: 0.9,
        start: match.index,
        end: match.index + match[1].length
      });
    }

    // Extract file types
    const fileTypePattern = /\b(\w+)\s+files?\b/gi;
    while ((match = fileTypePattern.exec(query)) !== null) {
      entities.push({
        type: 'file_type',
        value: match[1].toLowerCase(),
        confidence: 0.7,
        start: match.index,
        end: match.index + match[0].length
      });
    }

    return entities;
  }

  private extractParameters(query: string, intent: string): Record<string, any> {
    const params: Record<string, any> = {};
    
    switch (intent) {
      case 'search':
        params.keywords = this.extractKeywords(query);
        break;
      case 'filter':
        params.conditions = this.extractFilterConditions(query);
        break;
      case 'count':
        params.countType = this.extractCountType(query);
        break;
    }

    return params;
  }

  private extractKeywords(query: string): string[] {
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const tokens = this.tokenizer.tokenize(query.toLowerCase()) || [];
    
    return tokens
      .filter(token => !stopWords.includes(token) && token.length > 2)
      .map(token => this.stemmer.stem(token));
  }

  private extractFilterConditions(query: string): any[] {
    const conditions: any[] = [];
    
    // Extract comparison conditions
    const comparisonPatterns = [
      { pattern: /(\w+)\s*(greater than|>)\s*(\d+)/gi, operator: 'gt' },
      { pattern: /(\w+)\s*(less than|<)\s*(\d+)/gi, operator: 'lt' },
      { pattern: /(\w+)\s*(equal to|equals?|=)\s*(\w+)/gi, operator: 'eq' }
    ];

    for (const { pattern, operator } of comparisonPatterns) {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        conditions.push({
          field: match[1],
          operator,
          value: isNaN(Number(match[3])) ? match[3] : Number(match[3])
        });
      }
    }

    return conditions;
  }

  private extractCountType(query: string): string {
    if (/\bfiles?\b/i.test(query)) return 'files';
    if (/\busers?\b/i.test(query)) return 'users';
    if (/\bdocuments?\b/i.test(query)) return 'documents';
    return 'items';
  }
}

/**
 * Query Structure Generator
 */
export class QueryStructureGenerator {
  constructor(private config: NLPQueryConfig) {}

  generateStructuredQuery(intent: QueryIntent, query: string): StructuredQuery {
    switch (intent.intent) {
      case 'search':
        return this.generateSearchQuery(intent, query);
      case 'filter':
        return this.generateFilterQuery(intent, query);
      case 'count':
        return this.generateAggregateQuery(intent, query);
      case 'compare':
        return this.generateCompareQuery(intent, query);
      default:
        return this.generateGenericQuery(intent, query);
    }
  }

  private generateSearchQuery(intent: QueryIntent, query: string): StructuredQuery {
    const keywords = intent.parameters.keywords || [];
    const entities = intent.entities;
    
    const filters: QueryFilter[] = [];
    
    // Add file type filters
    const fileTypeEntities = entities.filter(e => e.type === 'file_type');
    if (fileTypeEntities.length > 0) {
      filters.push({
        field: 'type',
        operator: 'in',
        value: fileTypeEntities.map(e => e.value)
      });
    }

    // Add date filters
    const dateEntities = entities.filter(e => e.type === 'date');
    if (dateEntities.length > 0) {
      filters.push({
        field: 'created_at',
        operator: 'gte',
        value: this.parseDateEntity(dateEntities[0].value)
      });
    }

    return {
      type: 'search',
      operation: 'full_text_search',
      parameters: {
        query: keywords.join(' '),
        fields: ['title', 'content', 'tags']
      },
      filters,
      sorting: { field: 'relevance', order: 'desc' },
      pagination: { limit: this.config.search.maxResults, offset: 0 },
      confidence: intent.confidence
    };
  }

  private generateFilterQuery(intent: QueryIntent, query: string): StructuredQuery {
    const conditions = intent.parameters.conditions || [];
    const filters: QueryFilter[] = conditions.map((condition: any) => ({
      field: condition.field,
      operator: condition.operator,
      value: condition.value
    }));

    return {
      type: 'filter',
      operation: 'filter_data',
      parameters: { conditions },
      filters,
      confidence: intent.confidence
    };
  }

  private generateAggregateQuery(intent: QueryIntent, query: string): StructuredQuery {
    const countType = intent.parameters.countType || 'items';
    
    return {
      type: 'aggregate',
      operation: 'count',
      parameters: {
        groupBy: countType,
        metric: 'count'
      },
      filters: [],
      confidence: intent.confidence
    };
  }

  private generateCompareQuery(intent: QueryIntent, query: string): StructuredQuery {
    const entities = intent.entities.filter(e => e.type !== 'date' && e.type !== 'number');
    const compareItems = entities.map(e => e.value);

    return {
      type: 'search',
      operation: 'compare_items',
      parameters: {
        items: compareItems,
        fields: ['title', 'content', 'metadata']
      },
      filters: [],
      confidence: intent.confidence
    };
  }

  private generateGenericQuery(intent: QueryIntent, query: string): StructuredQuery {
    return {
      type: 'question',
      operation: 'answer_question',
      parameters: {
        question: query,
        context: intent.entities
      },
      filters: [],
      confidence: intent.confidence
    };
  }

  private parseDateEntity(dateStr: string): number {
    if (dateStr === 'today') {
      return Date.now() - 24 * 60 * 60 * 1000;
    } else if (dateStr === 'yesterday') {
      return Date.now() - 48 * 60 * 60 * 1000;
    } else if (dateStr === 'last week') {
      return Date.now() - 7 * 24 * 60 * 60 * 1000;
    }
    
    return new Date(dateStr).getTime();
  }
}

/**
 * Response Generator
 */
export class ResponseGenerator {
  private openai: OpenAI;

  constructor(private config: NLPQueryConfig) {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey
    });
  }

  async generateResponse(
    query: string,
    intent: QueryIntent,
    structuredQuery: StructuredQuery,
    results: QueryResult[],
    context?: ConversationContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(intent.intent);
    const userPrompt = this.buildUserPrompt(query, intent, structuredQuery, results, context);

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.config.openai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature
      });

      return completion.choices[0]?.message?.content || 'I apologize, but I couldn\'t generate a response for your query.';
    } catch (error) {
      console.error('Error generating response:', error);
      return this.generateFallbackResponse(intent.intent, results);
    }
  }

  private buildSystemPrompt(intent: string): string {
    const basePrompt = `You are an intelligent assistant helping users with their queries. Your goal is to provide helpful, accurate, and concise responses.`;

    const intentSpecificPrompts: Record<string, string> = {
      search: `${basePrompt} Focus on presenting search results in a clear, organized manner. Highlight the most relevant information.`,
      filter: `${basePrompt} Help users understand filtered results and suggest additional filters if relevant.`,
      compare: `${basePrompt} Provide balanced comparisons highlighting key differences and similarities.`,
      summarize: `${basePrompt} Create concise summaries that capture the most important information.`,
      explain: `${basePrompt} Provide clear explanations that are easy to understand, breaking down complex topics.`,
      count: `${basePrompt} Present numerical results clearly and provide context about what the numbers mean.`,
      list: `${basePrompt} Organize lists in a logical, easy-to-scan format.`
    };

    return intentSpecificPrompts[intent] || basePrompt;
  }

  private buildUserPrompt(
    query: string,
    intent: QueryIntent,
    structuredQuery: StructuredQuery,
    results: QueryResult[],
    context?: ConversationContext
  ): string {
    let prompt = `User query: "${query}"\n`;
    prompt += `Intent: ${intent.intent} (confidence: ${intent.confidence.toFixed(2)})\n`;
    
    if (intent.entities.length > 0) {
      prompt += `Extracted entities: ${intent.entities.map(e => `${e.type}:${e.value}`).join(', ')}\n`;
    }

    prompt += `\nQuery results (${results.length} found):\n`;
    results.slice(0, 5).forEach((result, index) => {
      prompt += `${index + 1}. ${result.title}\n`;
      prompt += `   Content: ${result.content.substring(0, 200)}...\n`;
      prompt += `   Relevance: ${result.relevanceScore.toFixed(2)}\n\n`;
    });

    if (context && context.messages.length > 1) {
      prompt += `\nConversation context:\n`;
      context.messages.slice(-3).forEach(msg => {
        if (msg.role !== 'system') {
          prompt += `${msg.role}: ${msg.content}\n`;
        }
      });
    }

    prompt += `\nPlease provide a helpful response to the user's query based on the search results and context.`;

    return prompt;
  }

  private generateFallbackResponse(intent: string, results: QueryResult[]): string {
    if (results.length === 0) {
      return "I couldn't find any results matching your query. Try using different keywords or broadening your search.";
    }

    switch (intent) {
      case 'search':
        return `I found ${results.length} results for your search. The most relevant result is "${results[0].title}".`;
      case 'count':
        return `I found ${results.length} items matching your criteria.`;
      case 'list':
        return `Here are the results: ${results.slice(0, 3).map(r => r.title).join(', ')}${results.length > 3 ? ` and ${results.length - 3} more.` : ''}`;
      default:
        return `I found ${results.length} results that might help answer your question.`;
    }
  }

  generateSuggestions(query: string, intent: QueryIntent, results: QueryResult[]): string[] {
    const suggestions: string[] = [];

    // Intent-based suggestions
    switch (intent.intent) {
      case 'search':
        if (results.length > 0) {
          suggestions.push(`Show me more like "${results[0].title}"`);
          suggestions.push('Filter these results by date');
          suggestions.push('Summarize these findings');
        }
        suggestions.push('Expand the search to include related terms');
        break;
      
      case 'filter':
        suggestions.push('Remove some filters to see more results');
        suggestions.push('Add additional filters');
        suggestions.push('Sort results differently');
        break;
      
      case 'compare':
        suggestions.push('Show detailed comparison');
        suggestions.push('Include more items in comparison');
        suggestions.push('Focus on specific aspects');
        break;
    }

    // Entity-based suggestions
    const fileTypeEntities = intent.entities.filter(e => e.type === 'file_type');
    if (fileTypeEntities.length === 0) {
      suggestions.push('Filter by file type');
    }

    const dateEntities = intent.entities.filter(e => e.type === 'date');
    if (dateEntities.length === 0) {
      suggestions.push('Filter by date range');
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }
}

/**
 * Main Natural Language Query Processing System
 */
export class NLPQueryProcessor {
  private config: NLPQueryConfig;
  private intentClassifier: IntentClassifier;
  private queryGenerator: QueryStructureGenerator;
  private responseGenerator: ResponseGenerator;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor(config: Partial<NLPQueryConfig>) {
    this.config = NLPQueryConfigSchema.parse(config);
    this.intentClassifier = new IntentClassifier();
    this.queryGenerator = new QueryStructureGenerator(this.config);
    this.responseGenerator = new ResponseGenerator(this.config);
  }

  async processQuery(
    query: string,
    sessionId: string,
    userId?: string,
    searchFunction?: (structuredQuery: StructuredQuery) => Promise<QueryResult[]>
  ): Promise<QueryResponse> {
    const startTime = Date.now();
    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Get or create conversation context
      const context = this.getOrCreateContext(sessionId, userId);
      
      // Classify intent
      const intent = this.intentClassifier.classifyIntent(query);
      
      // Generate structured query
      const structuredQuery = this.queryGenerator.generateStructuredQuery(intent, query);
      
      // Execute search if function provided
      let results: QueryResult[] = [];
      if (searchFunction) {
        results = await searchFunction(structuredQuery);
      } else {
        results = this.generateMockResults(structuredQuery);
      }

      // Generate response
      const response = await this.responseGenerator.generateResponse(
        query, intent, structuredQuery, results, context
      );

      // Generate suggestions
      const suggestions = this.responseGenerator.generateSuggestions(query, intent, results);

      // Update conversation context
      this.updateConversationContext(context, query, intent, response);

      const processingTime = Date.now() - startTime;

      const queryResponse: QueryResponse = {
        id: queryId,
        query,
        intent,
        structuredQuery,
        results,
        response,
        suggestions,
        confidence: intent.confidence,
        processingTime,
        metadata: {
          sessionId,
          userId,
          timestamp: Date.now()
        }
      };

      return queryResponse;
    } catch (error) {
      console.error('Error processing query:', error);
      
      return {
        id: queryId,
        query,
        intent: { intent: 'error', confidence: 0, entities: [], parameters: {} },
        structuredQuery: { type: 'search', operation: 'error', parameters: {}, filters: [], confidence: 0 },
        results: [],
        response: 'I apologize, but I encountered an error while processing your query. Please try again.',
        suggestions: ['Try rephrasing your question', 'Use simpler terms'],
        confidence: 0,
        processingTime: Date.now() - startTime,
        metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  private getOrCreateContext(sessionId: string, userId?: string): ConversationContext {
    let context = this.conversations.get(sessionId);
    
    if (!context || Date.now() - context.timestamp > this.config.conversation.sessionTimeout) {
      context = {
        sessionId,
        userId,
        messages: [],
        previousIntents: [],
        metadata: {},
        timestamp: Date.now()
      };
      this.conversations.set(sessionId, context);
    }

    return context;
  }

  private updateConversationContext(
    context: ConversationContext,
    query: string,
    intent: QueryIntent,
    response: string
  ): void {
    // Add user message
    context.messages.push({
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: query,
      timestamp: Date.now(),
      intent
    });

    // Add assistant response
    context.messages.push({
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    // Trim messages to max history
    if (context.messages.length > this.config.conversation.maxHistory * 2) {
      context.messages = context.messages.slice(-this.config.conversation.maxHistory * 2);
    }

    // Update intents
    context.currentIntent = intent;
    context.previousIntents.push(intent);
    if (context.previousIntents.length > 5) {
      context.previousIntents = context.previousIntents.slice(-5);
    }

    context.timestamp = Date.now();
  }

  private generateMockResults(structuredQuery: StructuredQuery): QueryResult[] {
    // Generate mock results for testing
    const mockResults: QueryResult[] = [];
    const resultCount = Math.floor(Math.random() * 10) + 1;

    for (let i = 0; i < resultCount; i++) {
      mockResults.push({
        id: `result_${i}`,
        type: 'document',
        title: `Sample Document ${i + 1}`,
        content: `This is a sample document that matches your ${structuredQuery.type} query. It contains relevant information about your search terms.`,
        relevanceScore: Math.random() * 0.5 + 0.5, // 0.5-1.0
        metadata: {
          created_at: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
          type: 'document',
          size: Math.floor(Math.random() * 10000)
        }
      });
    }

    return mockResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  getConversationHistory(sessionId: string): ConversationMessage[] {
    const context = this.conversations.get(sessionId);
    return context ? context.messages : [];
  }

  clearConversation(sessionId: string): void {
    this.conversations.delete(sessionId);
  }

  getActiveConversations(): number {
    return this.conversations.size;
  }
}

export default NLPQueryProcessor;

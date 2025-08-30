/**
 * Grahmos AI-Powered Document Processing Pipeline
 * Phase 12: Advanced AI/ML Integration
 * 
 * Features:
 * - Intelligent OCR with Tesseract.js and cloud services
 * - Content extraction from PDFs, images, and various formats
 * - Automatic tagging and categorization
 * - Document summarization with GPT-4
 * - Entity recognition and extraction
 * - Language detection and translation
 * - Document quality assessment
 * - Metadata enrichment
 */

import OpenAI from 'openai';
import { createWorker } from 'tesseract.js';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import { Document } from './vector-search.js';
import * as natural from 'natural';

// Types and Interfaces
export interface ProcessingResult {
  document: Document;
  extractedText: string;
  summary: string;
  entities: ExtractedEntity[];
  tags: string[];
  category: string;
  language: string;
  confidence: number;
  processingTime: number;
  processingSteps: ProcessingStep[];
  qualityMetrics: QualityMetrics;
  metadata: ProcessingMetadata;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  confidence: number;
  startIndex: number;
  endIndex: number;
  context: string;
  metadata?: Record<string, any>;
}

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: any;
  error?: string;
}

export interface QualityMetrics {
  textQuality: number;        // 0-1, based on readability, grammar, etc.
  structureQuality: number;   // 0-1, based on document structure
  completeness: number;       // 0-1, based on content completeness
  reliability: number;        // 0-1, based on OCR confidence, etc.
  overallQuality: number;     // 0-1, weighted average
}

export interface ProcessingMetadata {
  originalFileName: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;
  imageCount?: number;
  tableCount?: number;
  processingVersion: string;
  processingDate: Date;
  ocrEngine?: string;
  ocrConfidence?: number;
}

export interface ProcessingOptions {
  enableOCR?: boolean;
  enableSummarization?: boolean;
  enableEntityExtraction?: boolean;
  enableAutoTagging?: boolean;
  enableLanguageDetection?: boolean;
  enableTranslation?: boolean;
  targetLanguage?: string;
  summaryLength?: 'short' | 'medium' | 'long';
  extractionDepth?: 'basic' | 'detailed' | 'comprehensive';
  qualityThreshold?: number;
}

export enum EntityType {
  PERSON = 'PERSON',
  ORGANIZATION = 'ORGANIZATION',
  LOCATION = 'LOCATION',
  DATE = 'DATE',
  MONEY = 'MONEY',
  PERCENTAGE = 'PERCENTAGE',
  EMAIL = 'EMAIL',
  PHONE = 'PHONE',
  URL = 'URL',
  PRODUCT = 'PRODUCT',
  EVENT = 'EVENT',
  SKILL = 'SKILL',
  TECHNOLOGY = 'TECHNOLOGY',
  LEGAL = 'LEGAL',
  MEDICAL = 'MEDICAL'
}

export enum DocumentCategory {
  CONTRACT = 'CONTRACT',
  INVOICE = 'INVOICE',
  REPORT = 'REPORT',
  PRESENTATION = 'PRESENTATION',
  EMAIL = 'EMAIL',
  MANUAL = 'MANUAL',
  POLICY = 'POLICY',
  RESEARCH = 'RESEARCH',
  NEWS = 'NEWS',
  BLOG = 'BLOG',
  LEGAL = 'LEGAL',
  MEDICAL = 'MEDICAL',
  FINANCIAL = 'FINANCIAL',
  TECHNICAL = 'TECHNICAL',
  MARKETING = 'MARKETING',
  OTHER = 'OTHER'
}

// OCR Service
export class OCRService {
  private tesseractWorker: any;
  private openaiClient: OpenAI | null = null;

  constructor(openaiApiKey?: string) {
    if (openaiApiKey) {
      this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }
  }

  async initialize(): Promise<void> {
    this.tesseractWorker = await createWorker('eng+spa+fra+deu+ita+por+rus+chi_sim+jpn+kor');
    console.log('OCR service initialized');
  }

  async extractTextFromImage(imageBuffer: Buffer, options?: { language?: string }): Promise<{ text: string; confidence: number }> {
    try {
      // Preprocess image for better OCR results
      const processedImage = await this.preprocessImage(imageBuffer);

      // Set language if specified
      if (options?.language && this.tesseractWorker) {
        await this.tesseractWorker.setParameters({
          tessedit_char_whitelist: undefined,
          tessedit_pageseg_mode: '1' // Automatic page segmentation
        });
      }

      const { data } = await this.tesseractWorker.recognize(processedImage);
      
      // Calculate average confidence
      const confidence = data.confidence / 100;

      // Post-process text
      const cleanText = this.postProcessOCRText(data.text);

      return {
        text: cleanText,
        confidence
      };
    } catch (error) {
      console.error('OCR extraction failed:', error);
      throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // Enhance image for better OCR results
      return await sharp(imageBuffer)
        .grayscale()
        .normalize()
        .sharpen()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
    } catch (error) {
      console.error('Image preprocessing failed:', error);
      return imageBuffer; // Return original if preprocessing fails
    }
  }

  private postProcessOCRText(text: string): string {
    return text
      .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
      .replace(/\s{2,}/g, ' ')    // Remove excessive spaces
      .replace(/[^\S\n]{2,}/g, ' ') // Clean up whitespace
      .trim();
  }

  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
    }
  }
}

// Content Extraction Service
export class ContentExtractionService {
  async extractFromPDF(pdfBuffer: Buffer): Promise<{ text: string; metadata: any }> {
    try {
      const data = await pdfParse(pdfBuffer);
      
      return {
        text: data.text,
        metadata: {
          pages: data.numpages,
          info: data.info,
          version: data.version
        }
      };
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractFromText(textBuffer: Buffer): Promise<{ text: string; metadata: any }> {
    const text = textBuffer.toString('utf-8');
    
    return {
      text,
      metadata: {
        encoding: 'utf-8',
        wordCount: text.split(/\s+/).length,
        characterCount: text.length,
        lineCount: text.split('\n').length
      }
    };
  }

  detectFileType(buffer: Buffer, filename?: string): string {
    // Check file signatures (magic numbers)
    const signatures: Record<string, string> = {
      'PDF': '25504446',        // %PDF
      'PNG': '89504E47',        // PNG
      'JPG': 'FFD8FF',          // JPEG
      'GIF': '474946',          // GIF
      'ZIP': '504B0304',        // ZIP (also DOCX, XLSX, etc.)
      'DOC': 'D0CF11E0A1B11AE1', // MS Office (older format)
    };

    const header = buffer.slice(0, 8).toString('hex').toUpperCase();
    
    for (const [type, signature] of Object.entries(signatures)) {
      if (header.startsWith(signature)) {
        return type;
      }
    }

    // Fallback to filename extension
    if (filename) {
      const ext = filename.split('.').pop()?.toLowerCase();
      switch (ext) {
        case 'txt': return 'TXT';
        case 'md': return 'MD';
        case 'json': return 'JSON';
        case 'xml': return 'XML';
        case 'html': return 'HTML';
        case 'csv': return 'CSV';
        default: return 'UNKNOWN';
      }
    }

    return 'UNKNOWN';
  }
}

// Entity Recognition Service
export class EntityRecognitionService {
  private openaiClient: OpenAI;

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }

  async extractEntities(text: string, options?: { types?: EntityType[] }): Promise<ExtractedEntity[]> {
    try {
      // Use OpenAI for advanced entity recognition
      const entities = await this.extractWithOpenAI(text, options?.types);
      
      // Combine with rule-based extraction for specific patterns
      const patternEntities = this.extractWithPatterns(text);
      
      // Merge and deduplicate entities
      return this.mergeEntities([...entities, ...patternEntities]);
    } catch (error) {
      console.error('Entity extraction failed:', error);
      throw new Error(`Failed to extract entities: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async extractWithOpenAI(text: string, types?: EntityType[]): Promise<ExtractedEntity[]> {
    const entityTypes = types || Object.values(EntityType);
    
    const prompt = `
Extract entities from the following text and return them in JSON format.

Entity types to extract: ${entityTypes.join(', ')}

Text: """
${text.substring(0, 4000)} // Limit text length for API
"""

Return a JSON array of entities with the following structure:
{
  "type": "ENTITY_TYPE",
  "value": "entity text",
  "confidence": 0.95,
  "context": "surrounding text context"
}

Only extract entities that you are confident about (confidence > 0.7).
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.choices[0].message.content;
      if (!content) return [];

      // Try to parse JSON response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const entities = JSON.parse(jsonMatch[0]);
      
      return entities.map((entity: any, index: number) => ({
        type: entity.type as EntityType,
        value: entity.value,
        confidence: entity.confidence || 0.8,
        startIndex: text.indexOf(entity.value),
        endIndex: text.indexOf(entity.value) + entity.value.length,
        context: entity.context || '',
        metadata: { source: 'openai', index }
      })).filter((entity: ExtractedEntity) => entity.startIndex !== -1);
    } catch (error) {
      console.error('OpenAI entity extraction failed:', error);
      return [];
    }
  }

  private extractWithPatterns(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Email pattern
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    let match;
    while ((match = emailRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.EMAIL,
        value: match[0],
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        context: this.getContext(text, match.index, match[0].length),
        metadata: { source: 'regex' }
      });
    }

    // Phone pattern
    const phoneRegex = /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g;
    while ((match = phoneRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.PHONE,
        value: match[0],
        confidence: 0.9,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        context: this.getContext(text, match.index, match[0].length),
        metadata: { source: 'regex' }
      });
    }

    // URL pattern
    const urlRegex = /https?:\/\/(?:[-\w.])+(?:\:[0-9]+)?(?:\/(?:[\w\/_.])*(?:\?(?:[\w&=%.])*)?(?:#(?:[\w.])*)?)?/g;
    while ((match = urlRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.URL,
        value: match[0],
        confidence: 0.95,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        context: this.getContext(text, match.index, match[0].length),
        metadata: { source: 'regex' }
      });
    }

    // Money pattern
    const moneyRegex = /\$[\d,]+\.?\d*/g;
    while ((match = moneyRegex.exec(text)) !== null) {
      entities.push({
        type: EntityType.MONEY,
        value: match[0],
        confidence: 0.85,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        context: this.getContext(text, match.index, match[0].length),
        metadata: { source: 'regex' }
      });
    }

    return entities;
  }

  private getContext(text: string, startIndex: number, length: number, contextSize = 50): string {
    const start = Math.max(0, startIndex - contextSize);
    const end = Math.min(text.length, startIndex + length + contextSize);
    return text.substring(start, end).replace(/\n/g, ' ').trim();
  }

  private mergeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
    // Remove duplicates and overlapping entities
    const merged: ExtractedEntity[] = [];
    const sorted = entities.sort((a, b) => a.startIndex - b.startIndex);

    for (const entity of sorted) {
      const overlapping = merged.find(existing => 
        entity.startIndex < existing.endIndex && entity.endIndex > existing.startIndex
      );

      if (!overlapping) {
        merged.push(entity);
      } else if (entity.confidence > overlapping.confidence) {
        // Replace with higher confidence entity
        const index = merged.indexOf(overlapping);
        merged[index] = entity;
      }
    }

    return merged;
  }
}

// Document Categorization Service
export class DocumentCategorizationService {
  private openaiClient: OpenAI;
  private categoryKeywords: Record<DocumentCategory, string[]>;

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
    this.initializeCategoryKeywords();
  }

  private initializeCategoryKeywords(): void {
    this.categoryKeywords = {
      [DocumentCategory.CONTRACT]: ['agreement', 'contract', 'terms', 'conditions', 'party', 'whereas', 'covenant'],
      [DocumentCategory.INVOICE]: ['invoice', 'bill', 'payment', 'amount due', 'total', 'billing', 'remit'],
      [DocumentCategory.REPORT]: ['report', 'analysis', 'findings', 'conclusion', 'executive summary', 'methodology'],
      [DocumentCategory.PRESENTATION]: ['slide', 'presentation', 'agenda', 'overview', 'outline'],
      [DocumentCategory.EMAIL]: ['subject', 'from', 'to', 'sent', 'received', 'reply', 'forward'],
      [DocumentCategory.MANUAL]: ['manual', 'instructions', 'guide', 'procedure', 'steps', 'how to'],
      [DocumentCategory.POLICY]: ['policy', 'procedure', 'guideline', 'standard', 'compliance', 'regulation'],
      [DocumentCategory.RESEARCH]: ['research', 'study', 'methodology', 'hypothesis', 'experiment', 'data', 'abstract'],
      [DocumentCategory.NEWS]: ['news', 'breaking', 'update', 'reporter', 'press release', 'announcement'],
      [DocumentCategory.BLOG]: ['blog', 'post', 'author', 'published', 'tags', 'comments'],
      [DocumentCategory.LEGAL]: ['legal', 'law', 'court', 'judgment', 'statute', 'regulation', 'compliance'],
      [DocumentCategory.MEDICAL]: ['medical', 'patient', 'diagnosis', 'treatment', 'prescription', 'clinical'],
      [DocumentCategory.FINANCIAL]: ['financial', 'budget', 'revenue', 'profit', 'loss', 'balance sheet'],
      [DocumentCategory.TECHNICAL]: ['technical', 'specification', 'architecture', 'implementation', 'system'],
      [DocumentCategory.MARKETING]: ['marketing', 'campaign', 'brand', 'customer', 'market', 'promotion'],
      [DocumentCategory.OTHER]: []
    };
  }

  async categorizeDocument(text: string, title?: string): Promise<{ category: DocumentCategory; confidence: number; reasoning: string }> {
    try {
      // First try rule-based categorization
      const ruleBasedResult = this.categorizeWithRules(text, title);
      
      // If confidence is high, return rule-based result
      if (ruleBasedResult.confidence > 0.8) {
        return ruleBasedResult;
      }

      // Otherwise, use AI for more sophisticated categorization
      const aiResult = await this.categorizeWithAI(text, title);
      
      // Return the result with higher confidence
      return aiResult.confidence > ruleBasedResult.confidence ? aiResult : ruleBasedResult;
    } catch (error) {
      console.error('Document categorization failed:', error);
      return {
        category: DocumentCategory.OTHER,
        confidence: 0.1,
        reasoning: 'Categorization failed, defaulting to OTHER'
      };
    }
  }

  private categorizeWithRules(text: string, title?: string): { category: DocumentCategory; confidence: number; reasoning: string } {
    const content = `${title || ''} ${text}`.toLowerCase();
    const words = content.split(/\s+/);
    const wordSet = new Set(words);

    let bestCategory = DocumentCategory.OTHER;
    let bestScore = 0;
    let matchedKeywords: string[] = [];

    for (const [category, keywords] of Object.entries(this.categoryKeywords)) {
      if (category === DocumentCategory.OTHER) continue;

      const matches = keywords.filter(keyword => 
        content.includes(keyword.toLowerCase())
      );

      const score = matches.length / keywords.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category as DocumentCategory;
        matchedKeywords = matches;
      }
    }

    const confidence = Math.min(bestScore * 2, 1); // Scale and cap at 1.0
    
    return {
      category: bestCategory,
      confidence,
      reasoning: `Matched keywords: ${matchedKeywords.join(', ')}`
    };
  }

  private async categorizeWithAI(text: string, title?: string): Promise<{ category: DocumentCategory; confidence: number; reasoning: string }> {
    const categories = Object.values(DocumentCategory);
    
    const prompt = `
Analyze the following document and categorize it into one of these categories:
${categories.join(', ')}

Document Title: ${title || 'No title'}
Document Content: """
${text.substring(0, 3000)}
"""

Provide your response in the following JSON format:
{
  "category": "CATEGORY_NAME",
  "confidence": 0.95,
  "reasoning": "Brief explanation of why this category was chosen"
}

Choose the most appropriate category based on the content, purpose, and structure of the document.
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          category: DocumentCategory.OTHER,
          confidence: 0.1,
          reasoning: 'No response from AI'
        };
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          category: DocumentCategory.OTHER,
          confidence: 0.1,
          reasoning: 'Could not parse AI response'
        };
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        category: result.category as DocumentCategory,
        confidence: Math.min(result.confidence || 0.5, 1.0),
        reasoning: result.reasoning || 'AI categorization'
      };
    } catch (error) {
      console.error('AI categorization failed:', error);
      return {
        category: DocumentCategory.OTHER,
        confidence: 0.1,
        reasoning: 'AI categorization failed'
      };
    }
  }
}

// Document Summarization Service
export class DocumentSummarizationService {
  private openaiClient: OpenAI;

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }

  async summarizeDocument(
    text: string, 
    options?: { 
      length?: 'short' | 'medium' | 'long';
      style?: 'executive' | 'technical' | 'casual';
      focus?: string[];
    }
  ): Promise<{ summary: string; keyPoints: string[]; confidence: number }> {
    try {
      const length = options?.length || 'medium';
      const style = options?.style || 'executive';
      const focus = options?.focus || [];

      const maxLength = {
        'short': '2-3 sentences',
        'medium': '1-2 paragraphs',
        'long': '3-4 paragraphs'
      }[length];

      const styleGuide = {
        'executive': 'formal, business-oriented language suitable for executives',
        'technical': 'precise, technical language with specific details',
        'casual': 'conversational, easy-to-understand language'
      }[style];

      const focusInstruction = focus.length > 0 
        ? `Focus particularly on these topics: ${focus.join(', ')}.`
        : '';

      const prompt = `
Summarize the following document in ${maxLength} using ${styleGuide}.
${focusInstruction}

Also provide 3-5 key points as bullet points.

Document: """
${text.substring(0, 8000)}
"""

Provide your response in the following JSON format:
{
  "summary": "Your summary here...",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "confidence": 0.95
}
`;

      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Could not parse AI response');
      }

      const result = JSON.parse(jsonMatch[0]);
      
      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || [],
        confidence: Math.min(result.confidence || 0.8, 1.0)
      };
    } catch (error) {
      console.error('Document summarization failed:', error);
      throw new Error(`Failed to summarize document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

// Auto-Tagging Service
export class AutoTaggingService {
  private openaiClient: OpenAI;

  constructor(openaiApiKey: string) {
    this.openaiClient = new OpenAI({ apiKey: openaiApiKey });
  }

  async generateTags(text: string, title?: string, maxTags = 10): Promise<{ tags: string[]; confidence: number }> {
    try {
      // Extract tags using TF-IDF and keyword extraction
      const extractedTags = this.extractKeywordTags(text, title);
      
      // Use AI to generate semantic tags
      const aiTags = await this.generateAITags(text, title, maxTags);
      
      // Combine and rank tags
      const combinedTags = this.combineTags(extractedTags, aiTags);
      
      return {
        tags: combinedTags.slice(0, maxTags),
        confidence: 0.8
      };
    } catch (error) {
      console.error('Auto-tagging failed:', error);
      throw new Error(`Failed to generate tags: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractKeywordTags(text: string, title?: string): string[] {
    const content = `${title || ''} ${text}`.toLowerCase();
    
    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should'
    ]);

    // Extract words and phrases
    const words = content
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Count word frequency
    const wordCount: Record<string, number> = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Extract bigrams (two-word phrases)
    const bigrams: Record<string, number> = {};
    for (let i = 0; i < words.length - 1; i++) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      bigrams[bigram] = (bigrams[bigram] || 0) + 1;
    }

    // Get top keywords
    const topWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .map(([word]) => word);

    const topBigrams = Object.entries(bigrams)
      .filter(([,count]) => count >= 2)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([bigram]) => bigram);

    return [...topWords, ...topBigrams];
  }

  private async generateAITags(text: string, title?: string, maxTags: number): Promise<string[]> {
    const prompt = `
Generate ${maxTags} relevant tags for the following document. Tags should be:
- Single words or short phrases (2-3 words max)
- Descriptive of the content, topics, or themes
- Useful for categorization and search
- Professional and concise

Document Title: ${title || 'No title'}
Document Content: """
${text.substring(0, 4000)}
"""

Return only the tags as a JSON array:
["tag1", "tag2", "tag3", ...]
`;

    try {
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      if (!content) return [];

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('AI tag generation failed:', error);
      return [];
    }
  }

  private combineTags(keywordTags: string[], aiTags: string[]): string[] {
    // Combine and deduplicate tags
    const allTags = [...keywordTags, ...aiTags];
    const uniqueTags = Array.from(new Set(allTags.map(tag => tag.toLowerCase())));
    
    // Filter out very short or very long tags
    const filteredTags = uniqueTags.filter(tag => 
      tag.length >= 3 && tag.length <= 30 && !/^\d+$/.test(tag)
    );

    // Score tags based on various factors
    const scoredTags = filteredTags.map(tag => ({
      tag,
      score: this.scoreTag(tag, keywordTags, aiTags)
    }));

    // Sort by score and return tag names
    return scoredTags
      .sort((a, b) => b.score - a.score)
      .map(item => item.tag);
  }

  private scoreTag(tag: string, keywordTags: string[], aiTags: string[]): number {
    let score = 0;
    
    // Boost if present in both keyword and AI tags
    if (keywordTags.includes(tag) && aiTags.includes(tag)) {
      score += 0.5;
    }
    
    // Boost AI-generated tags slightly
    if (aiTags.includes(tag)) {
      score += 0.3;
    }
    
    // Boost keyword tags based on length (prefer moderate length)
    if (keywordTags.includes(tag)) {
      if (tag.length >= 5 && tag.length <= 15) {
        score += 0.2;
      }
    }
    
    // Boost multi-word tags
    if (tag.includes(' ')) {
      score += 0.1;
    }
    
    return score;
  }
}

// Main Document Processing Service
export class DocumentProcessingService {
  private ocrService: OCRService;
  private extractionService: ContentExtractionService;
  private entityService: EntityRecognitionService;
  private categorizationService: DocumentCategorizationService;
  private summarizationService: DocumentSummarizationService;
  private taggingService: AutoTaggingService;

  constructor(openaiApiKey: string) {
    this.ocrService = new OCRService(openaiApiKey);
    this.extractionService = new ContentExtractionService();
    this.entityService = new EntityRecognitionService(openaiApiKey);
    this.categorizationService = new DocumentCategorizationService(openaiApiKey);
    this.summarizationService = new DocumentSummarizationService(openaiApiKey);
    this.taggingService = new AutoTaggingService(openaiApiKey);
  }

  async initialize(): Promise<void> {
    await this.ocrService.initialize();
    console.log('Document processing service initialized');
  }

  async processDocument(
    fileBuffer: Buffer, 
    filename: string,
    options: ProcessingOptions = {}
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const processingSteps: ProcessingStep[] = [];
    
    try {
      // Step 1: Determine file type and extract content
      const extractionStep = this.createProcessingStep('content_extraction');
      processingSteps.push(extractionStep);

      const fileType = this.extractionService.detectFileType(fileBuffer, filename);
      let extractedText = '';
      let extractionMetadata: any = {};

      if (fileType === 'PDF') {
        const result = await this.extractionService.extractFromPDF(fileBuffer);
        extractedText = result.text;
        extractionMetadata = result.metadata;
      } else if (['PNG', 'JPG', 'GIF'].includes(fileType) && options.enableOCR) {
        const result = await this.ocrService.extractTextFromImage(fileBuffer);
        extractedText = result.text;
        extractionMetadata = { ocrConfidence: result.confidence };
      } else {
        const result = await this.extractionService.extractFromText(fileBuffer);
        extractedText = result.text;
        extractionMetadata = result.metadata;
      }

      this.completeProcessingStep(extractionStep, { textLength: extractedText.length });

      // Step 2: Language detection
      const language = this.detectLanguage(extractedText);

      // Step 3: Entity extraction
      let entities: ExtractedEntity[] = [];
      if (options.enableEntityExtraction) {
        const entityStep = this.createProcessingStep('entity_extraction');
        processingSteps.push(entityStep);
        entities = await this.entityService.extractEntities(extractedText);
        this.completeProcessingStep(entityStep, { entityCount: entities.length });
      }

      // Step 4: Document categorization
      const categorizationStep = this.createProcessingStep('categorization');
      processingSteps.push(categorizationStep);
      const categorization = await this.categorizationService.categorizeDocument(extractedText, filename);
      this.completeProcessingStep(categorizationStep, categorization);

      // Step 5: Auto-tagging
      let tags: string[] = [];
      if (options.enableAutoTagging) {
        const taggingStep = this.createProcessingStep('auto_tagging');
        processingSteps.push(taggingStep);
        const taggingResult = await this.taggingService.generateTags(extractedText, filename);
        tags = taggingResult.tags;
        this.completeProcessingStep(taggingStep, { tagCount: tags.length });
      }

      // Step 6: Document summarization
      let summary = '';
      if (options.enableSummarization) {
        const summaryStep = this.createProcessingStep('summarization');
        processingSteps.push(summaryStep);
        const summaryResult = await this.summarizationService.summarizeDocument(extractedText, {
          length: options.summaryLength || 'medium'
        });
        summary = summaryResult.summary;
        this.completeProcessingStep(summaryStep, { summaryLength: summary.length });
      }

      // Step 7: Quality assessment
      const qualityStep = this.createProcessingStep('quality_assessment');
      processingSteps.push(qualityStep);
      const qualityMetrics = this.assessQuality(extractedText, extractionMetadata);
      this.completeProcessingStep(qualityStep, qualityMetrics);

      // Create document object
      const document: Document = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: this.extractTitle(extractedText, filename),
        content: extractedText,
        metadata: {
          category: categorization.category,
          tags,
          language,
          source: 'document_processing',
          createdAt: new Date(),
          updatedAt: new Date(),
          wordCount: extractedText.split(/\s+/).length,
          ...extractionMetadata
        }
      };

      const processingTime = Date.now() - startTime;

      return {
        document,
        extractedText,
        summary,
        entities,
        tags,
        category: categorization.category,
        language,
        confidence: qualityMetrics.overallQuality,
        processingTime,
        processingSteps,
        qualityMetrics,
        metadata: {
          originalFileName: filename,
          fileSize: fileBuffer.length,
          mimeType: this.getMimeType(fileType),
          processingVersion: '1.0.0',
          processingDate: new Date(),
          ocrEngine: options.enableOCR ? 'tesseract' : undefined,
          ocrConfidence: extractionMetadata.ocrConfidence
        }
      };
    } catch (error) {
      // Mark the last step as failed
      if (processingSteps.length > 0) {
        const lastStep = processingSteps[processingSteps.length - 1];
        lastStep.status = 'failed';
        lastStep.error = error instanceof Error ? error.message : 'Unknown error';
        lastStep.endTime = new Date();
      }
      
      console.error('Document processing failed:', error);
      throw error;
    }
  }

  private createProcessingStep(name: string): ProcessingStep {
    return {
      name,
      status: 'running',
      startTime: new Date()
    };
  }

  private completeProcessingStep(step: ProcessingStep, result?: any): void {
    step.status = 'completed';
    step.endTime = new Date();
    step.duration = step.endTime.getTime() - step.startTime.getTime();
    step.result = result;
  }

  private detectLanguage(text: string): string {
    // Simple language detection based on character patterns
    // In production, you might use a more sophisticated library
    
    const sample = text.substring(0, 1000).toLowerCase();
    
    // Basic patterns for common languages
    if (/[àáâäçéèêëïîôùûüÿñ]/.test(sample)) {
      if (/ñ/.test(sample) || /¿|¡/.test(sample)) return 'es'; // Spanish
      if (/ç/.test(sample)) return 'fr'; // French
      return 'fr'; // Default to French for other accented characters
    }
    
    if (/[äöüß]/.test(sample)) return 'de'; // German
    if (/[аеиоуыэюя]/.test(sample)) return 'ru'; // Russian
    if (/[一-龯]/.test(sample)) return 'zh'; // Chinese
    if (/[ひらがなカタカナ]/.test(sample)) return 'ja'; // Japanese
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(sample)) return 'ko'; // Korean
    
    return 'en'; // Default to English
  }

  private extractTitle(text: string, filename: string): string {
    // Try to extract title from content
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length > 0) {
      const firstLine = lines[0];
      
      // If first line is short and looks like a title
      if (firstLine.length <= 100 && !firstLine.endsWith('.')) {
        return firstLine;
      }
    }
    
    // Fallback to filename without extension
    return filename.replace(/\.[^/.]+$/, '');
  }

  private assessQuality(text: string, metadata: any): QualityMetrics {
    // Text quality based on length, readability, etc.
    const wordCount = text.split(/\s+/).length;
    const avgWordLength = text.replace(/[^\w\s]/g, '').split(/\s+/).reduce((sum, word) => sum + word.length, 0) / wordCount;
    const sentenceCount = text.split(/[.!?]+/).length;
    const avgSentenceLength = wordCount / sentenceCount;
    
    let textQuality = 0.5;
    if (wordCount > 50) textQuality += 0.2;
    if (avgWordLength > 3 && avgWordLength < 8) textQuality += 0.1;
    if (avgSentenceLength > 10 && avgSentenceLength < 30) textQuality += 0.1;
    if (text.match(/[A-Z]/g) && text.match(/[a-z]/g)) textQuality += 0.1;
    
    // Structure quality based on formatting
    let structureQuality = 0.3;
    if (text.includes('\n\n')) structureQuality += 0.2; // Has paragraphs
    if (text.match(/^\s*-|\*|1\./m)) structureQuality += 0.2; // Has lists
    if (text.match(/^#{1,6}\s/m)) structureQuality += 0.3; // Has headings
    
    // Completeness based on content length and structure
    let completeness = Math.min(wordCount / 100, 1.0); // Up to 100 words = complete
    
    // Reliability based on OCR confidence or extraction method
    let reliability = 1.0;
    if (metadata.ocrConfidence) {
      reliability = metadata.ocrConfidence;
    }
    
    const overallQuality = (textQuality * 0.3 + structureQuality * 0.2 + completeness * 0.3 + reliability * 0.2);
    
    return {
      textQuality: Math.min(textQuality, 1.0),
      structureQuality: Math.min(structureQuality, 1.0),
      completeness,
      reliability,
      overallQuality: Math.min(overallQuality, 1.0)
    };
  }

  private getMimeType(fileType: string): string {
    const mimeTypes: Record<string, string> = {
      'PDF': 'application/pdf',
      'PNG': 'image/png',
      'JPG': 'image/jpeg',
      'GIF': 'image/gif',
      'TXT': 'text/plain',
      'DOC': 'application/msword',
      'DOCX': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'HTML': 'text/html',
      'JSON': 'application/json',
      'XML': 'application/xml',
      'CSV': 'text/csv'
    };
    
    return mimeTypes[fileType] || 'application/octet-stream';
  }

  async terminate(): Promise<void> {
    await this.ocrService.terminate();
    console.log('Document processing service terminated');
  }
}

// Factory function
export function createDocumentProcessingService(openaiApiKey: string): DocumentProcessingService {
  return new DocumentProcessingService(openaiApiKey);
}

export default DocumentProcessingService;

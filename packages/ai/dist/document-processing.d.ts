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
import { Document } from './vector-search.js';
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
    textQuality: number;
    structureQuality: number;
    completeness: number;
    reliability: number;
    overallQuality: number;
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
export declare enum EntityType {
    PERSON = "PERSON",
    ORGANIZATION = "ORGANIZATION",
    LOCATION = "LOCATION",
    DATE = "DATE",
    MONEY = "MONEY",
    PERCENTAGE = "PERCENTAGE",
    EMAIL = "EMAIL",
    PHONE = "PHONE",
    URL = "URL",
    PRODUCT = "PRODUCT",
    EVENT = "EVENT",
    SKILL = "SKILL",
    TECHNOLOGY = "TECHNOLOGY",
    LEGAL = "LEGAL",
    MEDICAL = "MEDICAL"
}
export declare enum DocumentCategory {
    CONTRACT = "CONTRACT",
    INVOICE = "INVOICE",
    REPORT = "REPORT",
    PRESENTATION = "PRESENTATION",
    EMAIL = "EMAIL",
    MANUAL = "MANUAL",
    POLICY = "POLICY",
    RESEARCH = "RESEARCH",
    NEWS = "NEWS",
    BLOG = "BLOG",
    LEGAL = "LEGAL",
    MEDICAL = "MEDICAL",
    FINANCIAL = "FINANCIAL",
    TECHNICAL = "TECHNICAL",
    MARKETING = "MARKETING",
    OTHER = "OTHER"
}
export declare class OCRService {
    private tesseractWorker;
    private openaiClient;
    constructor(openaiApiKey?: string);
    initialize(): Promise<void>;
    extractTextFromImage(imageBuffer: Buffer, options?: {
        language?: string;
    }): Promise<{
        text: string;
        confidence: number;
    }>;
    private preprocessImage;
    private postProcessOCRText;
    terminate(): Promise<void>;
}
export declare class ContentExtractionService {
    extractFromPDF(pdfBuffer: Buffer): Promise<{
        text: string;
        metadata: any;
    }>;
    extractFromText(textBuffer: Buffer): Promise<{
        text: string;
        metadata: any;
    }>;
    detectFileType(buffer: Buffer, filename?: string): string;
}
export declare class EntityRecognitionService {
    private openaiClient;
    constructor(openaiApiKey: string);
    extractEntities(text: string, options?: {
        types?: EntityType[];
    }): Promise<ExtractedEntity[]>;
    private extractWithOpenAI;
    private extractWithPatterns;
    private getContext;
    private mergeEntities;
}
export declare class DocumentCategorizationService {
    private openaiClient;
    private categoryKeywords;
    constructor(openaiApiKey: string);
    private initializeCategoryKeywords;
    categorizeDocument(text: string, title?: string): Promise<{
        category: DocumentCategory;
        confidence: number;
        reasoning: string;
    }>;
    private categorizeWithRules;
    private categorizeWithAI;
}
export declare class DocumentSummarizationService {
    private openaiClient;
    constructor(openaiApiKey: string);
    summarizeDocument(text: string, options?: {
        length?: 'short' | 'medium' | 'long';
        style?: 'executive' | 'technical' | 'casual';
        focus?: string[];
    }): Promise<{
        summary: string;
        keyPoints: string[];
        confidence: number;
    }>;
}
export declare class AutoTaggingService {
    private openaiClient;
    constructor(openaiApiKey: string);
    generateTags(text: string, title?: string, maxTags?: number): Promise<{
        tags: string[];
        confidence: number;
    }>;
    private extractKeywordTags;
    private generateAITags;
    private combineTags;
    private scoreTag;
}
export declare class DocumentProcessingService {
    private ocrService;
    private extractionService;
    private entityService;
    private categorizationService;
    private summarizationService;
    private taggingService;
    constructor(openaiApiKey: string);
    initialize(): Promise<void>;
    processDocument(fileBuffer: Buffer, filename: string, options?: ProcessingOptions): Promise<ProcessingResult>;
    private createProcessingStep;
    private completeProcessingStep;
    private detectLanguage;
    private extractTitle;
    private assessQuality;
    private getMimeType;
    terminate(): Promise<void>;
}
export declare function createDocumentProcessingService(openaiApiKey: string): DocumentProcessingService;
export default DocumentProcessingService;

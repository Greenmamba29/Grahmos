import { SearchBackend, SearchResult, SearchOptions, Document, BackendStatus } from './types.js';

// Define Meilisearch-specific interfaces
interface MeilisearchVersion {
  pkgVersion?: string;
}

interface MeilisearchStats {
  numberOfDocuments?: number;
  lastUpdate?: string;
}

export class MeilisearchBackend implements SearchBackend {
  public readonly name = 'meilisearch';
  private baseUrl: string;
  private apiKey: string | undefined;
  private indexName: string;

  constructor() {
    this.baseUrl = process.env.MEILI_HOST || 'http://localhost:7700';
    this.apiKey = process.env.MEILI_MASTER_KEY;
    this.indexName = process.env.MEILI_INDEX_NAME || 'docs';
  }

  async initialize(): Promise<void> {
    try {
      // Test connection
      const healthResponse = await this.request('/health');
      if (!healthResponse.ok) {
        throw new Error(`Meilisearch health check failed: ${healthResponse.status}`);
      }

      // Check if index exists, create if not
      const indexResponse = await this.request(`/indexes/${this.indexName}`);
      if (indexResponse.status === 404) {
        console.log(`Creating Meilisearch index: ${this.indexName}`);
        await this.request('/indexes', 'POST', {
          uid: this.indexName,
          primaryKey: 'id'
        });
      }

      console.log(`✅ Meilisearch backend initialized with index: ${this.indexName}`);
    } catch (error) {
      throw new Error(`Failed to initialize Meilisearch: ${error}`);
    }
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const { limit = 10, offset = 0 } = options;

    try {
      const searchParams = {
        q: query,
        limit,
        offset,
        attributesToHighlight: ['title', 'content'],
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        attributesToCrop: ['content'],
        cropLength: 200,
        cropMarker: '…',
        showMatchesPosition: true
      };

      const response = await this.request(`/indexes/${this.indexName}/search`, 'POST', searchParams);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      
      return data.hits.map((hit: any) => ({
        id: hit.id.toString(),
        title: hit._formatted?.title || hit.title || '',
        snippet: this.extractSnippet(hit),
        score: this.calculateScore(hit),
        metadata: {
          backend: 'meilisearch',
          query,
          matchesPosition: hit._matchesPosition,
          processingTime: data.processingTimeMs
        }
      }));

    } catch (error) {
      console.error('Meilisearch search error:', error);
      return [];
    }
  }

  async getDocument(id: string): Promise<Document | null> {
    try {
      const response = await this.request(`/indexes/${this.indexName}/documents/${id}`);
      
      if (response.status === 404) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Document retrieval failed: ${response.status}`);
      }

      const doc = await response.json() as any;
      
      return {
        id: doc.id.toString(),
        title: doc.title || '',
        content: doc.content || '',
        metadata: {
          backend: 'meilisearch',
          ...doc.metadata
        }
      };

    } catch (error) {
      console.error('Meilisearch document retrieval error:', error);
      return null;
    }
  }

  async getStatus(): Promise<BackendStatus> {
    try {
      // Get health status
      const healthResponse = await this.request('/health');
      if (!healthResponse.ok) {
        return {
          healthy: false,
          error: `Health check failed: ${healthResponse.status}`
        };
      }

      // Get index stats
      const statsResponse = await this.request(`/indexes/${this.indexName}/stats`);
      const stats: MeilisearchStats | null = statsResponse.ok ? await statsResponse.json() as MeilisearchStats : null;

      // Get version info
      const versionResponse = await this.request('/version');
      const version: MeilisearchVersion | null = versionResponse.ok ? await versionResponse.json() as MeilisearchVersion : null;

      return {
        healthy: true,
        version: version?.pkgVersion || 'unknown',
        indexSize: stats?.numberOfDocuments || 0,
        lastUpdated: stats?.lastUpdate || 'unknown'
      };

    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    }) as Promise<Response>;
  }

  private extractSnippet(hit: any): string {
    // Try to get highlighted content first
    if (hit._formatted?.content) {
      return hit._formatted.content;
    }

    // Fall back to cropped content
    if (hit.content) {
      return hit.content.length > 200 
        ? hit.content.substring(0, 200) + '…'
        : hit.content;
    }

    // Use title as fallback
    return hit._formatted?.title || hit.title || '';
  }

  private calculateScore(hit: any): number {
    // Meilisearch doesn't provide explicit scores, so we estimate based on matches
    let score = 0.5; // Base score

    if (hit._matchesPosition) {
      // Boost score based on number of matches
      const totalMatches = Object.values(hit._matchesPosition)
        .flat()
        .length as number;
      score += Math.min(totalMatches * 0.1, 0.4);

      // Boost if title matches
      if (hit._matchesPosition.title?.length > 0) {
        score += 0.3;
      }
    }

    return Math.min(score, 1.0);
  }
}

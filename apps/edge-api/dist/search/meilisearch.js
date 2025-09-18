import fetch from 'node-fetch';
export class MeilisearchBackend {
    name = 'meilisearch';
    baseUrl;
    apiKey;
    indexName;
    constructor() {
        this.baseUrl = process.env.MEILI_HOST || 'http://localhost:7700';
        this.apiKey = process.env.MEILI_MASTER_KEY;
        this.indexName = process.env.MEILI_INDEX_NAME || 'docs';
    }
    async initialize() {
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
        }
        catch (error) {
            throw new Error(`Failed to initialize Meilisearch: ${error}`);
        }
    }
    async search(query, options = {}) {
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
                cropLength: 100
            };
            const response = await this.request(`/indexes/${this.indexName}/search`, 'POST', searchParams);
            if (!response.ok) {
                throw new Error(`Search failed: ${response.status}`);
            }
            const data = await response.json();
            const hits = data.hits || [];
            return hits.map((hit) => ({
                id: hit.id,
                score: hit._score || 1,
                title: hit.title || '',
                snippet: this.extractSnippet(hit),
                url: hit.url || ''
            }));
        }
        catch (error) {
            console.error('Meilisearch search error:', error);
            throw error;
        }
    }
    async index(documents) {
        try {
            const response = await this.request(`/indexes/${this.indexName}/documents`, 'POST', documents);
            if (!response.ok) {
                throw new Error(`Indexing failed: ${response.status}`);
            }
            const result = await response.json();
            console.log(`Indexed ${documents.length} documents, task ID: ${result.taskUid}`);
            // Wait for indexing to complete (simplified - in production use task API)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        catch (error) {
            console.error('Meilisearch indexing error:', error);
            throw error;
        }
    }
    async delete(id) {
        try {
            const response = await this.request(`/indexes/${this.indexName}/documents/${id}`, 'DELETE');
            if (!response.ok && response.status !== 404) {
                throw new Error(`Delete failed: ${response.status}`);
            }
        }
        catch (error) {
            console.error('Meilisearch delete error:', error);
            throw error;
        }
    }
    async getStatus() {
        try {
            // Check health
            const healthResponse = await this.request('/health');
            if (!healthResponse.ok) {
                return {
                    healthy: false,
                    error: `Health check failed: ${healthResponse.status}`
                };
            }
            // Get index stats
            const statsResponse = await this.request(`/indexes/${this.indexName}/stats`);
            const stats = statsResponse.ok ? await statsResponse.json() : null;
            // Get version info
            const versionResponse = await this.request('/version');
            const version = versionResponse.ok ? await versionResponse.json() : null;
            return {
                healthy: true,
                version: version?.pkgVersion,
                indexSize: stats?.numberOfDocuments || 0,
                lastUpdated: stats?.lastUpdate
            };
        }
        catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async request(endpoint, method = 'GET', body) {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });
    }
    extractSnippet(hit) {
        // If Meilisearch provided a formatted snippet, use it
        if (hit._formatted?.content) {
            return hit._formatted.content;
        }
        // Otherwise, create a snippet from the content
        const content = hit.content || '';
        const maxLength = 100;
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '...';
    }
    async clear() {
        try {
            const response = await this.request(`/indexes/${this.indexName}/documents`, 'DELETE');
            if (!response.ok) {
                throw new Error(`Clear failed: ${response.status}`);
            }
            console.log('Meilisearch index cleared');
        }
        catch (error) {
            console.error('Meilisearch clear error:', error);
            throw error;
        }
    }
    async getDocument(id) {
        try {
            const response = await this.request(`/indexes/${this.indexName}/documents/${id}`);
            if (response.status === 404) {
                return null;
            }
            if (!response.ok) {
                throw new Error(`Get document failed: ${response.status}`);
            }
            const doc = await response.json();
            return {
                id: doc.id,
                title: doc.title || '',
                content: doc.content || '',
                metadata: doc.metadata || {}
            };
        }
        catch (error) {
            console.error('Meilisearch get document error:', error);
            throw error;
        }
    }
}
//# sourceMappingURL=meilisearch.js.map
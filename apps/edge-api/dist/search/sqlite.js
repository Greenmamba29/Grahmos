import Database from 'better-sqlite3';
import * as fs from 'node:fs';
import * as path from 'node:path';
export class SqliteSearchBackend {
    name = 'sqlite';
    db = null;
    dbPath;
    constructor() {
        const indexDir = process.env.INDEX_DIR || '/data/indexes/current';
        this.dbPath = process.env.SQLITE_DB_PATH || path.join(indexDir, 'fts.sqlite');
    }
    async initialize() {
        if (!fs.existsSync(this.dbPath)) {
            throw new Error(`SQLite database not found at ${this.dbPath}`);
        }
        this.db = new Database(this.dbPath, {
            readonly: true,
            fileMustExist: true
        });
        // Optimize SQLite for read-only workload
        this.db.pragma('journal_mode=OFF');
        this.db.pragma('synchronous=OFF');
        this.db.pragma('cache_size=10000');
        this.db.pragma('temp_store=MEMORY');
        this.db.pragma('mmap_size=268435456'); // 256MB memory mapping
        // Verify FTS table exists
        const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%'").all();
        if (tables.length === 0) {
            throw new Error('No FTS tables found in SQLite database');
        }
        console.log(`✅ SQLite FTS backend initialized with database: ${this.dbPath}`);
    }
    async search(query, options = {}) {
        if (!this.db) {
            throw new Error('SQLite backend not initialized');
        }
        const { limit = 10, offset = 0 } = options;
        // Sanitize query for FTS
        const ftsQuery = query.replace(/[^\w\s\-_]/g, '').trim();
        if (!ftsQuery) {
            return [];
        }
        try {
            // Use FTS5 with snippet and ranking
            const stmt = this.db.prepare(`
        SELECT 
          docid as id,
          title,
          snippet(documents_fts, 2, '<mark>', '</mark>', '…', 20) as snippet,
          bm25(documents_fts) as score
        FROM documents_fts 
        WHERE documents_fts MATCH ?
        ORDER BY bm25(documents_fts)
        LIMIT ? OFFSET ?
      `);
            const rows = stmt.all(ftsQuery, limit, offset);
            return rows.map(row => ({
                id: row.id.toString(),
                title: row.title || '',
                snippet: row.snippet || '',
                score: row.score || 0,
                metadata: {
                    backend: 'sqlite',
                    query: ftsQuery
                }
            }));
        }
        catch (error) {
            console.error('SQLite search error:', error);
            // Fallback to simple LIKE search if FTS fails
            try {
                const stmt = this.db.prepare(`
          SELECT 
            id,
            title,
            substr(content, 1, 200) as snippet
          FROM documents 
          WHERE title LIKE ? OR content LIKE ?
          LIMIT ? OFFSET ?
        `);
                const likeQuery = `%${ftsQuery}%`;
                const rows = stmt.all(likeQuery, likeQuery, limit, offset);
                return rows.map(row => ({
                    id: row.id.toString(),
                    title: row.title || '',
                    snippet: row.snippet || '',
                    score: 0.5,
                    metadata: {
                        backend: 'sqlite',
                        query: ftsQuery,
                        fallback: true
                    }
                }));
            }
            catch (fallbackError) {
                console.error('SQLite fallback search error:', fallbackError);
                return [];
            }
        }
    }
    async getDocument(id) {
        if (!this.db) {
            throw new Error('SQLite backend not initialized');
        }
        try {
            const stmt = this.db.prepare('SELECT id, title, content FROM documents WHERE id = ?');
            const row = stmt.get(id);
            if (!row) {
                return null;
            }
            return {
                id: row.id.toString(),
                title: row.title || '',
                content: row.content || '',
                metadata: {
                    backend: 'sqlite'
                }
            };
        }
        catch (error) {
            console.error('SQLite document retrieval error:', error);
            return null;
        }
    }
    async getStatus() {
        if (!this.db) {
            return {
                healthy: false,
                error: 'Database not initialized'
            };
        }
        try {
            // Get database info
            const dbStat = fs.statSync(this.dbPath);
            const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM documents');
            const countResult = countStmt.get();
            return {
                healthy: true,
                version: this.db.pragma('user_version', { simple: true }),
                indexSize: countResult.count || 0,
                lastUpdated: dbStat.mtime.toISOString()
            };
        }
        catch (error) {
            return {
                healthy: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async cleanup() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('✅ SQLite database connection closed');
        }
    }
}
//# sourceMappingURL=sqlite.js.map
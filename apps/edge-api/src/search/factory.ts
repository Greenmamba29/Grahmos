import { SearchBackend } from './types.js';
import { SqliteSearchBackend } from './sqlite.js';
import { MeilisearchBackend } from './meilisearch.js';

/**
 * Creates a search backend based on configuration
 */
export function createSearchBackend(): SearchBackend {
  const backend = (process.env.SEARCH_BACKEND || 'meili').toLowerCase();
  
  switch (backend) {
    case 'sqlite':
    case 'fts':
      console.log('🔍 Initializing SQLite FTS search backend');
      return new SqliteSearchBackend();
      
    case 'meili':
    case 'meilisearch':
      console.log('🔍 Initializing Meilisearch backend');
      return new MeilisearchBackend();
      
    default:
      console.warn(`⚠️  Unknown search backend '${backend}', falling back to Meilisearch`);
      return new MeilisearchBackend();
  }
}

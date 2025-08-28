import express from 'express';
import morgan from 'morgan';
import { signShortJwt, verifyJwt } from './jwt.js';
import Database from 'better-sqlite3';
import type { SearchBackend, SearchResponse, SearchResult } from './types.js';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
app.disable('x-powered-by');
app.use(morgan('combined'));

// Bind to Unix socket for zero TCP exposure
const UDS = '/var/run/edge/edge.sock';
try { 
  fs.unlinkSync(UDS); 
} catch {
  // Socket doesn't exist, ignore
}

// Search backend configuration
const backend = (process.env.SEARCH_BACKEND || 'sqlite') as SearchBackend;
const indexDir = process.env.INDEX_DIR || '/app/indexes/current';

let db: Database.Database | null = null;

/**
 * Initialize SQLite database connection
 */
function initializeDatabase() {
  if (backend === 'sqlite') {
    const dbPath = path.join(indexDir, 'fts.sqlite');
    
    try {
      console.log(`🔍 Connecting to SQLite FTS database: ${dbPath}`);
      db = new Database(dbPath, { readonly: true, fileMustExist: true });
      
      // Performance optimizations
      db.pragma('journal_mode=OFF');
      db.pragma('synchronous=OFF');
      db.pragma('cache_size=-1048576'); // 1GB cache
      db.pragma('mmap_size=268435456'); // 256MB mmap
      
      console.log('✅ SQLite FTS database connected');
    } catch (error) {
      console.error('❌ Failed to connect to SQLite database:', error);
      // Create a dummy database for development
      createDummyDatabase(dbPath);
    }
  }
}

/**
 * Create dummy database for development/testing
 */
function createDummyDatabase(dbPath: string) {
  console.log('📝 Creating dummy FTS database for development...');
  
  // Ensure directory exists
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  
  const tempDb = new Database(dbPath);
  
  // Create FTS table
  tempDb.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts USING fts5(
      title, 
      content, 
      docid UNINDEXED
    );
  `);
  
  // Insert sample data
  const insert = tempDb.prepare('INSERT INTO fts(title, content, docid) VALUES (?, ?, ?)');
  const sampleDocs = [
    ['Emergency Evacuation Routes', 'Primary evacuation routes for Stadium Section A include exits 1-4 leading to Assembly Point Alpha.', 'evac-001'],
    ['Medical Kit Locations', 'First aid stations are located at Gate 2, Gate 5, and the Main Concourse.', 'med-001'],
    ['Fire Safety Procedures', 'In case of fire alarm, proceed calmly to nearest emergency exit. Do not use elevators.', 'fire-001'],
    ['Stadium Layout Map', 'Comprehensive map showing all sections, exits, facilities and emergency assembly points.', 'map-001']
  ];
  
  for (const [title, content, docid] of sampleDocs) {
    insert.run(title, content, docid);
  }
  
  tempDb.close();
  
  // Reconnect as readonly
  db = new Database(dbPath, { readonly: true });
  db.pragma('journal_mode=OFF');
  db.pragma('synchronous=OFF');
  
  console.log('✅ Dummy FTS database created with sample data');
}

// --- mTLS PoP: issue JWT bound to client cert fingerprint ---
app.get('/auth/mtls', (req, res) => {
  const verified = req.header('X-Client-Verify');
  const fp = req.header('X-Client-Fingerprint');
  
  console.log(`🔐 mTLS auth request - Verified: ${verified}, Fingerprint: ${fp?.substring(0, 16)}...`);
  
  if (verified !== 'SUCCESS' || !fp) {
    return res.status(401).json({ error: 'mTLS required' });
  }
  
  // Subject could be derived from IMSI/UE identity mapping; using fp for demo
  const token = signShortJwt(`mtls:${fp}`, { 'x5t#S256': fp });
  
  res.json({ 
    token, 
    ttl: parseInt(process.env.JWT_TTL_SECONDS || '300', 10),
    issued_at: new Date().toISOString()
  });
});

// PoP check middleware: JWT must match presented client cert fingerprint
app.use((req, res, next) => {
  if (req.path === '/auth/mtls' || req.path === '/healthz') {
    return next();
  }
  
  const verified = req.header('X-Client-Verify');
  const fp = req.header('X-Client-Fingerprint');
  const auth = req.header('authorization') || '';
  
  if (verified !== 'SUCCESS' || !fp) {
    return res.status(401).json({ error: 'mTLS required' });
  }
  
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'JWT required' });
  }
  
  const claims = verifyJwt(match[1]);
  if (!claims) {
    return res.status(401).json({ error: 'invalid token' });
  }
  
  const cnf = claims.cnf;
  if (!cnf || cnf['x5t#S256'] !== fp) {
    console.warn(`🚨 PoP mismatch - JWT cnf: ${cnf?.['x5t#S256']?.substring(0, 16)}, Cert fp: ${fp.substring(0, 16)}`);
    return res.status(401).json({ error: 'cnf mismatch' });
  }
  
  // Add user context to request
  (req as any).user = { sub: claims.sub, fingerprint: fp };
  next();
});

// --- Search endpoints ---
app.get('/healthz', (_req, res) => {
  const status = {
    ok: true,
    timestamp: new Date().toISOString(),
    backend,
    database: db ? 'connected' : 'disconnected'
  };
  
  res.json(status);
});

app.get('/search', (req, res) => {
  const startTime = Date.now();
  const q = (req.query.q as string || '').trim();
  const k = parseInt((req.query.k as string) || '10', 10);
  
  if (!q) {
    return res.status(400).json({ error: 'query parameter q is required' });
  }
  
  if (k < 1 || k > 100) {
    return res.status(400).json({ error: 'k must be between 1 and 100' });
  }
  
  console.log(`🔍 Search query: "${q}" (k=${k}) from ${(req as any).user?.sub}`);
  
  if (backend === 'sqlite') {
    try {
      const stmt = db!.prepare(`
        SELECT 
          docid, 
          title, 
          snippet(fts, 1, '<b>', '</b>', '…', 12) as snippet
        FROM fts 
        WHERE fts MATCH ? 
        ORDER BY rank 
        LIMIT ?
      `);
      
      const rows = stmt.all(q, k) as SearchResult[];
      const took_ms = Date.now() - startTime;
      
      const response: SearchResponse = { q, k, rows, took_ms };
      return res.json(response);
      
    } catch (error) {
      console.error('SQLite search error:', error);
      return res.status(500).json({ error: 'search failed' });
    }
  }
  
  // Meili backend stub
  return res.status(501).json({ error: 'meili backend not implemented' });
});

app.get('/doc/:id', (req, res) => {
  const id = req.params.id;
  const docPath = path.join(indexDir, 'docs', `${id}.json`);
  
  console.log(`📄 Document request: ${id} from ${(req as any).user?.sub}`);
  
  try {
    if (!fs.existsSync(docPath)) {
      return res.status(404).json({ error: 'document not found' });
    }
    
    const content = fs.readFileSync(docPath, 'utf-8');
    res.type('application/json').send(content);
    
  } catch (error) {
    console.error('Document read error:', error);
    res.status(500).json({ error: 'failed to read document' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'endpoint not found' });
});

// Error handler
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'internal server error' });
});

// Initialize database
initializeDatabase();

// Start server
app.listen(UDS, () => {
  fs.chmodSync(UDS, 0o660);
  console.log(`🚀 Edge API listening on ${UDS}`);
  console.log(`🔍 Search backend: ${backend}`);
  console.log(`📁 Index directory: ${indexDir}`);
});

import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import * as fs from 'node:fs';
import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import { requireDPoP, requirePoPJWT } from './auth/dpop.js';
import { signShortJwt } from './auth/jwt.js';
import { createSearchBackend } from './search/factory.js';
import type { SearchBackend } from './search/types.js';

const app = express();

// Security headers and CORS
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'development' ? true : [
    'https://grahmos.local',
    'https://edge.grahmos.local'
  ],
  credentials: true
}));

// Rate limiting
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '1') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_REQUESTS || '20'),
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(rateLimiter);

// Logging
app.use(morgan('combined'));
app.disable('x-powered-by');

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    features: ['mtls', 'dpop', 'sqlite', 'meili']
  });
});

// Unix Domain Socket setup for production
const UDS = process.env.API_SOCKET_PATH || '/var/run/edge/edge.sock';
const PORT = parseInt(process.env.API_PORT || '3000');
const HOST = process.env.API_HOST || '0.0.0.0';

// Initialize search backend
let searchBackend: SearchBackend;

// Auth endpoints - mTLS path
app.get('/auth/mtls', (req, res) => {
  const clientVerify = req.header('X-Client-Verify');
  const clientFingerprint = req.header('X-Client-Fingerprint');
  
  if (clientVerify !== 'SUCCESS' || !clientFingerprint) {
    return res.status(401).json({ 
      error: 'mTLS client certificate required',
      code: 'MTLS_REQUIRED'
    });
  }

  try {
    const token = signShortJwt(`mtls:${clientFingerprint}`, { 
      'x5t#S256': clientFingerprint 
    });
    
    res.json({ 
      token, 
      ttl: parseInt(process.env.JWT_TTL_SECONDS || '300'),
      auth_method: 'mtls',
      cnf: { 'x5t#S256': clientFingerprint }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Token generation failed',
      code: 'TOKEN_ERROR'
    });
  }
});

// Auth endpoints - DPoP path
app.get('/auth/dpop', requireDPoP, (req, res) => {
  try {
    const jkt = (req as any).dpopThumb;
    const token = signShortJwt(`dpop:${jkt}`, { jkt });
    
    res.json({ 
      token, 
      ttl: parseInt(process.env.JWT_TTL_SECONDS || '300'),
      auth_method: 'dpop',
      cnf: { jkt }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Token generation failed',
      code: 'TOKEN_ERROR'
    });
  }
});

// Protect all other routes with either DPoP or PoP JWT
app.use(requireDPoP); // no-op for mTLS path
app.use(requirePoPJWT);

// Search endpoint
app.get('/search', async (req, res) => {
  try {
    const query = (req.query.q as string || '').trim();
    const limit = Math.min(parseInt((req.query.k as string) || '10'), 100);
    const offset = Math.max(parseInt((req.query.offset as string) || '0'), 0);
    
    if (!query) {
      return res.json({ 
        query: '', 
        limit, 
        offset,
        results: [],
        total: 0,
        query_time: 0
      });
    }

    const startTime = Date.now();
    const results = await searchBackend.search(query, { limit, offset });
    const queryTime = Date.now() - startTime;

    res.json({
      query,
      limit,
      offset,
      results,
      total: results.length,
      query_time: queryTime,
      backend: searchBackend.name
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search failed',
      code: 'SEARCH_ERROR'
    });
  }
});

// Document retrieval endpoint
app.get('/documents/:id', async (req, res) => {
  try {
    const docId = req.params.id;
    const document = await searchBackend.getDocument(docId);
    
    if (!document) {
      return res.status(404).json({ 
        error: 'Document not found',
        code: 'DOC_NOT_FOUND'
      });
    }

    res.json(document);
  } catch (error) {
    console.error('Document retrieval error:', error);
    res.status(500).json({ 
      error: 'Document retrieval failed',
      code: 'DOC_ERROR'
    });
  }
});

// Index status endpoint
app.get('/status', async (req, res) => {
  try {
    const status = await searchBackend.getStatus();
    res.json({
      backend: searchBackend.name,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ 
      error: 'Status check failed',
      code: 'STATUS_ERROR'
    });
  }
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize search backend
    searchBackend = createSearchBackend();
    await searchBackend.initialize();
    
    console.log(`✅ Search backend initialized: ${searchBackend.name}`);
    
    // Start server
    if (process.env.NODE_ENV === 'production' && UDS && !process.env.API_PORT) {
      // Production: Unix Domain Socket
      try { fs.unlinkSync(UDS); } catch {}
      
      app.listen(UDS, () => {
        fs.chmodSync(UDS, 0o660);
        console.log(`🚀 Edge API server running on Unix Domain Socket: ${UDS}`);
        console.log(`🔒 Authentication: mTLS + DPoP`);
        console.log(`🔍 Search backend: ${searchBackend.name}`);
      });
    } else {
      // Development: TCP port
      app.listen(PORT, HOST, () => {
        console.log(`🚀 Edge API server running at http://${HOST}:${PORT}`);
        console.log(`🔒 Authentication: mTLS + DPoP`);
        console.log(`🔍 Search backend: ${searchBackend.name}`);
        console.log(`🏥 Health check: http://${HOST}:${PORT}/health`);
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('📴 Received SIGTERM, shutting down gracefully');
  await searchBackend?.cleanup?.();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('📴 Received SIGINT, shutting down gracefully');
  await searchBackend?.cleanup?.();
  process.exit(0);
});

startServer();

export type SearchBackend = 'sqlite' | 'meili';

export interface CnfClaim { 
  'x5t#S256': string;
}

export interface JwtPayload {
  iss: string;
  aud: string;
  sub: string;
  iat: number;
  exp: number;
  cnf: CnfClaim;
}

export interface SearchResult {
  docid: string;
  title: string;
  snippet: string;
  score?: number;
}

export interface SearchResponse {
  q: string;
  k: number;
  rows: SearchResult[];
  took_ms?: number;
}

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

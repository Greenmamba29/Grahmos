export interface Doc {
  id: string
  title: string
  url: string
  summary?: string
  content?: string
  keywords?: string[]
  category?: string
  priority?: 'low' | 'medium' | 'high'
}

export interface SearchIndex {
  docs: Doc[]
  termIndex: Map<string, Set<string>> // term -> set of doc IDs
  initialized: boolean
}

let idx: SearchIndex = {
  docs: [],
  termIndex: new Map(),
  initialized: false
}

// Initialize the search index
export async function initIndex(): Promise<void> {
  if (idx.initialized) return
  
  idx.docs = []
  idx.termIndex = new Map()
  idx.initialized = true
  
  console.log('🔍 Search index initialized')
}

// Add documents to the index
export async function addDocs(docs: Doc[]): Promise<void> {
  if (!idx.initialized) {
    await initIndex()
  }
  
  for (const doc of docs) {
    // Add to docs array
    idx.docs.push(doc)
    
    // Index terms from all searchable fields
    const searchableText = [
      doc.title,
      doc.summary || '',
      doc.content || '',
      ...(doc.keywords || []),
      doc.category || ''
    ].join(' ')
    
    const terms = tokenize(searchableText)
    
    // Add terms to inverted index
    for (const term of terms) {
      if (!idx.termIndex.has(term)) {
        idx.termIndex.set(term, new Set())
      }
      idx.termIndex.get(term)!.add(doc.id)
    }
  }
  
  console.log(`🔍 Indexed ${docs.length} documents. Total: ${idx.docs.length}`)
}

// Search documents
export async function search(query: string, options: {
  limit?: number
  threshold?: number
  includeContent?: boolean
} = {}): Promise<Doc[]> {
  if (!idx.initialized || idx.docs.length === 0) {
    return []
  }
  
  const { limit = 10, threshold = 0.1, includeContent = false } = options
  const queryTerms = tokenize(query)
  
  if (queryTerms.length === 0) {
    return []
  }
  
  // Score documents based on term matches
  const docScores = new Map<string, number>()
  const matchingDocs = new Set<string>()
  
  for (const term of queryTerms) {
    // Find documents containing this term
    const matchingDocIds = idx.termIndex.get(term) || new Set()
    
    for (const docId of matchingDocIds) {
      matchingDocs.add(docId)
      const currentScore = docScores.get(docId) || 0
      docScores.set(docId, currentScore + 1)
    }
  }
  
  // Get documents and calculate final scores
  const results: Array<{ doc: Doc; score: number }> = []
  
  for (const docId of matchingDocs) {
    const doc = idx.docs.find(d => d.id === docId)
    if (!doc) continue
    
    const termScore = docScores.get(docId) || 0
    const normalizedScore = termScore / queryTerms.length
    
    // Boost score based on priority
    let priorityBoost = 1
    if (doc.priority === 'high') priorityBoost = 1.5
    else if (doc.priority === 'medium') priorityBoost = 1.2
    
    // Boost score if title contains query terms
    let titleBoost = 1
    const titleTerms = tokenize(doc.title)
    if (queryTerms.some(term => titleTerms.includes(term))) {
      titleBoost = 1.3
    }
    
    const finalScore = normalizedScore * priorityBoost * titleBoost
    
    if (finalScore >= threshold) {
      results.push({ doc, score: finalScore })
    }
  }
  
  // Sort by score (descending) and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc }) => doc)
}

// Get document by ID
export async function getDocument(id: string): Promise<Doc | null> {
  if (!idx.initialized) return null
  return idx.docs.find(doc => doc.id === id) || null
}

// Get index statistics
export async function getIndexStats(): Promise<{
  totalDocs: number
  totalTerms: number
  initialized: boolean
}> {
  return {
    totalDocs: idx.docs.length,
    totalTerms: idx.termIndex.size,
    initialized: idx.initialized
  }
}

// Clear the index
export async function clearIndex(): Promise<void> {
  idx.docs = []
  idx.termIndex.clear()
  idx.initialized = false
  console.log('🔍 Search index cleared')
}

// Tokenize text into searchable terms
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ') // Replace non-alphanumeric with spaces
    .split(/\s+/) // Split on whitespace
    .filter(term => term.length > 2) // Filter out very short terms
    .filter(term => !isStopWord(term)) // Filter out stop words
}

// Common stop words to filter out
function isStopWord(term: string): boolean {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'this', 'that', 'these', 'those', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has',
    'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
    'can', 'shall', 'it', 'its', 'they', 'them', 'their', 'he', 'she', 'his', 'her'
  ])
  return stopWords.has(term)
}

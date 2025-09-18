import type { EventEmitter } from 'node:events'
import type { 
  SemanticSearchQuery,
  SemanticSearchResponse,
  P2PSemanticMessage,
  SemanticUpdate
} from './types'

export interface P2PNode {
  nodeId: string
  emit(event: string, data: any): boolean
  on(event: string, handler: (data: any) => void): void
}

export class SemanticSearchP2PBridge {
  private p2pNode: P2PNode | null = null
  private messageHandlers = new Map<string, Function>()
  private semanticQueries = new Map<string, SemanticSearchQuery>()
  
  constructor(p2pNode?: P2PNode) {
    this.p2pNode = p2pNode || null
  }

  async initialize(p2pNode: P2PNode): Promise<void> {
    this.p2pNode = p2pNode
    
    // Listen for P2P semantic messages
    this.p2pNode.on('semantic_message', this.handleSemanticMessage.bind(this))
    this.p2pNode.on('peer_connected', this.handlePeerConnected.bind(this))
    this.p2pNode.on('peer_disconnected', this.handlePeerDisconnected.bind(this))
    
    console.log('🌐 P2P Semantic Search Bridge initialized')
  }

  // Broadcast a semantic query to the network
  async broadcastQuery(query: SemanticSearchQuery): Promise<void> {
    if (!this.p2pNode) {
      console.warn('⚠️ P2P node not available, skipping query broadcast')
      return
    }

    const message: P2PSemanticMessage = {
      type: 'semantic_query',
      payload: query,
      node_id: this.p2pNode.nodeId,
      timestamp: Date.now()
    }

    this.semanticQueries.set(query.id, query)
    this.p2pNode.emit('broadcast_semantic', message)
    
    console.log('📡 Broadcasting semantic query:', query.id)
  }

  // Broadcast a semantic response
  async broadcastResponse(response: SemanticSearchResponse): Promise<void> {
    if (!this.p2pNode) return

    const message: P2PSemanticMessage = {
      type: 'semantic_response',
      payload: response,
      node_id: this.p2pNode.nodeId,
      timestamp: Date.now()
    }

    this.p2pNode.emit('broadcast_semantic', message)
    console.log('📤 Broadcasting semantic response:', response.query_id)
  }

  // Broadcast real-time updates
  async broadcastUpdate(update: SemanticUpdate): Promise<void> {
    if (!this.p2pNode) return

    const message: P2PSemanticMessage = {
      type: 'semantic_update',
      payload: update,
      node_id: this.p2pNode.nodeId,
      timestamp: Date.now()
    }

    this.p2pNode.emit('broadcast_semantic', message)
    console.log('🔄 Broadcasting semantic update:', update.query_id)
  }

  // Handle incoming semantic messages from P2P network
  private async handleSemanticMessage(message: P2PSemanticMessage): Promise<void> {
    // Don't process our own messages
    if (message.node_id === this.p2pNode?.nodeId) return

    console.log('📥 Received P2P semantic message:', message.type, message.node_id)

    switch (message.type) {
      case 'semantic_query':
        await this.handleRemoteQuery(message.payload as SemanticSearchQuery, message.node_id)
        break
      
      case 'semantic_response':
        await this.handleRemoteResponse(message.payload as SemanticSearchResponse, message.node_id)
        break
      
      case 'semantic_update':
        await this.handleRemoteUpdate(message.payload as SemanticUpdate, message.node_id)
        break
    }
  }

  private async handleRemoteQuery(query: SemanticSearchQuery, fromNodeId: string): Promise<void> {
    console.log('🔍 Processing remote semantic query from', fromNodeId, ':', query.query)
    
    // Store the query for potential collaboration
    this.semanticQueries.set(query.id, query)
    
    // Emit event for local semantic engine to potentially respond
    this.emit('remote_query', { query, fromNodeId })
  }

  private async handleRemoteResponse(response: SemanticSearchResponse, fromNodeId: string): Promise<void> {
    console.log('📊 Received remote semantic response from', fromNodeId, ':', response.query_id)
    
    // Check if we had asked for this query
    const localQuery = this.semanticQueries.get(response.query_id)
    if (localQuery) {
      this.emit('remote_response', { response, fromNodeId, localQuery })
    }
  }

  private async handleRemoteUpdate(update: SemanticUpdate, fromNodeId: string): Promise<void> {
    console.log('🔄 Received remote semantic update from', fromNodeId, ':', update.query_id)
    
    // Only process updates for queries we're interested in
    const localQuery = this.semanticQueries.get(update.query_id)
    if (localQuery) {
      this.emit('remote_update', { update, fromNodeId, localQuery })
    }
  }

  private handlePeerConnected(peerId: string): void {
    console.log('👋 Peer connected for semantic search:', peerId)
    
    // Could sync recent queries or context here
    this.emit('peer_connected', peerId)
  }

  private handlePeerDisconnected(peerId: string): void {
    console.log('👋 Peer disconnected from semantic search:', peerId)
    this.emit('peer_disconnected', peerId)
  }

  // Event emitter functionality
  private eventListeners = new Map<string, Function[]>()

  on(event: string, handler: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, [])
    }
    this.eventListeners.get(event)!.push(handler)
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) handlers.splice(index, 1)
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.eventListeners.get(event) || []
    handlers.forEach(handler => {
      try {
        handler(data)
      } catch (error) {
        console.error('Error in semantic P2P event handler:', error)
      }
    })
  }

  // Get network insights
  getNetworkStats(): {
    activeQueries: number
    totalQueries: number
    connectedPeers: number
  } {
    return {
      activeQueries: this.semanticQueries.size,
      totalQueries: this.semanticQueries.size,
      connectedPeers: 0 // Would need P2P node integration
    }
  }

  // Clean up old queries
  cleanup(maxAge = 600000): void { // 10 minutes default
    const cutoff = Date.now() - maxAge
    let cleaned = 0
    
    for (const [queryId, query] of this.semanticQueries) {
      if (query.timestamp < cutoff) {
        this.semanticQueries.delete(queryId)
        cleaned++
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old semantic queries`)
    }
  }

  dispose(): void {
    this.semanticQueries.clear()
    this.eventListeners.clear()
    this.messageHandlers.clear()
    
    if (this.p2pNode) {
      // Could remove listeners here if P2P node supports it
      this.p2pNode = null
    }
    
    console.log('🛑 P2P Semantic Search Bridge disposed')
  }
}

// Enhanced semantic search with P2P collaboration
export class CollaborativeSemanticSearch {
  private p2pBridge: SemanticSearchP2PBridge
  private localEngine: any // Would be GPTOSSSemanticEngine
  private collaborativeResults = new Map<string, SemanticSearchResponse[]>()

  constructor(localEngine: any, p2pNode?: P2PNode) {
    this.localEngine = localEngine
    this.p2pBridge = new SemanticSearchP2PBridge(p2pNode)
    
    // Listen for P2P events
    this.p2pBridge.on('remote_response', this.handleCollaborativeResponse.bind(this))
    this.p2pBridge.on('remote_update', this.handleCollaborativeUpdate.bind(this))
  }

  async initialize(p2pNode: P2PNode): Promise<void> {
    await this.p2pBridge.initialize(p2pNode)
  }

  async collaborativeSearch(query: SemanticSearchQuery): Promise<SemanticSearchResponse> {
    // Start local search
    const localPromise = this.localEngine.search(query)
    
    // Broadcast query to network for collaborative results
    await this.p2pBridge.broadcastQuery(query)
    
    // Wait for local results
    const localResponse = await localPromise
    
    // Wait a bit for collaborative responses
    await this.waitForCollaborativeResponses(query.id, 2000) // 2 second timeout
    
    // Merge collaborative results
    const collaborativeResponses = this.collaborativeResults.get(query.id) || []
    const mergedResponse = this.mergeSemanticResponses(localResponse, collaborativeResponses)
    
    // Cleanup
    this.collaborativeResults.delete(query.id)
    
    return mergedResponse
  }

  private async waitForCollaborativeResponses(queryId: string, timeout: number): Promise<void> {
    return new Promise(resolve => {
      const timer = setTimeout(resolve, timeout)
      
      const checkResponses = () => {
        const responses = this.collaborativeResults.get(queryId)
        if (responses && responses.length > 0) {
          clearTimeout(timer)
          resolve()
        }
      }
      
      // Check periodically
      const interval = setInterval(checkResponses, 100)
      setTimeout(() => clearInterval(interval), timeout)
    })
  }

  private handleCollaborativeResponse(data: {
    response: SemanticSearchResponse
    fromNodeId: string
    localQuery: SemanticSearchQuery
  }): void {
    const { response, fromNodeId } = data
    
    if (!this.collaborativeResults.has(response.query_id)) {
      this.collaborativeResults.set(response.query_id, [])
    }
    
    this.collaborativeResults.get(response.query_id)!.push(response)
    
    console.log(`🤝 Received collaborative response from ${fromNodeId} for query ${response.query_id}`)
  }

  private handleCollaborativeUpdate(data: {
    update: SemanticUpdate
    fromNodeId: string
    localQuery: SemanticSearchQuery
  }): void {
    console.log(`🔄 Received collaborative update from ${data.fromNodeId}`)
    // Could update local results in real-time here
  }

  private mergeSemanticResponses(
    localResponse: SemanticSearchResponse,
    collaborativeResponses: SemanticSearchResponse[]
  ): SemanticSearchResponse {
    if (collaborativeResponses.length === 0) {
      return localResponse
    }

    // Merge results while avoiding duplicates
    const allResults = [...localResponse.results]
    const seenIds = new Set(allResults.map(r => r.id))

    for (const response of collaborativeResponses) {
      for (const result of response.results) {
        if (!seenIds.has(result.id)) {
          allResults.push({
            ...result,
            semantic_score: result.semantic_score * 0.9 // Slightly reduce collaborative scores
          })
          seenIds.add(result.id)
        }
      }
    }

    // Re-sort by semantic score
    allResults.sort((a, b) => b.semantic_score - a.semantic_score)

    // Merge suggested queries
    const allSuggestions = [
      ...localResponse.suggested_queries,
      ...collaborativeResponses.flatMap(r => r.suggested_queries)
    ]
    const uniqueSuggestions = [...new Set(allSuggestions)]

    // Enhanced summary with collaborative info
    const collaborativeInfo = collaborativeResponses.length > 0 
      ? ` Enhanced with insights from ${collaborativeResponses.length} peer${collaborativeResponses.length > 1 ? 's' : ''}.`
      : ''

    return {
      ...localResponse,
      results: allResults.slice(0, 15), // Limit to top 15 results
      semantic_summary: localResponse.semantic_summary + collaborativeInfo,
      suggested_queries: uniqueSuggestions.slice(0, 5),
      context_insights: [
        ...localResponse.context_insights,
        `Collaborative search: ${collaborativeResponses.length} peer responses integrated`
      ]
    }
  }

  dispose(): void {
    this.p2pBridge.dispose()
    this.collaborativeResults.clear()
  }
}
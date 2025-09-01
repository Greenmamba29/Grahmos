/**
 * AI Model Management System
 * Handles downloading, caching, and managing offline AI models
 */

export interface ModelInfo {
  id: string
  name: string
  description: string
  size: number // Size in MB
  type: 'text-generation' | 'feature-extraction'
  path: string
  version: string
  downloaded: boolean
  downloadProgress?: number
  lastUsed?: number
}

export interface ModelDownloadProgress {
  modelId: string
  loaded: number
  total: number
  progress: number // 0-100
  status: 'downloading' | 'extracting' | 'complete' | 'error'
  error?: string
}

export class ModelManager {
  private static instance: ModelManager
  private models: Map<string, ModelInfo> = new Map()
  private downloadListeners: Set<(progress: ModelDownloadProgress) => void> = new Set()
  private dbName = 'grahmos-ai-models'
  
  private constructor() {
    this.initializeDefaultModels()
  }

  static getInstance(): ModelManager {
    if (!ModelManager.instance) {
      ModelManager.instance = new ModelManager()
    }
    return ModelManager.instance
  }

  private initializeDefaultModels() {
    const defaultModels: Omit<ModelInfo, 'downloaded' | 'downloadProgress'>[] = [
      {
        id: 'gpt2-small',
        name: 'GPT-2 Small',
        description: 'Lightweight text generation model (124M parameters)',
        size: 500,
        type: 'text-generation',
        path: 'Xenova/gpt2',
        version: '1.0.0'
      },
      {
        id: 'distilgpt2',
        name: 'DistilGPT-2',
        description: 'Faster, smaller version of GPT-2 (82M parameters)',
        size: 350,
        type: 'text-generation',
        path: 'Xenova/distilgpt2',
        version: '1.0.0'
      },
      {
        id: 'all-minilm-l6-v2',
        name: 'All-MiniLM-L6-v2',
        description: 'Sentence transformer for embeddings (23M parameters)',
        size: 90,
        type: 'feature-extraction',
        path: 'Xenova/all-MiniLM-L6-v2',
        version: '1.0.0'
      },
      {
        id: 'all-minilm-l12-v2',
        name: 'All-MiniLM-L12-v2',
        description: 'Larger sentence transformer with better quality (34M parameters)',
        size: 134,
        type: 'feature-extraction',
        path: 'Xenova/all-MiniLM-L12-v2',
        version: '1.0.0'
      }
    ]

    for (const model of defaultModels) {
      this.models.set(model.id, {
        ...model,
        downloaded: false
      })
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    // Check which models are actually downloaded by querying the cache
    await this.updateDownloadStatus()
    return Array.from(this.models.values())
  }

  async getDownloadedModels(): Promise<ModelInfo[]> {
    await this.updateDownloadStatus()
    return Array.from(this.models.values()).filter(model => model.downloaded)
  }

  async getModelInfo(modelId: string): Promise<ModelInfo | null> {
    return this.models.get(modelId) || null
  }

  private async updateDownloadStatus(): Promise<void> {
    // Check if models are cached in browser storage
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        const modelCacheNames = cacheNames.filter(name => name.includes('transformers') || name.includes('huggingface'))
        
        for (const [modelId, model] of this.models) {
          // Simple heuristic: if there are HF caches, assume models might be downloaded
          // In a real implementation, you'd check more specifically
          const hasCache = modelCacheNames.length > 0
          this.models.set(modelId, { ...model, downloaded: hasCache })
        }
      }

      // Also check IndexedDB for model files
      if ('indexedDB' in window) {
        await this.checkIndexedDBForModels()
      }
    } catch (error) {
      console.warn('Failed to check model download status:', error)
    }
  }

  private async checkIndexedDBForModels(): Promise<void> {
    try {
      const databases = await indexedDB.databases?.() || []
      const hasHuggingFaceDB = databases.some(db => 
        db.name?.includes('transformers') || db.name?.includes('huggingface')
      )

      if (hasHuggingFaceDB) {
        // If HuggingFace databases exist, mark some models as potentially downloaded
        for (const [modelId, model] of this.models) {
          if (!model.downloaded) {
            this.models.set(modelId, { ...model, downloaded: true })
          }
        }
      }
    } catch (error) {
      console.warn('Failed to check IndexedDB for models:', error)
    }
  }

  async downloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    if (model.downloaded) {
      console.log(`Model ${modelId} already downloaded`)
      return
    }

    this.notifyDownloadProgress({
      modelId,
      loaded: 0,
      total: model.size * 1024 * 1024, // Convert MB to bytes
      progress: 0,
      status: 'downloading'
    })

    try {
      // Import transformers.js dynamically to trigger model download
      const { pipeline } = await import('@xenova/transformers')
      
      // Create pipeline which will trigger model download
      await pipeline(model.type, model.path, {
        cache_dir: './.ai-models',
        local_files_only: false,
        progress_callback: (data: any) => {
          if (data.status === 'progress') {
            const progress = Math.round((data.loaded / data.total) * 100)
            this.notifyDownloadProgress({
              modelId,
              loaded: data.loaded,
              total: data.total,
              progress,
              status: 'downloading'
            })
          }
        }
      })

      // Mark as downloaded
      this.models.set(modelId, {
        ...model,
        downloaded: true,
        lastUsed: Date.now()
      })

      this.notifyDownloadProgress({
        modelId,
        loaded: model.size * 1024 * 1024,
        total: model.size * 1024 * 1024,
        progress: 100,
        status: 'complete'
      })

      console.log(`✅ Successfully downloaded model: ${model.name}`)
    } catch (error) {
      console.error(`❌ Failed to download model ${modelId}:`, error)
      
      this.notifyDownloadProgress({
        modelId,
        loaded: 0,
        total: model.size * 1024 * 1024,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      
      throw error
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId)
    if (!model) {
      throw new Error(`Model ${modelId} not found`)
    }

    try {
      // Clear related caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        const modelCaches = cacheNames.filter(name => 
          name.includes(modelId) || name.includes(model.path.split('/')[1])
        )
        
        for (const cacheName of modelCaches) {
          await caches.delete(cacheName)
        }
      }

      // Note: Complete cache clearing would require more sophisticated logic
      // to identify and remove specific model files from HuggingFace cache
      
      this.models.set(modelId, {
        ...model,
        downloaded: false
      })

      console.log(`🗑️ Deleted model: ${model.name}`)
    } catch (error) {
      console.error(`Failed to delete model ${modelId}:`, error)
      throw error
    }
  }

  async getStorageInfo(): Promise<{
    totalSize: number
    usedSize: number
    availableSize: number
    modelCount: number
  }> {
    let usedSize = 0
    let modelCount = 0

    for (const model of this.models.values()) {
      if (model.downloaded) {
        usedSize += model.size * 1024 * 1024 // Convert MB to bytes
        modelCount++
      }
    }

    // Estimate available storage (this is approximate)
    let availableSize = 0
    if ('navigator' in window && 'storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate()
        const quota = estimate.quota || 0
        const usage = estimate.usage || 0
        availableSize = quota - usage
      } catch (error) {
        console.warn('Failed to estimate storage:', error)
      }
    }

    return {
      totalSize: Array.from(this.models.values()).reduce((sum, model) => sum + (model.size * 1024 * 1024), 0),
      usedSize,
      availableSize,
      modelCount
    }
  }

  async clearAllModels(): Promise<void> {
    try {
      // Clear all transformers/HuggingFace related caches
      if ('caches' in window) {
        const cacheNames = await caches.keys()
        const modelCaches = cacheNames.filter(name => 
          name.includes('transformers') || 
          name.includes('huggingface') ||
          name.includes('xenova')
        )
        
        for (const cacheName of modelCaches) {
          await caches.delete(cacheName)
        }
      }

      // Mark all models as not downloaded
      for (const [modelId, model] of this.models) {
        this.models.set(modelId, {
          ...model,
          downloaded: false
        })
      }

      console.log('🗑️ Cleared all AI models')
    } catch (error) {
      console.error('Failed to clear all models:', error)
      throw error
    }
  }

  onDownloadProgress(callback: (progress: ModelDownloadProgress) => void): () => void {
    this.downloadListeners.add(callback)
    return () => {
      this.downloadListeners.delete(callback)
    }
  }

  private notifyDownloadProgress(progress: ModelDownloadProgress): void {
    for (const listener of this.downloadListeners) {
      try {
        listener(progress)
      } catch (error) {
        console.error('Error in download progress listener:', error)
      }
    }
  }

  async updateModelUsage(modelId: string): Promise<void> {
    const model = this.models.get(modelId)
    if (model) {
      this.models.set(modelId, {
        ...model,
        lastUsed: Date.now()
      })
    }
  }

  async getModelRecommendations(): Promise<{
    recommended: ModelInfo[]
    reasons: string[]
  }> {
    const downloadedModels = await this.getDownloadedModels()
    const allModels = await this.getAvailableModels()
    
    const recommendations: ModelInfo[] = []
    const reasons: string[] = []

    // If no models downloaded, recommend the lightweight ones
    if (downloadedModels.length === 0) {
      const distilgpt2 = allModels.find(m => m.id === 'distilgpt2')
      const miniLM = allModels.find(m => m.id === 'all-minilm-l6-v2')
      
      if (distilgpt2) {
        recommendations.push(distilgpt2)
        reasons.push('DistilGPT-2 is a fast, lightweight model perfect for getting started')
      }
      
      if (miniLM) {
        recommendations.push(miniLM)
        reasons.push('MiniLM is essential for semantic search and context understanding')
      }
    }

    // If only text generation model, recommend embedding model
    const hasTextGen = downloadedModels.some(m => m.type === 'text-generation')
    const hasEmbedding = downloadedModels.some(m => m.type === 'feature-extraction')
    
    if (hasTextGen && !hasEmbedding) {
      const miniLM = allModels.find(m => m.id === 'all-minilm-l6-v2')
      if (miniLM && !miniLM.downloaded) {
        recommendations.push(miniLM)
        reasons.push('Adding an embedding model will improve search context understanding')
      }
    }

    return { recommended: recommendations, reasons }
  }
}

// Export singleton instance
export const modelManager = ModelManager.getInstance()

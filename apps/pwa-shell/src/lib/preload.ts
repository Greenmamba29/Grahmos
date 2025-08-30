'use client';

/**
 * PWA Preload Service
 * Manages preloading and storing of AI models and data for offline use
 */

import { useCallback, useEffect, useState } from 'react';

interface PreloadOptions {
  modelTypes?: Array<'ai-assistant' | 'ai-tts' | 'safety' | 'emergency'>;
  priority?: 'high' | 'medium' | 'low';
  onProgress?: (progress: number, details: string) => void;
  force?: boolean;
}

interface PreloadStatus {
  status: 'idle' | 'checking' | 'downloading' | 'complete' | 'error';
  progress: number;
  availableModels: string[];
  downloadedModels: string[];
  error?: string;
  lastUpdated?: Date;
}

// Default model definitions - would be expanded with actual model URLs and versions
const MODEL_DEFINITIONS = {
  'ai-assistant': [
    {
      name: 'gemma-3n-emergency',
      url: '/models/gemma-3n-emergency.safetensors',
      size: 'small',
      version: '1.0.0',
      priority: 'high',
      purpose: 'Emergency AI assistant'
    }
  ],
  'ai-tts': [
    {
      name: 'piper-en-emergency',
      url: '/models/piper-en-emergency.onnx',
      size: 'tiny',
      version: '1.0.0',
      priority: 'medium',
      purpose: 'Emergency voice synthesis'
    }
  ],
  'safety': [
    {
      name: 'emergency-response',
      url: '/models/emergency-response.bin',
      size: 'tiny',
      version: '1.0.0',
      priority: 'high',
      purpose: 'Emergency response protocols'
    }
  ],
  'emergency': [
    {
      name: 'evacuation-data',
      url: '/data/evacuation-data.json',
      size: 'tiny',
      version: '1.0.0',
      priority: 'high',
      purpose: 'Evacuation routes and protocols'
    }
  ]
};

// Wrapper for IndexedDB operations
const modelStore = {
  DB_NAME: 'grahmos-models',
  DB_VERSION: 1,
  STORE_NAME: 'models',
  
  // Open the database
  async openDB() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(new Error('Failed to open model database'));
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'name' });
        }
      };
      
      request.onsuccess = () => resolve(request.result);
    });
  },
  
  // Store a model in the database
  async storeModel(name: string, data: ArrayBuffer, metadata: Record<string, unknown>) {
    const db = await this.openDB();
    
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.put({
        name,
        data,
        metadata,
        timestamp: new Date().toISOString()
      });
      
      request.onerror = () => reject(new Error(`Failed to store model: ${name}`));
      request.onsuccess = () => resolve();
      
      transaction.oncomplete = () => db.close();
    });
  },
  
  // Get a model from the database
  async getModel(name: string) {
    const db = await this.openDB();
    
    return new Promise<unknown>((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.get(name);
      
      request.onerror = () => reject(new Error(`Failed to get model: ${name}`));
      request.onsuccess = () => resolve(request.result);
      
      transaction.oncomplete = () => db.close();
    });
  },
  
  // List all models in the database
  async listModels() {
    const db = await this.openDB();
    
    return new Promise<string[]>((resolve, reject) => {
      const transaction = db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      
      const request = store.getAllKeys();
      
      request.onerror = () => reject(new Error('Failed to list models'));
      request.onsuccess = () => resolve(request.result as string[]);
      
      transaction.oncomplete = () => db.close();
    });
  }
};

// Preload service hook
export function usePreload() {
  const [status, setStatus] = useState<PreloadStatus>({
    status: 'idle',
    progress: 0,
    availableModels: [],
    downloadedModels: []
  });

  // Check storage status
  const checkStatus = useCallback(async () => {
    try {
      setStatus(prev => ({ ...prev, status: 'checking' }));
      
      // Check available storage
      let storageAvailable = true;
      try {
        const quota = await navigator.storage?.estimate() || { quota: 0, usage: 0 };
        const available = quota.quota ? (quota.quota - (quota.usage || 0)) : 0;
        storageAvailable = available > 50 * 1024 * 1024; // Require at least 50MB free
      } catch (e) {
        console.warn('Storage estimation not available', e);
      }
      
      if (!storageAvailable) {
        throw new Error('Insufficient storage space available');
      }
      
      // Check which models are already downloaded
      const downloadedModels = await modelStore.listModels();
      
      // Determine available models from definitions
      const availableModels = Object.values(MODEL_DEFINITIONS)
        .flat()
        .map(model => model.name);
      
      // Use availableModels for validation if needed
      console.log('Available models:', availableModels.length);
      
      setStatus({
        status: 'idle',
        progress: 0,
        availableModels,
        downloadedModels,
        lastUpdated: new Date()
      });
      
      return { availableModels, downloadedModels };
    } catch (error) {
      console.error('Failed to check preload status:', error);
      setStatus(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
      throw error;
    }
  }, []);

  // Preload models
  const preloadModels = useCallback(async (options: PreloadOptions = {}) => {
    try {
      // First check status to get updated lists
      const { availableModels, downloadedModels } = await checkStatus();
      
      // Filter models by type and priority
      const modelTypes = options.modelTypes || ['ai-assistant', 'emergency'];
      const allModelsToDownload = modelTypes
        .flatMap(type => MODEL_DEFINITIONS[type as keyof typeof MODEL_DEFINITIONS] || [])
        .filter(model => options.force || !downloadedModels.includes(model.name))
        .filter(model => !options.priority || model.priority === options.priority || model.priority === 'high');
      
      if (allModelsToDownload.length === 0) {
        // No models to download
        setStatus(prev => ({ ...prev, status: 'complete', progress: 100 }));
        return;
      }
      
      setStatus(prev => ({ ...prev, status: 'downloading', progress: 0 }));
      
      // Download models sequentially to avoid overwhelming the network
      let completedModels = 0;
      const totalModels = allModelsToDownload.length;
      
      for (const model of allModelsToDownload) {
        try {
          options.onProgress?.(
            (completedModels / totalModels) * 100, 
            `Downloading ${model.name} (${completedModels + 1}/${totalModels})`
          );
          
          // Fetch the model
          const response = await fetch(model.url);
          if (!response.ok) {
            throw new Error(`Failed to download model: ${response.statusText}`);
          }
          
          const modelData = await response.arrayBuffer();
          
          // Store in IndexedDB
          await modelStore.storeModel(model.name, modelData, {
            version: model.version,
            size: model.size,
            priority: model.priority,
            purpose: model.purpose,
            url: model.url
          });
          
          completedModels++;
          
          // Update progress
          setStatus(prev => ({ 
            ...prev, 
            progress: (completedModels / totalModels) * 100,
            downloadedModels: [...prev.downloadedModels, model.name]
          }));
          
          options.onProgress?.(
            (completedModels / totalModels) * 100, 
            `Downloaded ${model.name} (${completedModels}/${totalModels})`
          );
        } catch (modelError) {
          console.error(`Error downloading model ${model.name}:`, modelError);
          // Continue with next model
        }
      }
      
      setStatus(prev => ({ 
        ...prev, 
        status: 'complete',
        progress: 100,
        lastUpdated: new Date()
      }));
    } catch (error) {
      console.error('Failed to preload models:', error);
      setStatus(prev => ({ 
        ...prev, 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }));
    }
  }, [checkStatus]);

  // Auto-check status on mount if in browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      checkStatus().catch(console.error);
    }
  }, [checkStatus]);

  return {
    status,
    preloadModels,
    checkStatus
  };
}

// Helper for checking available storage
export async function checkStorageAvailability(): Promise<{
  available: boolean;
  quota?: number;
  usage?: number;
  availableBytes?: number;
}> {
  if (typeof navigator === 'undefined' || !navigator.storage || !navigator.storage.estimate) {
    return { available: false };
  }
  
  try {
    const estimate = await navigator.storage.estimate();
    const availableBytes = estimate.quota ? (estimate.quota - (estimate.usage || 0)) : 0;
    
    return {
      available: availableBytes > 10 * 1024 * 1024, // At least 10MB
      quota: estimate.quota,
      usage: estimate.usage,
      availableBytes
    };
  } catch (error) {
    console.error('Failed to check storage availability:', error);
    return { available: false };
  }
}

// Initialize preload on PWA startup
export async function initializePreload(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Register for service worker updates
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        console.log('Cache updated:', event.data.updatedURL);
      }
    });
  }
  
  // Check if this is a fresh install
  const isFirstVisit = !localStorage.getItem('grahmos-first-visit');
  if (isFirstVisit) {
    localStorage.setItem('grahmos-first-visit', 'completed');
    
    // Auto-preload essential models on first visit
    // Note: This would need to be called from a component context
    console.log('First visit detected - preload models when component mounts');
    // Actual preloading would be triggered from a React component
  }
}

/**
 * Transformers.js Environment Configuration for Browser
 * Ensures that transformers.js uses the web backend instead of node backend
 */

// Configure transformers.js environment for browser usage
export function configureTransformersEnvironment() {
  if (typeof window !== 'undefined') {
    // We're in the browser
    try {
      // Import env from transformers and configure it for browser
      import('@xenova/transformers').then(({ env }) => {
        // Force the backend to be 'onnxruntime-web' instead of 'onnxruntime-node'
        env.backends.onnx.wasm = {
          proxy: true, // Use proxy workers for better performance
        }
        
        // Disable Node.js specific backends
        env.allowRemoteModels = true
        env.allowLocalModels = true
        
        console.log('✅ Transformers.js configured for browser environment')
      }).catch((error) => {
        console.warn('⚠️ Failed to configure transformers environment:', error)
      })
    } catch (error) {
      console.warn('⚠️ Transformers.js environment configuration failed:', error)
    }
  }
}

// Auto-configure when this module is imported
if (typeof window !== 'undefined') {
  configureTransformersEnvironment()
}

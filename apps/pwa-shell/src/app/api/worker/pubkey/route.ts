import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Default edge worker URL (in production this would be the deployed worker)
    const workerUrl = process.env.EDGE_WORKER_URL || 'http://localhost:8787'
    
    const response = await fetch(`${workerUrl}/pubkey`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Worker responded with ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Failed to fetch pubkey from worker:', error)
    return NextResponse.json(
      { error: 'Failed to fetch public key' },
      { status: 500 }
    )
  }
}

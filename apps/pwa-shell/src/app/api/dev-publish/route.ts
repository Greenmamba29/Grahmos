import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { title, url, summary } = await request.json()
    
    if (!title || !url) {
      return NextResponse.json({ error: 'title and url are required' }, { status: 400 })
    }

    const doc = {
      id: 'dev_' + Math.random().toString(36).slice(2),
      title,
      url,
      summary: summary || ''
    }

    return NextResponse.json({ success: true, doc })
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
}

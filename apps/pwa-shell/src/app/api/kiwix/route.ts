import 'server-only'

function isSafePath(p: string) {
  return p.startsWith('/') && !p.startsWith('//') && !p.includes('://') && !p.includes('..')
}

function rewriteHtml(html: string, endpoint: string) {
  return html.replace(/(src|href)=(["'])(\/?[^"'>]+)\2/gi, (_m, attr, q, val) => {
    if (!val || val.startsWith('data:') || val.startsWith('mailto:') || val.startsWith('javascript:')) return _m
    if (val.startsWith('http://') || val.startsWith('https://')) return _m
    const resolved = val.startsWith('/') ? val : new URL(val, 'http://x/').pathname // resolve relative-ish
    return `${attr}=${q}/api/kiwix?path=${encodeURIComponent(resolved)}${q}`
  })
}

export async function GET(req: Request) {
  const endpoint = process.env.KIWIX_ENDPOINT || 'http://localhost:8080'
  const { searchParams } = new URL(req.url)
  const path = searchParams.get('path') || '/'
  if (!isSafePath(path)) return new Response('bad path', { status: 400 })

  const url = new URL(path, endpoint)
  const upstream = await fetch(url.toString(), {
    headers: { 'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
  })
  const ct = upstream.headers.get('content-type') || ''
  const body = await upstream.arrayBuffer()

  if (ct.includes('text/html')) {
    const rewritten = rewriteHtml(new TextDecoder().decode(body), endpoint)
    return new Response(rewritten, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
  return new Response(body, { headers: { 'content-type': ct || 'application/octet-stream' } })
}

'use client'
import { useEffect, useRef, useState } from 'react'
import * as Search from '../../../../packages/search-core/src'

export type Doc = { id:string; title:string; url:string; summary?:string }

export function useOfflineSearch(){
  const ready = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function init(){
    try {
      if (!ready.current){
        await Search.initIndex()
        const res = await fetch('/catalog.seed.json')
        const docs: Doc[] = await res.json()
        await Search.addDocs(docs)
        ready.current = true
        setLoading(false)
      }
    } catch (e: unknown){ 
      const message = e instanceof Error ? e.message : 'init failed'
      setError(message)
      setLoading(false) 
    }
  }

  useEffect(()=>{ init() },[])

  async function search(q:string): Promise<Doc[]>{
    if (!ready.current) return []
    const r = await Search.search(q)
    return Array.isArray(r) ? r : (r as { items: Doc[] }).items || []
  }

  return { loading, error, search }
}

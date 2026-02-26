import { useMemo } from 'react'
import Fuse from 'fuse.js'

export function useSearch(dossiers, query) {
  const fuse = useMemo(() => {
    return new Fuse(dossiers, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'tags', weight: 0.2 },
        { name: 'authors', weight: 0.1 },
      ],
      threshold: 0.35,
      ignoreLocation: true,
      includeScore: true,
    })
  }, [dossiers])

  const results = useMemo(() => {
    if (!query || query.trim() === '') return dossiers
    return fuse.search(query).map(r => r.item)
  }, [query, fuse, dossiers])

  return results
}

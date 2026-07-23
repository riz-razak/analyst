import { useState, useEffect } from 'react'

export function useDossiers() {
  const [dossiers, setDossiers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/data/dossiers.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dossiers')
        return res.json()
      })
      .then(data => {
        const sorted = [...data.dossiers]
          .filter(d => d.status === 'published')
          .sort((a, b) => new Date(b.date) - new Date(a.date))
        setDossiers(sorted)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const allTags = [...new Set(dossiers.flatMap(d => d.tags))].sort()

  return { dossiers, allTags, loading, error }
}

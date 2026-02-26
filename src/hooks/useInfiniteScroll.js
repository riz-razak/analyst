import { useState, useEffect, useCallback, useRef } from 'react'

export function useInfiniteScroll(items, itemsPerPage = 12) {
  const [displayCount, setDisplayCount] = useState(itemsPerPage)
  const sentinelRef = useRef(null)

  // Reset when items change (e.g., new search/filter)
  useEffect(() => {
    setDisplayCount(itemsPerPage)
  }, [items, itemsPerPage])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount(prev => Math.min(prev + itemsPerPage, items.length))
        }
      },
      { rootMargin: '200px' }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [items.length, itemsPerPage])

  return {
    displayedItems: items.slice(0, displayCount),
    hasMore: displayCount < items.length,
    sentinelRef,
  }
}

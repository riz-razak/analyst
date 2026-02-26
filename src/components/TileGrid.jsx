import DossierTile from './DossierTile'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1.5rem',
    padding: '0 1rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  sentinel: {
    height: '1px',
    gridColumn: '1 / -1',
  },
  loadingMore: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '2rem',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.8rem',
  },
  empty: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '4rem 2rem',
    color: 'var(--text-muted)',
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    display: 'block',
  },
  emptyText: {
    fontSize: '1rem',
    fontFamily: 'var(--font-serif)',
    color: 'var(--text-secondary)',
  },
}

export default function TileGrid({ dossiers }) {
  const { displayedItems, hasMore, sentinelRef } = useInfiniteScroll(dossiers, 12)

  if (dossiers.length === 0) {
    return (
      <div style={styles.grid}>
        <div style={styles.empty}>
          <span style={styles.emptyIcon}>🔍</span>
          <p style={styles.emptyText}>No dossiers match your search</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.grid}>
      {displayedItems.map((d, i) => (
        <DossierTile key={d.id} dossier={d} index={i} />
      ))}
      {hasMore && (
        <div ref={sentinelRef} style={styles.sentinel}>
          <p style={styles.loadingMore}>Loading more...</p>
        </div>
      )}
    </div>
  )
}

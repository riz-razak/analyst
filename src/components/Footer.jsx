const styles = {
  footer: {
    marginTop: 'auto',
    padding: '2rem 0',
    textAlign: 'center',
    borderTop: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    fontSize: '0.78rem',
    fontFamily: 'var(--font-mono)',
  },
  link: {
    color: 'var(--accent-cyan)',
    textDecoration: 'none',
  },
  disclaimer: {
    maxWidth: '680px',
    margin: '1rem auto 0',
    padding: '0.75rem 1.25rem',
    background: 'var(--overlay-light)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    fontSize: '0.72rem',
    lineHeight: 1.6,
    color: 'var(--text-muted)',
    textAlign: 'left',
  },
  disclaimerLabel: {
    color: 'var(--accent-gold)',
    fontWeight: 600,
  },
}

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <p>
        © {new Date().getFullYear()} Riz Razak · <a href="https://rizrazak.com" style={styles.link} target="_blank" rel="noopener noreferrer">rizrazak.com</a>
      </p>
      <div style={styles.disclaimer}>
        <span style={styles.disclaimerLabel}>⚠ ML-Assisted Research:</span>{' '}
        This site uses machine learning to augment human research and analysis. Content may contain errors or omissions — readers are encouraged to independently fact-check all claims. Reliance on this content is at the reader's own risk.
      </div>
    </footer>
  )
}

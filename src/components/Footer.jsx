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
}

export default function Footer() {
  return (
    <footer style={styles.footer}>
      <p>
        © {new Date().getFullYear()} Riz Razak · <a href="https://dgtl.lk" style={styles.link} target="_blank" rel="noopener noreferrer">dgtl.lk</a>
      </p>
    </footer>
  )
}

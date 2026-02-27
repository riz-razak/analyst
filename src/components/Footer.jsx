const SOCIALS = [
  {
    href: 'https://www.facebook.com/riz.life.crisis/',
    label: 'Facebook',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
      </svg>
    ),
  },
  {
    href: 'https://www.instagram.com/riz_razak_',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    href: 'https://www.tiktok.com/@riz.razak',
    label: 'TikTok',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.77 0 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 12.67 0l-.01-8.83a8.18 8.18 0 0 0 4.78 1.52V6.17a4.85 4.85 0 0 1-1-.48z"/>
      </svg>
    ),
  },
]

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
  socials: {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    marginBottom: '0.75rem',
  },
  socialLink: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    color: 'var(--text-muted)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    transition: 'color 150ms ease, border-color 150ms ease',
    textDecoration: 'none',
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
      <div style={styles.socials}>
        {SOCIALS.map(({ href, label, icon }) => (
          <a
            key={label}
            href={href}
            style={styles.socialLink}
            target="_blank"
            rel="noopener noreferrer"
            title={label}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--accent-cyan)'
              e.currentTarget.style.borderColor = 'var(--accent-cyan)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border-color)'
            }}
          >
            {icon}
          </a>
        ))}
      </div>
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

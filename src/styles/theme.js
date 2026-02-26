// Tag colors that work on both light and dark backgrounds
// Using darker text colors for readability on white, with translucent bg/border
export const TAG_COLORS = {
  'Cricket':    { bg: 'rgba(220,38,38,0.1)',   text: '#dc2626', border: 'rgba(220,38,38,0.25)' },
  'Politics':   { bg: 'rgba(217,119,6,0.1)',   text: '#d97706', border: 'rgba(217,119,6,0.25)' },
  'Corruption': { bg: 'rgba(161,98,7,0.1)',    text: '#a16207', border: 'rgba(161,98,7,0.25)' },
  'Sri Lanka':  { bg: 'rgba(8,145,178,0.1)',   text: '#0891b2', border: 'rgba(8,145,178,0.25)' },
  'Sports':     { bg: 'rgba(5,150,105,0.1)',   text: '#059669', border: 'rgba(5,150,105,0.25)' },
  'Security':   { bg: 'rgba(124,58,237,0.1)',  text: '#7c3aed', border: 'rgba(124,58,237,0.25)' },
  'Government': { bg: 'rgba(37,99,235,0.1)',   text: '#2563eb', border: 'rgba(37,99,235,0.25)' },
  'Economy':    { bg: 'rgba(225,29,72,0.1)',   text: '#e11d48', border: 'rgba(225,29,72,0.25)' },
  'Military':   { bg: 'rgba(100,116,139,0.1)', text: '#64748b', border: 'rgba(100,116,139,0.25)' },
  'Religion':   { bg: 'rgba(180,83,9,0.1)',    text: '#b45309', border: 'rgba(180,83,9,0.25)' },
  'Terrorism':  { bg: 'rgba(185,28,28,0.1)',   text: '#b91c1c', border: 'rgba(185,28,28,0.25)' },
  'Intelligence': { bg: 'rgba(79,70,229,0.1)', text: '#4f46e5', border: 'rgba(79,70,229,0.25)' },
  'Conspiracy': { bg: 'rgba(147,51,234,0.1)',  text: '#9333ea', border: 'rgba(147,51,234,0.25)' },
}

const FALLBACK_COLORS = [
  { bg: 'rgba(147,51,234,0.1)',  text: '#9333ea', border: 'rgba(147,51,234,0.25)' },
  { bg: 'rgba(219,39,119,0.1)', text: '#db2777', border: 'rgba(219,39,119,0.25)' },
  { bg: 'rgba(6,182,212,0.1)',  text: '#0891b2', border: 'rgba(6,182,212,0.25)' },
  { bg: 'rgba(101,163,13,0.1)', text: '#65a30d', border: 'rgba(101,163,13,0.25)' },
]

export function getTagColor(tag) {
  if (TAG_COLORS[tag]) return TAG_COLORS[tag]
  // Deterministic fallback based on tag string hash
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length]
}

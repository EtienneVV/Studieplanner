export function taalCode(label: string): string {
  const taal = label.trim().toLowerCase()
  if (taal.includes('nederlands') || taal.includes('dutch')) return 'nl-NL'
  if (taal.includes('engels') || taal.includes('english')) return 'en-GB'
  if (taal.includes('frans') || taal.includes('french')) return 'fr-FR'
  if (taal.includes('duits') || taal.includes('german')) return 'de-DE'
  if (taal.includes('spaans') || taal.includes('spanish')) return 'es-ES'
  if (taal.includes('italiaans') || taal.includes('italian')) return 'it-IT'
  if (taal.includes('portugees') || taal.includes('portuguese')) return 'pt-PT'
  if (taal.includes('latijn') || taal.includes('latin')) return 'la'
  return 'en-GB'
}

export function spreekUit(tekst: string, label: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  const schoon = tekst.trim()
  if (!schoon) return
  window.speechSynthesis.cancel()
  const uitspraak = new SpeechSynthesisUtterance(schoon)
  uitspraak.lang = taalCode(label)
  uitspraak.rate = 0.9
  window.speechSynthesis.speak(uitspraak)
}
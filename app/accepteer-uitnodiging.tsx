'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// Haalt een uuid-token uit wat de gebruiker ook plakt: de volledige link,
// alleen het pad, of losstaand het token zelf. Zo hoeft niemand precies
// te weten welk deel van de URL "het token" is.
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

function haalTokenEruit(invoer: string): string | null {
  const match = invoer.trim().match(UUID_REGEX)
  return match ? match[0] : null
}

export default function AccepteerUitnodiging() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [waarde, setWaarde] = useState('')
  const [error, setError] = useState('')

  function ga() {
    const token = haalTokenEruit(waarde)
    if (!token) {
      setError('Kon geen geldige uitnodigingscode herkennen. Plak de volledige link die je hebt ontvangen.')
      return
    }
    router.push('/uitnodiging/' + token)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
      >
        Uitnodiging accepteren
      </button>
    )
  }

  return (
    <div className="w-full rounded-lg border p-4">
      <p className="text-sm font-medium">Uitnodiging accepteren</p>
      <p className="mt-1 text-xs text-gray-500">
        Plak hieronder de link die je hebt ontvangen.
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={waarde}
          onChange={(e) => { setWaarde(e.target.value); setError('') }}
          onKeyDown={(e) => { if (e.key === 'Enter') ga() }}
          placeholder="http://.../uitnodiging/xxxxxxxx-..."
          autoFocus
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={ga}
          disabled={!waarde.trim()}
          className="shrink-0 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Ga verder
        </button>
        <button
          onClick={() => { setOpen(false); setWaarde(''); setError('') }}
          className="shrink-0 rounded-lg border px-3 py-2 text-sm"
        >
          &times;
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
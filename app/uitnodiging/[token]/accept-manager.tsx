'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function AcceptManager({
  token,
  householdName,
}: {
  token: string
  householdName: string
}) {
  const router = useRouter()
  const [naam, setNaam] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [gelukt, setGelukt] = useState(false)

  async function accepteer() {
    if (!naam.trim()) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data, error: e1 } = await supabase.rpc('accept_household_invitation', {
      p_token: token,
      p_display_name: naam.trim(),
    })

    if (e1) {
      setError(e1.message)
      setBusy(false)
      return
    }

    setGelukt(true)
    setBusy(false)

    // Even wachten zodat de gebruiker de bevestiging kan lezen,
    // daarna door naar de homepage waar het nieuwe gezin nu zichtbaar is.
    setTimeout(() => {
      router.push('/')
      router.refresh()
    }, 1500)
  }

  if (gelukt) {
    return (
      <div className="mt-6 rounded-lg bg-green-50 p-4 text-center">
        <p className="font-medium text-green-800">Welkom bij {householdName}! &#10003;</p>
        <p className="mt-1 text-sm text-green-700">Je wordt doorgestuurd&hellip;</p>
      </div>
    )
  }

  return (
    <div className="mt-6 rounded-lg border p-4">
      <label className="text-sm text-gray-600">Hoe wil je genoemd worden?</label>
      <input
        value={naam}
        onChange={(e) => setNaam(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') accepteer() }}
        placeholder="Bijv. Zoe"
        autoFocus
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
      />

      <button
        onClick={accepteer}
        disabled={busy || !naam.trim()}
        className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? 'Bezig...' : 'Word lid van ' + householdName}
      </button>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  )
}
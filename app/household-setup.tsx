'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function HouseholdSetup() {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function create() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.rpc('create_household', {
      p_name: name,
      p_display_name: user.email?.split('@')[0] ?? 'Ouder',
    })

    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="mt-6 rounded-lg border p-4">
      <h2 className="font-medium">Nog geen gezin</h2>
      <p className="mt-1 text-sm text-gray-500">
        Maak er één aan. Daarna kun je je dochter uitnodigen.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Bijv. Thuis"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
        />
        <button
          onClick={create}
          disabled={busy || !name}
          className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Aanmaken
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  )
}
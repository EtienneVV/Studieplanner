'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Uitnodiging = {
  id: string
  token: string
  role: string
  created_at: string
  expires_at: string
  used_at: string | null
}

function statusVan(u: Uitnodiging): { tekst: string; kleur: string } {
  if (u.used_at) return { tekst: 'Geaccepteerd', kleur: 'text-green-700 bg-green-50' }
  if (new Date(u.expires_at) < new Date()) return { tekst: 'Verlopen', kleur: 'text-gray-500 bg-gray-100' }
  return { tekst: 'Open', kleur: 'text-blue-700 bg-blue-50' }
}

export default function UitnodigManager({
  householdId,
  initialUitnodigingen,
}: {
  householdId: string
  initialUitnodigingen: Uitnodiging[]
}) {
  const router = useRouter()
  const [rol, setRol] = useState<'STUDENT' | 'PARENT'>('STUDENT')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [nieuweLink, setNieuweLink] = useState('')
  const [gekopieerd, setGekopieerd] = useState(false)

  async function maakUitnodiging() {
    setBusy(true)
    setError('')
    setNieuweLink('')
    setGekopieerd(false)
    const supabase = createClient()

    const { data: token, error: e1 } = await supabase.rpc('create_household_invitation', {
      p_household_id: householdId,
      p_role: rol,
    })

    if (e1 || !token) {
      setError(e1?.message ?? 'Kon geen uitnodiging aanmaken')
      setBusy(false)
      return
    }

    const link = window.location.origin + '/uitnodiging/' + token
    setNieuweLink(link)
    router.refresh()
    setBusy(false)
  }

  async function kopieer(link: string) {
    await navigator.clipboard.writeText(link)
    setGekopieerd(true)
    setTimeout(() => setGekopieerd(false), 2000)
  }

  async function trekIn(id: string) {
    if (!confirm('Deze uitnodiging intrekken?')) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('household_invitations').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Nieuwe uitnodiging</p>
        <select
          value={rol}
          onChange={(e) => setRol(e.target.value as 'STUDENT' | 'PARENT')}
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        >
          <option value="STUDENT">Als leerling (kind)</option>
          <option value="PARENT">Als ouder</option>
        </select>

        <button
          onClick={maakUitnodiging}
          disabled={busy}
          className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Bezig...' : 'Uitnodigingslink aanmaken'}
        </button>

        {nieuweLink && (
          <div className="mt-3 rounded-lg bg-green-50 p-3">
            <p className="text-xs text-green-800">Deel deze link (7 dagen geldig):</p>
            <div className="mt-1 flex gap-2">
              <input
                readOnly
                value={nieuweLink}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="flex-1 rounded border border-green-300 bg-white px-2 py-1 text-xs"
              />
              <button
                onClick={() => kopieer(nieuweLink)}
                className="shrink-0 rounded bg-green-700 px-3 py-1 text-xs text-white"
              >
                {gekopieerd ? 'Gekopieerd!' : 'Kopieer'}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-6">
        <h2 className="font-medium">Verstuurde uitnodigingen</h2>
        {initialUitnodigingen.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Nog geen uitnodigingen aangemaakt.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {initialUitnodigingen.map((u) => {
              const s = statusVan(u)
              const link = typeof window !== 'undefined'
                ? window.location.origin + '/uitnodiging/' + u.token
                : ''
              return (
                <li key={u.id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {u.role === 'PARENT' ? 'Als ouder' : 'Als leerling'}
                    </p>
                    <span className={'inline-block rounded px-2 py-0.5 text-xs ' + s.kleur}>
                      {s.tekst}
                    </span>
                  </div>
                  {s.tekst === 'Open' && (
                    <>
                      <button
                        onClick={() => kopieer(link)}
                        className="text-sm text-gray-500 underline"
                      >
                        Kopieer link
                      </button>
                      <button
                        onClick={() => trekIn(u.id)}
                        disabled={busy}
                        className="text-sm text-gray-500 underline disabled:opacity-50"
                      >
                        Intrekken
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
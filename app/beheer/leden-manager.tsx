'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Lid = {
  user_id: string
  role: string
  status: string
  display_name: string
  isJezelf: boolean
}

export default function LedenManager({
  householdId,
  initialLeden,
}: {
  householdId: string
  initialLeden: Lid[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function verwijder(lid: Lid) {
    const vraag = lid.isJezelf
      ? 'Weet je zeker dat je jezelf uit dit gezin wilt verwijderen?'
      : lid.display_name + ' uit het gezin verwijderen? Dit kan niet ongedaan worden gemaakt.'

    if (!confirm(vraag)) return

    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error: e1 } = await supabase.rpc('remove_household_member', {
      p_household_id: householdId,
      p_user_id_to_remove: lid.user_id,
    })

    if (e1) {
      setError(e1.message)
      setBusy(false)
      return
    }

    if (lid.isJezelf) {
      router.push('/')
      router.refresh()
      return
    }

    router.refresh()
    setBusy(false)
  }

  return (
    <div className="mt-6">
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <ul className="space-y-2">
        {initialLeden.map((lid) => (
          <li key={lid.user_id} className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <div className="flex-1">
              <p className="font-medium">
                {lid.display_name}
                {lid.isJezelf && <span className="ml-1 text-xs text-gray-400">(jij)</span>}
              </p>
              <p className="text-xs text-gray-500">
                {lid.role === 'PARENT' ? 'Ouder' : 'Leerling'}
                {lid.status !== 'ACTIVE' && (
                  <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-gray-500">
                    {lid.status}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => verwijder(lid)}
              disabled={busy}
              className="text-sm text-gray-500 underline hover:text-red-600 disabled:opacity-50"
            >
              Verwijderen
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-gray-400">
        Let op: je kunt de laatste ouder van het gezin niet verwijderen. Nodig eerst
        een andere ouder uit als je jezelf wilt verwijderen.
      </p>
    </div>
  )
}
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Subject = {
  id: string
  name: string
  color: string
  active: boolean
}

const KLEUREN = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
]

export default function SubjectManager({
  householdId,
  initialSubjects,
}: {
  householdId: string
  initialSubjects: Subject[]
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(KLEUREN[5])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function add() {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: studentId, error: e1 } = await supabase.rpc('ensure_student', {
      p_household_id: householdId,
      p_name: 'Leerling',
    })

    if (e1 || !studentId) {
      setError(e1?.message ?? 'Leerling aanmaken mislukt')
      setBusy(false)
      return
    }

    const { error: e2 } = await supabase.from('subjects').insert({
      household_id: householdId,
      student_id: studentId,
      name: name.trim(),
      color,
    })

    if (e2) setError(e2.message)
    else {
      setName('')
      router.refresh()
    }
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder="Bijv. Duits"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
          <button
            onClick={add}
            disabled={busy || !name.trim()}
            className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            Toevoegen
          </button>
        </div>

        <div className="mt-3 flex gap-2">
          {KLEUREN.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={"Kleur " + c}
              style={{ backgroundColor: c }}
              className={
                'h-7 w-7 rounded-full ' +
                (color === c ? 'ring-2 ring-black ring-offset-2' : '')
              }
            />
          ))}
        </div>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <ul className="mt-4 space-y-2">
        {initialSubjects.length === 0 && (
          <li className="text-sm text-gray-500">Nog geen vakken toegevoegd.</li>
        )}
        {initialSubjects.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
            <span
              style={{ backgroundColor: s.color }}
              className="h-4 w-4 shrink-0 rounded-full"
            />
            <span className="flex-1 font-medium">{s.name}</span>
            <button
              onClick={() => remove(s.id)}
              disabled={busy}
              className="text-sm text-gray-500 underline disabled:opacity-50"
            >
              Verwijderen
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

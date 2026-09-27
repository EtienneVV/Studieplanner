'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Lid = { user_id: string; role: string; display_name: string }
type Module = {
  id: string
  title: string
  owner_user_id: string
  owner_naam: string
  side_1_label: string
  side_2_label: string
  created_at: string
}

export default function ModuleManager({
  householdId,
  currentUserId,
  isParent,
  leden,
  initialModules,
}: {
  householdId: string
  currentUserId: string
  isParent: boolean
  leden: Lid[]
  initialModules: Module[]
}) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [taal1, setTaal1] = useState('')
  const [taal2, setTaal2] = useState('')
  const [voorWie, setVoorWie] = useState(currentUserId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [bewerkTitel, setBewerkTitel] = useState('')

  async function add() {
    if (!title.trim() || !taal1.trim() || !taal2.trim()) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('training_modules').insert({
      household_id: householdId,
      owner_user_id: isParent ? voorWie : currentUserId,
      title: title.trim(),
      side_1_label: taal1.trim(),
      side_2_label: taal2.trim(),
    })

    if (error) setError(error.message)
    else {
      setTitle('')
      setTaal1('')
      setTaal2('')
      router.refresh()
    }
    setBusy(false)
  }

  async function bewaarNaam(id: string) {
    if (!bewerkTitel.trim()) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('training_modules')
      .update({ title: bewerkTitel.trim() })
      .eq('id', id)
    if (error) setError(error.message)
    else {
      setBewerkId(null)
      router.refresh()
    }
    setBusy(false)
  }

  async function remove(id: string) {
    if (!confirm('Deze module en alle kaartjes erin verwijderen?')) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('training_modules').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  const mijnModules = initialModules.filter((m) => m.owner_user_id === currentUserId)
  const anderenIds = Array.from(
    new Set(
      initialModules
        .filter((m) => m.owner_user_id !== currentUserId)
        .map((m) => m.owner_user_id)
    )
  )

  function ModuleRij({ m }: { m: Module }) {
    if (bewerkId === m.id) {
      return (
        <li className="flex items-center gap-2 rounded-lg border px-4 py-3">
          <input
            value={bewerkTitel}
            onChange={(e) => setBewerkTitel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') bewaarNaam(m.id) }}
            autoFocus
            className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button
            onClick={() => bewaarNaam(m.id)}
            disabled={busy}
            className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            Opslaan
          </button>
          <button
            onClick={() => setBewerkId(null)}
            className="rounded border px-3 py-1 text-xs"
          >
            Annuleren
          </button>
        </li>
      )
    }

    return (
      <li className="flex items-center gap-3 rounded-lg border px-4 py-3">
        <div className="flex-1">
          <Link href={'/training/' + m.id} className="font-medium hover:underline">
            {m.title}
          </Link>
          <p className="text-xs text-gray-500">
            {m.side_1_label} &rarr; {m.side_2_label}
          </p>
        </div>
        <button
          onClick={() => { setBewerkId(m.id); setBewerkTitel(m.title) }}
          disabled={busy}
          title="Hernoemen"
          className="text-sm text-gray-500 hover:text-black disabled:opacity-40"
        >
          &#9998;
        </button>
        <button
          onClick={() => remove(m.id)}
          disabled={busy}
          className="text-sm text-gray-500 underline disabled:opacity-50"
        >
          Verwijderen
        </button>
      </li>
    )
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijv. Engelse woordjes 1"
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />

        <div className="mt-3 flex gap-2">
          <input
            value={taal1}
            onChange={(e) => setTaal1(e.target.value)}
            placeholder="Taal 1, bijv. Engels"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            value={taal2}
            onChange={(e) => setTaal2(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder="Taal 2, bijv. Nederlands"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        {isParent && leden.length > 1 && (
          <select
            value={voorWie}
            onChange={(e) => setVoorWie(e.target.value)}
            className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            {leden.map((l) => (
              <option key={l.user_id} value={l.user_id}>
                Voor: {l.user_id === currentUserId ? 'Mezelf' : l.display_name}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={add}
          disabled={busy || !title.trim() || !taal1.trim() || !taal2.trim()}
          className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Module aanmaken
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-6">
        <h2 className="font-medium">Mijn modules</h2>
        <ul className="mt-2 space-y-2">
          {mijnModules.length === 0 && (
            <li className="text-sm text-gray-500">Nog geen modules aangemaakt.</li>
          )}
          {mijnModules.map((m) => <ModuleRij key={m.id} m={m} />)}
        </ul>
      </div>

      {anderenIds.map((ownerId) => {
        const modulesVanDeze = initialModules.filter((m) => m.owner_user_id === ownerId)
        const naam = modulesVanDeze[0]?.owner_naam ?? 'Onbekend'
        return (
          <div key={ownerId} className="mt-6">
            <h2 className="font-medium">Modules van {naam}</h2>
            <ul className="mt-2 space-y-2">
              {modulesVanDeze.map((m) => <ModuleRij key={m.id} m={m} />)}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
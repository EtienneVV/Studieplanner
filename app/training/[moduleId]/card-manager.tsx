'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Card = {
  id: string
  side_1_text: string
  side_2_text: string
  created_at: string
}

export default function CardManager({
  moduleId,
  side1Label,
  side2Label,
  initialCards,
}: {
  moduleId: string
  side1Label: string
  side2Label: string
  initialCards: Card[]
}) {
  const router = useRouter()
  const [zijde1, setZijde1] = useState('')
  const [zijde2, setZijde2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [bewerkZijde1, setBewerkZijde1] = useState('')
  const [bewerkZijde2, setBewerkZijde2] = useState('')

  async function add() {
    if (!zijde1.trim() || !zijde2.trim()) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('training_cards').insert({
      module_id: moduleId,
      side_1_text: zijde1.trim(),
      side_2_text: zijde2.trim(),
    })

    if (error) setError(error.message)
    else {
      setZijde1('')
      setZijde2('')
      router.refresh()
    }
    setBusy(false)
  }

  function beginBewerken(c: Card) {
    setBewerkId(c.id)
    setBewerkZijde1(c.side_1_text)
    setBewerkZijde2(c.side_2_text)
  }

  async function bewaarBewerking(id: string) {
    if (!bewerkZijde1.trim() || !bewerkZijde2.trim()) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase
      .from('training_cards')
      .update({
        side_1_text: bewerkZijde1.trim(),
        side_2_text: bewerkZijde2.trim(),
      })
      .eq('id', id)
    if (error) setError(error.message)
    else {
      setBewerkId(null)
      router.refresh()
    }
    setBusy(false)
  }

  async function remove(id: string) {
    if (!confirm('Dit kaartje verwijderen?')) return
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('training_cards').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Nieuw kaartje</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={zijde1}
            onChange={(e) => setZijde1(e.target.value)}
            placeholder={side1Label}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            value={zijde2}
            onChange={(e) => setZijde2(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add() }}
            placeholder={side2Label}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
        <button
          onClick={add}
          disabled={busy || !zijde1.trim() || !zijde2.trim()}
          className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Kaartje toevoegen
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-4">
        <div className="mb-1 flex px-1 text-xs font-medium text-gray-400">
          <span className="flex-1">{side1Label}</span>
          <span className="flex-1">{side2Label}</span>
        </div>

        {initialCards.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-sm text-gray-500">
            Nog geen kaartjes. Voeg er hierboven eentje toe.
          </p>
        ) : (
          <ul className="space-y-2">
            {initialCards.map((c) => (
              <li key={c.id} className="rounded-lg border p-3">
                {bewerkId === c.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <input
                      value={bewerkZijde1}
                      onChange={(e) => setBewerkZijde1(e.target.value)}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <input
                      value={bewerkZijde2}
                      onChange={(e) => setBewerkZijde2(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') bewaarBewerking(c.id) }}
                      className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => bewaarBewerking(c.id)}
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
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="flex-1">{c.side_1_text}</span>
                    <span className="flex-1">{c.side_2_text}</span>
                    <button
                      onClick={() => beginBewerken(c)}
                      disabled={busy}
                      title="Bewerken"
                      className="text-sm text-gray-500 hover:text-black disabled:opacity-40"
                    >
                      &#9998;
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      disabled={busy}
                      className="text-sm text-gray-500 underline disabled:opacity-50"
                    >
                      Verwijderen
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
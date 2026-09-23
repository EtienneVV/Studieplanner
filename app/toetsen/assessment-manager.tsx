'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Subject = { id: string; name: string; color: string }
type Assessment = {
  id: string
  title: string
  date: string | null
  weight: number | null
  syllabus: string | null
  date_confidence: string
  subject_id: string
}

function hexToRgba(hex: string, alpha: number) {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')'
}

function dagenTot(datum: string | null): number | null {
  if (!datum) return null
  const vandaag = new Date()
  vandaag.setHours(0, 0, 0, 0)
  const doel = new Date(datum + 'T00:00:00')
  return Math.round((doel.getTime() - vandaag.getTime()) / 86400000)
}

function formatDatum(datum: string): string {
  const d = new Date(datum + 'T00:00:00')
  const dagen = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
  const maanden = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun',
    'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
  return dagen[d.getDay()] + ' ' + d.getDate() + ' ' + maanden[d.getMonth()]
}

function teltekst(n: number | null): string {
  if (n === null) return 'Geen datum'
  if (n < 0) return 'Geweest'
  if (n === 0) return 'Vandaag'
  if (n === 1) return 'Morgen'
  return 'Over ' + n + ' dagen'
}

export default function AssessmentManager({
  householdId,
  subjects,
  initialAssessments,
}: {
  householdId: string
  subjects: Subject[]
  initialAssessments: Assessment[]
}) {
  const router = useRouter()
  const [lijst, setLijst] = useState<Assessment[]>(initialAssessments)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [datum, setDatum] = useState('')
  const [weight, setWeight] = useState('')
  const [syllabus, setSyllabus] = useState('')
  const [onzeker, setOnzeker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toonGeweest, setToonGeweest] = useState(false)

  useEffect(() => {
    setLijst(initialAssessments)
  }, [initialAssessments])

  const subjectOf = (id: string) => subjects.find((s) => s.id === id)

  async function voegToe() {
    if (!title.trim() || !subjectId) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('assessments').insert({
      household_id: householdId,
      subject_id: subjectId,
      title: title.trim(),
      date: datum || null,
      weight: weight ? Number(weight) : null,
      syllabus: syllabus.trim() || null,
      date_confidence: onzeker ? 'ESTIMATED' : 'CONFIRMED',
    })

    if (error) setError(error.message)
    else {
      setTitle('')
      setDatum('')
      setWeight('')
      setSyllabus('')
      setOnzeker(false)
      router.refresh()
    }
    setBusy(false)
  }

  async function wijzigDatum(id: string, nieuw: string) {
    setLijst((prev) =>
      prev.map((a) => (a.id === id ? { ...a, date: nieuw || null } : a)))
    const supabase = createClient()
    const { error } = await supabase
      .from('assessments')
      .update({ date: nieuw || null })
      .eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  async function bevestigDatum(id: string) {
    setLijst((prev) =>
      prev.map((a) => (a.id === id ? { ...a, date_confidence: 'CONFIRMED' } : a)))
    const supabase = createClient()
    const { error } = await supabase
      .from('assessments')
      .update({ date_confidence: 'CONFIRMED' })
      .eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  async function verwijder(id: string) {
    setLijst((prev) => prev.filter((a) => a.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('assessments').delete().eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  const komend = lijst.filter((a) => {
    const d = dagenTot(a.date)
    return d === null || d >= 0
  })
  const geweest = lijst.filter((a) => {
    const d = dagenTot(a.date)
    return d !== null && d < 0
  })

  function Kaart({ a }: { a: Assessment }) {
    const s = subjectOf(a.subject_id)
    const kleur = s?.color ?? '#94a3b8'
    const d = dagenTot(a.date)
    const dichtbij = d !== null && d >= 0 && d <= 7
    const schatting = a.date_confidence === 'ESTIMATED'

    return (
      <li
        style={{
          backgroundColor: hexToRgba(kleur, 0.12),
          borderLeft: '4px solid ' + kleur,
        }}
        className="rounded-lg border p-3"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{a.title}</p>
            <p className="text-xs opacity-70">
              {s?.name}
              {a.weight ? ' \u00b7 weging ' + a.weight : ''}
            </p>
            {a.syllabus && (
              <p className="mt-1 text-sm opacity-80">{a.syllabus}</p>
            )}
          </div>

          <div className="shrink-0 text-right">
            <p className={'text-sm font-medium ' + (dichtbij ? 'text-red-700' : '')}>
              {teltekst(d)}
            </p>
            {a.date && (
              <p className="text-xs opacity-60">{formatDatum(a.date)}</p>
            )}
          </div>
        </div>

        {schatting && (
          <p className="mt-2 inline-block rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
            Datum nog onzeker
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={a.date ?? ''}
            onChange={(e) => wijzigDatum(a.id, e.target.value)}
            className="rounded border-0 bg-white/60 px-2 py-1 text-xs"
          />
          {schatting && (
            <button
              type="button"
              onClick={() => bevestigDatum(a.id)}
              disabled={busy}
              className="rounded bg-white/60 px-2 py-1 text-xs hover:bg-white"
            >
              Datum bevestigen
            </button>
          )}
          <button
            type="button"
            onClick={() => verwijder(a.id)}
            disabled={busy}
            className="rounded bg-white/60 px-2 py-1 text-xs hover:bg-white hover:text-red-600"
          >
            Verwijderen
          </button>
        </div>
      </li>
    )
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Bijv. Toets hoofdstuk 2"
          className="w-full rounded-lg border border-gray-300 px-3 py-2"
        />

        <div className="mt-3 flex gap-2">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="number"
            step="0.5"
            min="0"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Weging"
            className="w-28 rounded-lg border border-gray-300 px-3 py-2"
          />
          <input
            value={syllabus}
            onChange={(e) => setSyllabus(e.target.value)}
            placeholder="Stof, bijv. H2 en woordenlijst B"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={onzeker}
            onChange={(e) => setOnzeker(e.target.checked)}
            className="h-4 w-4"
          />
          Datum is nog een schatting
        </label>

        <button
          type="button"
          onClick={voegToe}
          disabled={busy || !title.trim()}
          className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Toets toevoegen
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {komend.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nog geen toetsen toegevoegd.</p>
      ) : (
        <ul className="mt-6 space-y-2">
          {komend.map((a) => <Kaart key={a.id} a={a} />)}
        </ul>
      )}

      {geweest.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setToonGeweest(!toonGeweest)}
            className="text-sm text-gray-500 underline"
          >
            {toonGeweest ? 'Verberg' : 'Toon'} geweest ({geweest.length})
          </button>
          {toonGeweest && (
            <ul className="mt-3 space-y-2 opacity-60">
              {geweest.map((a) => <Kaart key={a.id} a={a} />)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

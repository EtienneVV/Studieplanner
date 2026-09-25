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
type AssessmentDraft = {
  title: string
  subject_id: string
  date: string
  weight: string
  syllabus: string
  date_confidence: string
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
  const [bewerkenId, setBewerkenId] = useState<string | null>(null)
  const [bewerkDraft, setBewerkDraft] = useState<AssessmentDraft | null>(null)
  const [bewerkFout, setBewerkFout] = useState('')

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

  function startBewerken(a: Assessment) {
    setBewerkenId(a.id)
    setBewerkDraft({
      title: a.title,
      subject_id: a.subject_id,
      date: a.date ?? '',
      weight: a.weight?.toString() ?? '',
      syllabus: a.syllabus ?? '',
      date_confidence: a.date_confidence,
    })
    setError('')
    setBewerkFout('')
  }

  function annuleerBewerken() {
    setBewerkenId(null)
    setBewerkDraft(null)
    setBewerkFout('')
  }

  async function slaBewerkingOp(id: string) {
    if (!bewerkDraft?.title.trim() || !bewerkDraft.subject_id) {
      setBewerkFout('Vul een naam in en kies een vak.')
      return
    }

    setBusy(true)
    setBewerkFout('')
    const supabase = createClient()
    const bijgewerkt = {
      title: bewerkDraft.title.trim(),
      subject_id: bewerkDraft.subject_id,
      date: bewerkDraft.date || null,
      weight: bewerkDraft.weight ? Number(bewerkDraft.weight) : null,
      syllabus: bewerkDraft.syllabus.trim() || null,
      date_confidence: bewerkDraft.date_confidence,
    }
    const { error } = await supabase
      .from('assessments')
      .update(bijgewerkt)
      .eq('id', id)

    if (error) {
      setBewerkFout(error.message)
    } else {
      setLijst((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...bijgewerkt } : a)))
      annuleerBewerken()
      router.refresh()
    }
    setBusy(false)
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
    const isEditing = bewerkenId === a.id

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
          {!isEditing && (
            <>
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
            </>
          )}
          <button
            type="button"
            onClick={() => isEditing ? annuleerBewerken() : startBewerken(a)}
            disabled={busy}
            className="rounded bg-white/60 px-2 py-1 text-xs hover:bg-white"
          >
            {isEditing ? 'Annuleren' : 'Bewerken'}
          </button>
          <button
            type="button"
            onClick={() => verwijder(a.id)}
            disabled={busy}
            className="rounded bg-white/60 px-2 py-1 text-xs hover:bg-white hover:text-red-600"
          >
            Verwijderen
          </button>
        </div>

        {isEditing && bewerkDraft && (
          <div className="mt-3 space-y-2 rounded-lg bg-white/60 p-3">
            <label className="block text-xs text-gray-600">
              Naam
              <input
                value={bewerkDraft.title}
                onChange={(e) => setBewerkDraft({ ...bewerkDraft, title: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="block text-xs text-gray-600">
              Vak
              <select
                value={bewerkDraft.subject_id}
                onChange={(e) => setBewerkDraft({ ...bewerkDraft, subject_id: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2 text-sm text-gray-900"
              >
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.name}</option>
                ))}
              </select>
            </label>
            <div className="flex gap-2">
              <label className="flex-1 text-xs text-gray-600">
                Datum
                <input
                  type="date"
                  value={bewerkDraft.date}
                  onChange={(e) => setBewerkDraft({ ...bewerkDraft, date: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="w-28 text-xs text-gray-600">
                Weging
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={bewerkDraft.weight}
                  onChange={(e) => setBewerkDraft({ ...bewerkDraft, weight: e.target.value })}
                  className="mt-1 w-full rounded border px-3 py-2 text-sm text-gray-900"
                />
              </label>
            </div>
            <label className="block text-xs text-gray-600">
              Stof / opmerkingen
              <textarea
                value={bewerkDraft.syllabus}
                onChange={(e) => setBewerkDraft({ ...bewerkDraft, syllabus: e.target.value })}
                rows={2}
                className="mt-1 w-full rounded border px-3 py-2 text-sm text-gray-900"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input
                type="checkbox"
                checked={bewerkDraft.date_confidence === 'ESTIMATED'}
                onChange={(e) =>
                  setBewerkDraft({
                    ...bewerkDraft,
                    date_confidence: e.target.checked ? 'ESTIMATED' : 'CONFIRMED',
                  })}
                className="h-4 w-4"
              />
              Datum is nog een schatting
            </label>
            {bewerkFout && <p className="text-sm text-red-600">{bewerkFout}</p>}
            <button
              type="button"
              onClick={() => slaBewerkingOp(a.id)}
              disabled={busy || !bewerkDraft.title.trim()}
              className="w-full rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </button>
          </div>
        )}
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
            placeholder="Stof of opmerkingen, bijv. H2 en woordenlijst B"
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

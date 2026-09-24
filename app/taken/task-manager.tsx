'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Subject = { id: string; name: string; color: string }
type Assessment = {
  id: string
  title: string
  date: string | null
  subject_id: string
  date_confidence: string
}
type Task = {
  id: string
  title: string
  notes: string | null
  task_type: string
  subject_id: string
  assessment_id: string | null
}

const TYPES = [
  { value: 'HOMEWORK', label: 'Huiswerk' },
  { value: 'TEST_PREPARATION', label: 'Toetsvoorbereiding' },
  { value: 'REPETITION', label: 'Herhaling' },
]

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

function teltekst(n: number | null): string {
  if (n === null) return 'geen datum'
  if (n < 0) return 'geweest'
  if (n === 0) return 'vandaag'
  if (n === 1) return 'morgen'
  return 'over ' + n + ' dagen'
}

export default function TaskManager({
  householdId,
  subjects,
  initialTasks,
  assessments,
}: {
  householdId: string
  subjects: Subject[]
  initialTasks: Task[]
  assessments: Assessment[]
}) {
  const router = useRouter()
  const [lijst, setLijst] = useState<Task[]>(initialTasks)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [taskType, setTaskType] = useState('HOMEWORK')
  const [assessmentId, setAssessmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLijst(initialTasks)
  }, [initialTasks])

  const subjectOf = (id: string) => subjects.find((s) => s.id === id)
  const assessmentOf = (id: string | null) =>
    id ? assessments.find((a) => a.id === id) : undefined

  // Alleen toetsen van het gekozen vak die nog niet geweest zijn
  const beschikbaar = assessments.filter((a) => {
    if (a.subject_id !== subjectId) return false
    const d = dagenTot(a.date)
    return d === null || d >= 0
  })

  useEffect(() => {
    setAssessmentId('')
  }, [subjectId])

  async function add() {
    if (!title.trim() || !subjectId) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('tasks').insert({
      household_id: householdId,
      subject_id: subjectId,
      assessment_id: assessmentId || null,
      title: title.trim(),
      notes: notes.trim() || null,
      task_type: taskType,
    })

    if (error) setError(error.message)
    else {
      setTitle('')
      setNotes('')
      setAssessmentId('')
      router.refresh()
    }
    setBusy(false)
  }

  async function koppel(taskId: string, aId: string) {
    setLijst((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, assessment_id: aId || null } : t)))
    const supabase = createClient()
    const { error } = await supabase
      .from('tasks')
      .update({ assessment_id: aId || null })
      .eq('id', taskId)
    if (error) setError(error.message)
    router.refresh()
  }

  async function remove(id: string) {
    setLijst((prev) => prev.filter((t) => t.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  const bySubject = subjects
    .map((s) => ({
      subject: s,
      tasks: lijst.filter((t) => t.subject_id === s.id),
    }))
    .filter((g) => g.tasks.length > 0)

  function TaakKaart({ t, kleur }: { t: Task; kleur: string }) {
    const a = assessmentOf(t.assessment_id)
    const d = a ? dagenTot(a.date) : null
    const dichtbij = d !== null && d >= 0 && d <= 7

    const vakToetsen = assessments.filter((x) => {
      if (x.subject_id !== t.subject_id) return false
      const n = dagenTot(x.date)
      return n === null || n >= 0 || x.id === t.assessment_id
    })

    return (
      <li
        style={{
          backgroundColor: hexToRgba(kleur, 0.1),
          borderLeft: '4px solid ' + kleur,
        }}
        className="rounded-lg border p-3"
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-medium leading-tight">{t.title}</p>
            {t.notes && (
              <p className="mt-0.5 text-sm opacity-75">{t.notes}</p>
            )}
            <p className="mt-1 text-xs opacity-60">
              {TYPES.find((x) => x.value === t.task_type)?.label ?? t.task_type}
            </p>
          </div>
          <button
            type="button"
            onClick={() => remove(t.id)}
            disabled={busy}
            className="rounded bg-white/60 px-2 py-1 text-xs hover:bg-white hover:text-red-600"
          >
            Verwijderen
          </button>
        </div>

        {a && (
          <p className={'mt-2 text-sm ' + (dichtbij ? 'font-medium text-red-700' : 'opacity-80')}>
            &#128221; {a.title} &middot; {teltekst(d)}
            {a.date_confidence === 'ESTIMATED' && (
              <span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-900">
                datum onzeker
              </span>
            )}
          </p>
        )}

        <select
          value={t.assessment_id ?? ''}
          onChange={(e) => koppel(t.id, e.target.value)}
          className="mt-2 w-full rounded border-0 bg-white/60 px-2 py-1 text-xs"
        >
          <option value="">Geen toets gekoppeld</option>
          {vakToetsen.map((x) => (
            <option key={x.id} value={x.id}>
              {x.title}
              {x.date ? ' (' + teltekst(dagenTot(x.date)) + ')' : ''}
            </option>
          ))}
        </select>
      </li>
    )
  }

  return (
    <div className="mt-6">
      <div className="rounded-lg border p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder="Bijv. Wiederholung 1"
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

          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <select
          value={assessmentId}
          onChange={(e) => setAssessmentId(e.target.value)}
          disabled={beschikbaar.length === 0}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-50 disabled:text-gray-400"
        >
          <option value="">
            {beschikbaar.length === 0
              ? 'Geen toetsen voor dit vak'
              : 'Geen toets gekoppeld'}
          </option>
          {beschikbaar.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
              {a.date ? ' (' + teltekst(dagenTot(a.date)) + ')' : ''}
            </option>
          ))}
        </select>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notitie, bijv. Lernliste B en grammatik"
          rows={2}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2"
        />

        <button
          type="button"
          onClick={add}
          disabled={busy || !title.trim()}
          className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Taak toevoegen
        </button>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {bySubject.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Nog geen taken toegevoegd.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {bySubject.map(({ subject, tasks }) => (
            <div key={subject.id}>
              <div className="flex items-center gap-2">
                <span
                  style={{ backgroundColor: subject.color }}
                  className="h-3 w-3 rounded-full"
                />
                <h2 className="font-medium">{subject.name}</h2>
                <span className="text-sm text-gray-400">{tasks.length}</span>
              </div>

              <ul className="mt-2 space-y-2">
                {tasks.map((t) => (
                  <TaakKaart key={t.id} t={t} kleur={subject.color} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

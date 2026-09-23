'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

type Subject = { id: string; name: string; color: string }
type Task = {
  id: string
  title: string
  notes: string | null
  task_type: string
  subject_id: string
}

const TYPES = [
  { value: 'HOMEWORK', label: 'Huiswerk' },
  { value: 'TEST_PREPARATION', label: 'Toetsvoorbereiding' },
  { value: 'REPETITION', label: 'Herhaling' },
  { value: 'REFLECTION', label: 'Reflectie' },
]

export default function TaskManager({
  householdId,
  subjects,
  initialTasks,
}: {
  householdId: string
  subjects: Subject[]
  initialTasks: Task[]
}) {
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? '')
  const [taskType, setTaskType] = useState('HOMEWORK')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function add() {
    if (!title.trim() || !subjectId) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('tasks').insert({
      household_id: householdId,
      subject_id: subjectId,
      title: title.trim(),
      notes: notes.trim() || null,
      task_type: taskType,
    })

    if (error) setError(error.message)
    else {
      setTitle('')
      setNotes('')
      router.refresh()
    }
    setBusy(false)
  }

  async function remove(id: string) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  const bySubject = subjects
    .map((s) => ({
      subject: s,
      tasks: initialTasks.filter((t) => t.subject_id === s.id),
    }))
    .filter((g) => g.tasks.length > 0)

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

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notitie, bijv. Lernliste B en grammatik"
          rows={2}
          className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2"
        />

        <button
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
                  <li key={t.id} className="rounded-lg border px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{t.title}</p>
                        {t.notes && (
                          <p className="mt-0.5 text-sm text-gray-500">{t.notes}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-400">
                          {TYPES.find((x) => x.value === t.task_type)?.label ?? t.task_type}
                        </p>
                      </div>
                      <button
                        onClick={() => remove(t.id)}
                        disabled={busy}
                        className="text-sm text-gray-500 underline disabled:opacity-50"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

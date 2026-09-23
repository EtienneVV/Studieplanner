'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import {
  isoWeek, mondayOf, addDays, toISODate, DAGEN, formatDag,
} from './week-utils'

type Subject = { id: string; name: string; color: string }
type Task = { id: string; title: string; subject_id: string; task_type: string }
type Block = {
  id: string
  task_id: string
  planned_date: string | null
  duration_minutes: number
  status: string
  position_key: number
}

const STATUS = [
  { value: 'TODO', label: 'Te doen', dot: 'bg-gray-300' },
  { value: 'DOING', label: 'Bezig', dot: 'bg-amber-400' },
  { value: 'DONE', label: 'Klaar', dot: 'bg-green-500' },
  { value: 'MASTERED', label: 'Beheerst', dot: 'bg-emerald-700' },
  { value: 'SKIPPED', label: 'Vervallen', dot: 'bg-gray-200' },
]

export default function WeekBoard({
  householdId,
  studentId,
  mondayISO,
  subjects,
  tasks,
  blocks,
}: {
  householdId: string
  studentId: string | null
  mondayISO: string
  subjects: Subject[]
  tasks: Task[]
  blocks: Block[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [addDate, setAddDate] = useState<string | null>(null)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [duration, setDuration] = useState(30)

  const monday = new Date(mondayISO + 'T00:00:00')
  const dagen = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const week = isoWeek(monday)
  const vandaag = toISODate(new Date())

  const subjectOf = (t: Task) => subjects.find((s) => s.id === t.subject_id)
  const taskOf = (b: Block) => tasks.find((t) => t.id === b.task_id)

  function ga(offset: number) {
    const nieuw = addDays(monday, offset * 7)
    router.push('/week?start=' + toISODate(nieuw))
  }

  async function voegToe(datum: string | null) {
    if (!taskId || !studentId) {
      setError('Maak eerst een taak aan via Taken.')
      return
    }
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.from('study_blocks').insert({
      household_id: householdId,
      student_id: studentId,
      task_id: taskId,
      planned_date: datum,
      duration_minutes: duration,
      position_key: Date.now() % 1000000,
    })

    if (error) setError(error.message)
    else {
      setAddDate(null)
      router.refresh()
    }
    setBusy(false)
  }

  async function verplaats(id: string, datum: string | null) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('study_blocks')
      .update({ planned_date: datum, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  async function zetStatus(id: string, status: string) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('study_blocks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  async function verwijder(id: string) {
    setBusy(true)
    const supabase = createClient()
    const { error } = await supabase.from('study_blocks').delete().eq('id', id)
    if (error) setError(error.message)
    else router.refresh()
    setBusy(false)
  }

  function BlokKaart({ b }: { b: Block }) {
    const t = taskOf(b)
    const s = t ? subjectOf(t) : undefined
    const st = STATUS.find((x) => x.value === b.status)

    return (
      <div className="rounded-lg border bg-white p-2 text-sm shadow-sm">
        <div className="flex items-start gap-1.5">
          <span
            style={{ backgroundColor: s?.color ?? '#999' }}
            className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">
              {t?.title ?? 'Onbekend'}
            </p>
            <p className="text-xs text-gray-400">
              {s?.name} · {b.duration_minutes} min
            </p>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1">
          <span className={'h-2 w-2 rounded-full ' + (st?.dot ?? 'bg-gray-300')} />
          <select
            value={b.status}
            onChange={(e) => zetStatus(b.id, e.target.value)}
            disabled={busy}
            className="flex-1 rounded border-0 bg-transparent p-0 text-xs text-gray-600"
          >
            {STATUS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </select>
        </div>

        <div className="mt-1.5 flex items-center gap-2">
          <select
            value={b.planned_date ?? ''}
            onChange={(e) => verplaats(b.id, e.target.value || null)}
            disabled={busy}
            className="flex-1 rounded border border-gray-200 px-1 py-0.5 text-xs"
          >
            <option value="">Niet ingepland</option>
            {dagen.map((d, i) => (
              <option key={i} value={toISODate(d)}>
                {DAGEN[i].slice(0, 2)} {formatDag(d)}
              </option>
            ))}
          </select>
          <button
            onClick={() => verwijder(b.id)}
            disabled={busy}
            aria-label="Verwijderen"
            className="text-xs text-gray-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  function ToevoegForm({ datum }: { datum: string | null }) {
    return (
      <div className="rounded-lg border border-dashed p-2">
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="w-full rounded border border-gray-200 px-1 py-1 text-xs"
        >
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {subjectOf(t)?.name} — {t.title}
            </option>
          ))}
        </select>
        <div className="mt-1.5 flex gap-1">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="flex-1 rounded border border-gray-200 px-1 py-1 text-xs"
          >
            {[15, 20, 25, 30, 45, 60].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
          <button
            onClick={() => voegToe(datum)}
            disabled={busy}
            className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            OK
          </button>
          <button
            onClick={() => setAddDate(null)}
            className="rounded border px-2 py-1 text-xs"
          >
            ×
          </button>
        </div>
      </div>
    )
  }

  const nietIngepland = blocks.filter((b) => !b.planned_date)

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Week {week}</h1>
          <p className="text-sm text-gray-500">
            {formatDag(dagen[0])} t/m {formatDag(dagen[6])} {dagen[6].getFullYear()}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => ga(-1)} className="rounded-lg border px-3 py-1.5 text-sm">
            Vorige
          </button>
          <button
            onClick={() => router.push('/week?start=' + toISODate(mondayOf(new Date())))}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Deze week
          </button>
          <button onClick={() => ga(1)} className="rounded-lg border px-3 py-1.5 text-sm">
            Volgende
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {tasks.length === 0 && (
        <p className="mt-3 rounded-lg border p-3 text-sm text-gray-500">
          Nog geen taken. Maak ze eerst aan bij Taken.
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-gray-50 p-3 lg:row-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Niet ingepland</h2>
            <span className="text-xs text-gray-400">{nietIngepland.length}</span>
          </div>
          <div className="mt-2 space-y-2">
            {nietIngepland.map((b) => <BlokKaart key={b.id} b={b} />)}
            {addDate === 'NULL' ? (
              <ToevoegForm datum={null} />
            ) : (
              <button
                onClick={() => setAddDate('NULL')}
                disabled={tasks.length === 0}
                className="w-full rounded-lg border border-dashed py-1.5 text-xs text-gray-500 disabled:opacity-40"
              >
                + Blok
              </button>
            )}
          </div>
        </div>

        {dagen.map((d, i) => {
          const iso = toISODate(d)
          const dagBlokken = blocks.filter((b) => b.planned_date === iso)
          const isVandaag = iso === vandaag

          return (
            <div
              key={iso}
              className={
                'rounded-xl p-3 ' +
                (isVandaag ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50')
              }
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{DAGEN[i]}</h2>
                <span className="text-xs text-gray-400">{formatDag(d)}</span>
              </div>

              <div className="mt-2 space-y-2">
                {dagBlokken.map((b) => <BlokKaart key={b.id} b={b} />)}

                {addDate === iso ? (
                  <ToevoegForm datum={iso} />
                ) : (
                  <button
                    onClick={() => setAddDate(iso)}
                    disabled={tasks.length === 0}
                    className="w-full rounded-lg border border-dashed py-1.5 text-xs text-gray-500 disabled:opacity-40"
                  >
                    + Blok
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

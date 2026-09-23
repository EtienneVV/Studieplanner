'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, useDraggable, closestCorners,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
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
type Assessment = {
  id: string
  title: string
  date: string | null
  weight?: number | null
  syllabus?: string | null
  date_confidence: string
  subject_id: string
}

const STATUS = [
  { value: 'TODO', label: 'Te doen' },
  { value: 'DOING', label: 'Bezig' },
  { value: 'DONE', label: 'Klaar' },
  { value: 'MASTERED', label: 'Beheerst' },
  { value: 'SKIPPED', label: 'Vervallen' },
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

export default function WeekBoard({
  householdId,
  studentId,
  mondayISO,
  subjects,
  tasks,
  blocks,
  assessments,
  komende,
}: {
  householdId: string
  studentId: string | null
  mondayISO: string
  subjects: Subject[]
  tasks: Task[]
  blocks: Block[]
  assessments: Assessment[]
  komende: Assessment[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [addDate, setAddDate] = useState<string | null>(null)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [duration, setDuration] = useState(30)
  const [dragId, setDragId] = useState<string | null>(null)
  const [lokaal, setLokaal] = useState<Block[]>(blocks)

  useEffect(() => {
    setLokaal(blocks)
  }, [blocks])

  const monday = new Date(mondayISO + 'T00:00:00')
  const dagen = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const week = isoWeek(monday)
  const vandaag = toISODate(new Date())

  const subjectOf = (t?: Task) => subjects.find((s) => s.id === t?.subject_id)
  const subjectById = (id: string) => subjects.find((s) => s.id === id)
  const taskOf = (b: Block) => tasks.find((t) => t.id === b.task_id)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  )

  function ga(offset: number) {
    router.push('/week?start=' + toISODate(addDays(monday, offset * 7)))
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
    else { setAddDate(null); router.refresh() }
    setBusy(false)
  }

  async function dupliceer(b: Block) {
    if (!studentId) {
      setError('Geen leerling gevonden.')
      return
    }
    setBusy(true)
    setError('')
    const supabase = createClient()
    const { data, error } = await supabase
      .from('study_blocks')
      .insert({
        household_id: householdId,
        student_id: studentId,
        task_id: b.task_id,
        planned_date: b.planned_date,
        duration_minutes: b.duration_minutes,
        status: 'TODO',
        position_key: b.position_key + 1,
      })
      .select()
      .single()

    if (error) setError(error.message)
    else if (data) {
      setLokaal((prev) => [...prev, data as Block])
      router.refresh()
    }
    setBusy(false)
  }

  async function verplaats(id: string, datum: string | null) {
    setLokaal((prev) =>
      prev.map((b) => (b.id === id ? { ...b, planned_date: datum } : b)))
    const supabase = createClient()
    const { error } = await supabase
      .from('study_blocks')
      .update({ planned_date: datum, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  async function zetStatus(id: string, status: string) {
    setLokaal((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)))
    const supabase = createClient()
    const { error } = await supabase
      .from('study_blocks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  async function verwijder(id: string) {
    setLokaal((prev) => prev.filter((b) => b.id !== id))
    const supabase = createClient()
    const { error } = await supabase.from('study_blocks').delete().eq('id', id)
    if (error) setError(error.message)
    router.refresh()
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const over = e.over
    if (!over) return
    const id = String(e.active.id)
    const doel = String(over.id) === 'UNPLANNED' ? null : String(over.id)
    const huidig = lokaal.find((b) => b.id === id)
    if (!huidig || huidig.planned_date === doel) return
    verplaats(id, doel)
  }

  function ToetsBanner({ a }: { a: Assessment }) {
    const s = subjectById(a.subject_id)
    const kleur = s?.color ?? '#dc2626'
    const schatting = a.date_confidence === 'ESTIMATED'

    return (
      <div
        style={{
          backgroundColor: hexToRgba(kleur, 0.3),
          borderColor: kleur,
        }}
        className="rounded-lg border-2 px-2 py-1.5"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">&#128221;</span>
          <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide">
            Toets
          </p>
          {schatting && (
            <span className="rounded bg-white/70 px-1 text-[10px]">?</span>
          )}
        </div>
        <p className="mt-0.5 text-sm font-semibold leading-tight">{a.title}</p>
        <p className="text-xs opacity-80">
          {s?.name}
          {a.weight ? ' \u00b7 weging ' + a.weight : ''}
        </p>
        {a.syllabus && (
          <p className="mt-0.5 text-xs opacity-70">{a.syllabus}</p>
        )}
      </div>
    )
  }

  function Kaart({ b, overlay }: { b: Block; overlay?: boolean }) {
    const t = taskOf(b)
    const s = subjectOf(t)
    const kleur = s?.color ?? '#94a3b8'
    const klaar = b.status === 'DONE' || b.status === 'MASTERED'

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: b.id,
      disabled: overlay,
    })

    return (
      <div
        ref={overlay ? undefined : setNodeRef}
        style={{
          backgroundColor: hexToRgba(kleur, klaar ? 0.07 : 0.16),
          borderColor: hexToRgba(kleur, 0.55),
          borderLeft: '4px solid ' + kleur,
          opacity: isDragging ? 0.35 : 1,
        }}
        className={
          'rounded-lg border p-2 text-sm ' +
          (overlay ? 'shadow-lg rotate-2 cursor-grabbing' : '')
        }
      >
        <div
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          className={overlay ? '' : 'cursor-grab touch-none active:cursor-grabbing'}
        >
          <p className={'font-medium leading-tight ' + (klaar ? 'line-through opacity-60' : '')}>
            {t?.title ?? 'Onbekend'}
          </p>
          <p className="text-xs opacity-70">
            {s?.name} &middot; {b.duration_minutes} min
          </p>
        </div>

        {!overlay && (
          <div className="mt-2 flex items-center gap-1">
            <select
              value={b.status}
              onChange={(e) => zetStatus(b.id, e.target.value)}
              className="flex-1 rounded border-0 bg-white/60 px-1 py-0.5 text-xs"
            >
              {STATUS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => dupliceer(b)}
              disabled={busy}
              title="Dupliceren"
              className="rounded bg-white/60 px-1.5 py-0.5 text-xs hover:bg-white disabled:opacity-40"
            >
              &#43;&#43;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => verwijder(b.id)}
              disabled={busy}
              title="Verwijderen"
              className="rounded bg-white/60 px-1.5 py-0.5 text-xs hover:bg-white hover:text-red-600 disabled:opacity-40"
            >
              &times;
            </button>
          </div>
        )}

        {!overlay && (
          <select
            value={b.planned_date ?? ''}
            onChange={(e) => verplaats(b.id, e.target.value || null)}
            className="mt-1.5 w-full rounded border-0 bg-white/60 px-1 py-0.5 text-xs"
          >
            <option value="">Niet ingepland</option>
            {dagen.map((d, i) => (
              <option key={i} value={toISODate(d)}>
                {DAGEN[i].slice(0, 2)} {formatDag(d)}
              </option>
            ))}
          </select>
        )}
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
              {subjectOf(t)?.name} &mdash; {t.title}
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
            type="button"
            onClick={() => voegToe(datum)}
            disabled={busy}
            className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => setAddDate(null)}
            className="rounded border px-2 py-1 text-xs"
          >
            &times;
          </button>
        </div>
      </div>
    )
  }

  function Kolom({
    id, titel, subtitel, blokken, toetsen, highlight,
  }: {
    id: string
    titel: string
    subtitel: string
    blokken: Block[]
    toetsen: Assessment[]
    highlight?: boolean
  }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    const minuten = blokken.reduce((n, b) => n + b.duration_minutes, 0)

    return (
      <div
        ref={setNodeRef}
        className={
          'rounded-xl p-3 transition-colors ' +
          (isOver ? 'bg-blue-100 ring-2 ring-blue-400'
            : highlight ? 'bg-blue-50 ring-1 ring-blue-200' : 'bg-gray-50')
        }
      >
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{titel}</h2>
          <span className="text-xs text-gray-400">{subtitel}</span>
        </div>

        {minuten > 0 && (
          <p className="text-xs text-gray-400">{minuten} min</p>
        )}

        {toetsen.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toetsen.map((a) => <ToetsBanner key={a.id} a={a} />)}
          </div>
        )}

        <div className="mt-2 min-h-[60px] space-y-2">
          {blokken.map((b) => <Kaart key={b.id} b={b} />)}
          {addDate === id ? (
            <ToevoegForm datum={id === 'UNPLANNED' ? null : id} />
          ) : (
            <button
              type="button"
              onClick={() => setAddDate(id)}
              disabled={tasks.length === 0}
              className="w-full rounded-lg border border-dashed py-1.5 text-xs text-gray-500 disabled:opacity-40"
            >
              + Blok
            </button>
          )}
        </div>
      </div>
    )
  }

  const actief = dragId ? lokaal.find((b) => b.id === dragId) : null

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
          <button type="button" onClick={() => ga(-1)} className="rounded-lg border px-3 py-1.5 text-sm">
            Vorige
          </button>
          <button
            type="button"
            onClick={() => router.push('/week?start=' + toISODate(mondayOf(new Date())))}
            className="rounded-lg border px-3 py-1.5 text-sm"
          >
            Deze week
          </button>
          <button type="button" onClick={() => ga(1)} className="rounded-lg border px-3 py-1.5 text-sm">
            Volgende
          </button>
        </div>
      </div>

      {komende.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Komt eraan
          </span>
          {komende.map((a) => {
            const s = subjectById(a.subject_id)
            const d = dagenTot(a.date)
            return (
              <span
                key={a.id}
                style={{ backgroundColor: hexToRgba(s?.color ?? '#999', 0.25) }}
                className="rounded px-2 py-0.5 text-xs"
              >
                {s?.name}: {a.title}
                {d !== null && <span className="opacity-70"> &middot; over {d} dgn</span>}
              </span>
            )
          })}
        </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragId(null)}
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Kolom
            id="UNPLANNED"
            titel="Niet ingepland"
            subtitel={String(lokaal.filter((b) => !b.planned_date).length)}
            blokken={lokaal.filter((b) => !b.planned_date)}
            toetsen={[]}
          />
          {dagen.map((d, i) => {
            const iso = toISODate(d)
            return (
              <Kolom
                key={iso}
                id={iso}
                titel={DAGEN[i]}
                subtitel={formatDag(d)}
                blokken={lokaal.filter((b) => b.planned_date === iso)}
                toetsen={assessments.filter((a) => a.date === iso)}
                highlight={iso === vandaag}
              />
            )
          })}
        </div>

        <DragOverlay>
          {actief ? <Kaart b={actief} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

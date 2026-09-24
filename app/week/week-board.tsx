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
type Task = {
  id: string
  title: string
  subject_id: string
  task_type: string
  assessment_id: string | null
}
type Block = {
  id: string
  task_id: string
  planned_date: string | null
  duration_minutes: number
  status: string
  position_key: number
  note: string | null
  title_override: string | null
  assessment_id: string | null
  assessment_manual: boolean
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

const DUREN = [10, 15, 20, 25, 30, 45, 60, 90]

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

function korteTel(n: number | null): string {
  if (n === null) return ''
  if (n < 0) return 'geweest'
  if (n === 0) return 'vandaag!'
  if (n === 1) return 'morgen!'
  return 'nog ' + n + ' dgn'
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
  alleToetsen,
}: {
  householdId: string
  studentId: string | null
  mondayISO: string
  subjects: Subject[]
  tasks: Task[]
  blocks: Block[]
  assessments: Assessment[]
  komende: Assessment[]
  alleToetsen: Assessment[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [addDate, setAddDate] = useState<string | null>(null)
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [duration, setDuration] = useState(30)
  const [dragId, setDragId] = useState<string | null>(null)
  const [lokaal, setLokaal] = useState<Block[]>(blocks)
  const [editId, setEditId] = useState<string | null>(null)

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
  const toetsVanTaak = (t?: Task) =>
    t?.assessment_id ? alleToetsen.find((a) => a.id === t.assessment_id) : undefined

  // Toets van een blok: eigen keuze wint, anders die van de taak
  const toetsVanBlok = (b: Block) => {
    if (b.assessment_manual) {
      return b.assessment_id
        ? alleToetsen.find((a) => a.id === b.assessment_id)
        : undefined
    }
    return toetsVanTaak(taskOf(b))
  }

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
        note: b.note,
        title_override: b.title_override,
        assessment_id: b.assessment_id,
        assessment_manual: b.assessment_manual,
        status: 'TODO',
        position_key: b.position_key + 1,
      })
      .select()
      .single()

    if (error) setError(error.message)
    else if (data) {
      setLokaal((prev) => [...prev, data as Block])
      setEditId((data as Block).id)
      router.refresh()
    }
    setBusy(false)
  }

  async function bewerk(id: string, velden: Partial<Block>) {
    setLokaal((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...velden } : b)))
    const supabase = createClient()
    const { error } = await supabase
      .from('study_blocks')
      .update({ ...velden, updated_at: new Date().toISOString() })
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
    bewerk(id, { planned_date: doel })
  }

  function ToetsBanner({ a }: { a: Assessment }) {
    const s = subjectById(a.subject_id)
    const kleur = s?.color ?? '#dc2626'
    const schatting = a.date_confidence === 'ESTIMATED'

    return (
      <div
        style={{ backgroundColor: hexToRgba(kleur, 0.3), borderColor: kleur }}
        className="rounded-lg border-2 px-2 py-1.5"
      >
        <div className="flex items-center gap-1.5">
          <span className="text-sm">&#128221;</span>
          <p className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-wide">
            Toets
          </p>
          {schatting && <span className="rounded bg-white/70 px-1 text-[10px]">?</span>}
        </div>
        <p className="mt-0.5 text-sm font-semibold leading-tight">{a.title}</p>
        <p className="text-xs opacity-80">
          {s?.name}{a.weight ? ' \u00b7 weging ' + a.weight : ''}
        </p>
        {a.syllabus && <p className="mt-0.5 text-xs opacity-70">{a.syllabus}</p>}
      </div>
    )
  }

  function BewerkPaneel({ b }: { b: Block }) {
    const [vTask, setVTask] = useState(b.task_id)
    const [vDuur, setVDuur] = useState(b.duration_minutes)
    const [vDatum, setVDatum] = useState(b.planned_date ?? '')
    const [vTitel, setVTitel] = useState(b.title_override ?? '')
    const [vNote, setVNote] = useState(b.note ?? '')
    const [opslaan, setOpslaan] = useState(false)

    // '' = volg de taak, 'NONE' = bewust geen toets, anders een toets-id
    const [vToets, setVToets] = useState(
      b.assessment_manual ? (b.assessment_id ?? 'NONE') : ''
    )

    const gekozenTaak = tasks.find((t) => t.id === vTask)
    const gekozenVak = subjectOf(gekozenTaak)
    const taakToets = toetsVanTaak(gekozenTaak)
    const huidigeTaak = taskOf(b)
    const vakGewijzigd = gekozenTaak?.subject_id !== huidigeTaak?.subject_id

    const gekozenToets =
      vToets === '' ? taakToets
        : vToets === 'NONE' ? undefined
          : alleToetsen.find((a) => a.id === vToets)

    // Toetsen van het gekozen vak die nog niet geweest zijn
    const vakToetsen = alleToetsen.filter((a) => {
      if (a.subject_id !== gekozenTaak?.subject_id) return false
      const n = dagenTot(a.date)
      return n === null || n >= 0 || a.id === vToets
    })

    async function bewaar() {
      setOpslaan(true)
      await bewerk(b.id, {
        task_id: vTask,
        duration_minutes: vDuur,
        planned_date: vDatum || null,
        title_override: vTitel.trim() || null,
        note: vNote.trim() || null,
        assessment_manual: vToets !== '',
        assessment_id: vToets === '' || vToets === 'NONE' ? null : vToets,
      })
      setEditId(null)
      setOpslaan(false)
    }

    return (
      <div
        style={{
          backgroundColor: hexToRgba(gekozenVak?.color ?? '#94a3b8', 0.12),
          borderLeft: '4px solid ' + (gekozenVak?.color ?? '#94a3b8'),
        }}
        className="rounded-lg border-2 border-blue-400 p-2 text-sm"
      >
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide opacity-60">
          Bewerken
        </p>

        <label className="text-xs opacity-70">Taak en vak</label>
        <select
          value={vTask}
          onChange={(e) => setVTask(e.target.value)}
          className="mb-2 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
        >
          {subjects.map((s) => {
            const vakTaken = tasks.filter((t) => t.subject_id === s.id)
            if (vakTaken.length === 0) return null
            return (
              <optgroup key={s.id} label={s.name}>
                {vakTaken.map((t) => {
                  const a = toetsVanTaak(t)
                  return (
                    <option key={t.id} value={t.id}>
                      {t.title}
                      {a ? '  \u2014 toets: ' + a.title : '  \u2014 geen toets'}
                    </option>
                  )
                })}
              </optgroup>
            )
          })}
        </select>

        {vakGewijzigd && (
          <p className="mb-2 rounded bg-blue-50 px-1.5 py-1 text-xs text-blue-800">
            Vak wordt {gekozenVak?.name}; kleur verandert mee
          </p>
        )}

        <label className="text-xs opacity-70">Toets</label>
        <select
          value={vToets}
          onChange={(e) => setVToets(e.target.value)}
          className="mb-1 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
        >
          <option value="">
            {taakToets
              ? 'Volg de taak (' + taakToets.title + ')'
              : 'Volg de taak (geen toets)'}
          </option>
          <option value="NONE">Geen toets</option>
          {vakToetsen.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}{a.date ? ' (' + korteTel(dagenTot(a.date)) + ')' : ''}
            </option>
          ))}
        </select>

        {gekozenToets ? (
          <p className="mb-2 rounded bg-white/70 px-1.5 py-1 text-xs">
            &#128221; {gekozenToets.title} &middot; {korteTel(dagenTot(gekozenToets.date))}
            {vToets !== '' && (
              <span className="ml-1 opacity-60">(alleen dit blok)</span>
            )}
          </p>
        ) : (
          <p className="mb-2 rounded bg-white/70 px-1.5 py-1 text-xs opacity-60">
            Geen toets gekoppeld
          </p>
        )}

        <label className="text-xs opacity-70">Eigen titel (leeg = taaknaam)</label>
        <input
          value={vTitel}
          onChange={(e) => setVTitel(e.target.value)}
          placeholder={gekozenTaak?.title ?? ''}
          className="mb-2 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
        />

        <div className="mb-2 flex gap-1.5">
          <div className="flex-1">
            <label className="text-xs opacity-70">Duur</label>
            <select
              value={vDuur}
              onChange={(e) => setVDuur(Number(e.target.value))}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
            >
              {DUREN.map((m) => (
                <option key={m} value={m}>{m} min</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs opacity-70">Dag</label>
            <select
              value={vDatum}
              onChange={(e) => setVDatum(e.target.value)}
              className="w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
            >
              <option value="">Niet ingepland</option>
              {dagen.map((d, i) => (
                <option key={i} value={toISODate(d)}>
                  {DAGEN[i].slice(0, 2)} {formatDag(d)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="text-xs opacity-70">Opmerking voor dit blok</label>
        <textarea
          value={vNote}
          onChange={(e) => setVNote(e.target.value)}
          placeholder="Bijv. alleen blz 12 t/m 15"
          rows={2}
          className="mb-2 w-full rounded border border-gray-300 bg-white px-1.5 py-1 text-xs"
        />

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={bewaar}
            disabled={opslaan}
            className="flex-1 rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            {opslaan ? 'Bezig...' : 'Opslaan'}
          </button>
          <button
            type="button"
            onClick={() => setEditId(null)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            Annuleren
          </button>
        </div>
      </div>
    )
  }

  function Kaart({ b, overlay }: { b: Block; overlay?: boolean }) {
    const t = taskOf(b)
    const s = subjectOf(t)
    const kleur = s?.color ?? '#94a3b8'
    const klaar = b.status === 'DONE' || b.status === 'MASTERED'
    const toets = toetsVanBlok(b)
    const d = toets ? dagenTot(toets.date) : null
    const urgent = d !== null && d >= 0 && d <= 3
    const binnenkort = d !== null && d > 3 && d <= 7
    const titel = b.title_override ?? t?.title ?? 'Onbekend'

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id: b.id,
      disabled: overlay,
    })

    return (
      <div
        ref={overlay ? undefined : setNodeRef}
        style={{
          backgroundColor: hexToRgba(kleur, klaar ? 0.07 : 0.16),
          borderColor: urgent && !klaar ? '#dc2626' : hexToRgba(kleur, 0.55),
          borderWidth: urgent && !klaar ? '2px' : '1px',
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
            {titel}
          </p>
          <p className="text-xs opacity-70">
            {s?.name} &middot; {b.duration_minutes} min
          </p>

          {b.note && (
            <p className="mt-1 rounded bg-white/60 px-1.5 py-0.5 text-xs italic opacity-80">
              {b.note}
            </p>
          )}

          {toets && !klaar && (
            <div
              className={
                'mt-1 flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ' +
                (urgent
                  ? 'bg-red-600 font-semibold text-white'
                  : binnenkort
                    ? 'bg-amber-200 font-medium text-amber-900'
                    : 'bg-white/70')
              }
            >
              <span>&#128221;</span>
              <span className="min-w-0 flex-1 truncate">{toets.title}</span>
              <span className="shrink-0">{korteTel(d)}</span>
            </div>
          )}

          {toets && klaar && (
            <p className="mt-1 text-xs opacity-50">&#128221; {toets.title}</p>
          )}
        </div>

        {!overlay && (
          <div className="mt-2 flex items-center gap-1">
            <select
              value={b.status}
              onChange={(e) => bewerk(b.id, { status: e.target.value })}
              className="flex-1 rounded border-0 bg-white/60 px-1 py-0.5 text-xs"
            >
              {STATUS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setEditId(b.id)}
              disabled={busy}
              title="Bewerken"
              className="rounded bg-white/60 px-1.5 py-0.5 text-xs hover:bg-white disabled:opacity-40"
            >
              &#9998;
            </button>
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
          {tasks.map((t) => {
            const a = toetsVanTaak(t)
            return (
              <option key={t.id} value={t.id}>
                {subjectOf(t)?.name} &mdash; {t.title}
                {a ? ' (toets: ' + korteTel(dagenTot(a.date)) + ')' : ''}
              </option>
            )
          })}
        </select>
        <div className="mt-1.5 flex gap-1">
          <select
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="flex-1 rounded border border-gray-200 px-1 py-1 text-xs"
          >
            {DUREN.map((m) => (
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

        {minuten > 0 && <p className="text-xs text-gray-400">{minuten} min</p>}

        {toetsen.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {toetsen.map((a) => <ToetsBanner key={a.id} a={a} />)}
          </div>
        )}

        <div className="mt-2 min-h-[60px] space-y-2">
          {blokken.map((b) =>
            editId === b.id
              ? <BewerkPaneel key={b.id} b={b} />
              : <Kaart key={b.id} b={b} />
          )}
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
          {dagen.map((d2, i) => {
            const iso = toISODate(d2)
            return (
              <Kolom
                key={iso}
                id={iso}
                titel={DAGEN[i]}
                subtitel={formatDag(d2)}
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

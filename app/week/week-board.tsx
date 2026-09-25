'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import { jsPDF } from 'jspdf'
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, useDraggable, pointerWithin,
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
type BlockFields = Pick<
  Block,
  'task_id' | 'duration_minutes' | 'note' | 'title_override' | 'assessment_id' | 'assessment_manual'
>
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

function pdfColor(hex: string | undefined): [number, number, number] {
  const value = hex?.replace('#', '')
  if (!value || !/^[\da-f]{6}$/i.test(value)) return [148, 163, 184]
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ]
}

function sameBlockContent(a: BlockFields, b: BlockFields): boolean {
  return a.task_id === b.task_id
    && a.duration_minutes === b.duration_minutes
    && a.note === b.note
    && a.title_override === b.title_override
    && a.assessment_id === b.assessment_id
    && a.assessment_manual === b.assessment_manual
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
  const [duplicateId, setDuplicateId] = useState<string | null>(null)
  const [view, setView] = useState<'dag' | 'week'>('week')
  const [dagIndex, setDagIndex] = useState(0)
  const mobileWeekRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setLokaal(blocks)
  }, [blocks])

  const monday = new Date(mondayISO + 'T00:00:00')
  const dagen = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const week = isoWeek(monday)
  const vandaag = toISODate(new Date())

  useEffect(() => {
    const saved = window.localStorage.getItem('weekview')
    const mobiel = window.matchMedia('(max-width: 639px)').matches
    setView(saved === 'dag' || saved === 'week' ? saved : (mobiel ? 'dag' : 'week'))
    const i = dagen.findIndex((d) => toISODate(d) === vandaag)
    setDagIndex(i >= 0 ? i : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mondayISO])

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
    // Muis (desktop): direct sleepbaar, zoals voorheen
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch (mobiel): even vasthouden = slepen, snel bewegen = swipen/scrollen
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  function ga(offset: number) {
    router.push('/week?start=' + toISODate(addDays(monday, offset * 7)))
  }

  function zetView(v: 'dag' | 'week') {
    setView(v)
    window.localStorage.setItem('weekview', v)
    if (v === 'week') {
      window.requestAnimationFrame(() => {
        const el = mobileWeekRef.current
        if (!el) return
        const targetIndex = dagen.findIndex((d) => toISODate(d) === vandaag)
        const cardIndex = targetIndex >= 0 ? targetIndex + 1 : 1
        const card = el.children.item(cardIndex) as HTMLElement | null
        if (card) {
          el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: 'smooth' })
        }
      })
    }
  }

  function gaDag(offset: number) {
    const nieuw = dagIndex + offset
    if (nieuw < 0) { ga(-1); return }
    if (nieuw > 6) { ga(1); return }
    setDagIndex(nieuw)
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

  async function dupliceer(b: Block, datums: string[]): Promise<string | null> {
    if (!studentId) {
      return 'Geen leerling gevonden.'
    }
    const uniekeDatums = [...new Set(datums)]
    if (uniekeDatums.length === 0) {
      return 'Selecteer minimaal één dag.'
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('study_blocks')
      .insert(uniekeDatums.map((planned_date) => ({
        household_id: householdId,
        student_id: studentId,
        task_id: b.task_id,
        planned_date,
        duration_minutes: b.duration_minutes,
        note: b.note,
        title_override: b.title_override,
        assessment_id: b.assessment_id,
        assessment_manual: b.assessment_manual,
        status: 'TODO',
        position_key: b.position_key + 1,
      })))
      .select()
    if (error) return error.message
    setLokaal((prev) => [...prev, ...((data ?? []) as Block[])])
    setDuplicateId(null)
    router.refresh()
    return null
  }

  async function bewerkMetDagen(
    id: string,
    velden: Partial<Block>,
    datums: string[],
  ): Promise<string | null> {
    const bron = lokaal.find((block) => block.id === id)
    if (!bron) {
      return 'Kaartje niet gevonden. Vernieuw de planner en probeer opnieuw.'
    }

    const uniekeDatums = [...new Set(datums)]
    const inhoud: BlockFields = {
      task_id: velden.task_id ?? bron.task_id,
      duration_minutes: velden.duration_minutes ?? bron.duration_minutes,
      note: velden.note === undefined ? bron.note : velden.note,
      title_override: velden.title_override === undefined ? bron.title_override : velden.title_override,
      assessment_id: velden.assessment_id === undefined ? bron.assessment_id : velden.assessment_id,
      assessment_manual: velden.assessment_manual ?? bron.assessment_manual,
    }
    const bestaandeVoorDatum = (datum: string) => lokaal.some((ander) =>
      ander.id !== id
      && ander.planned_date === datum
      && sameBlockContent(ander, inhoud))
    const primaireDatum = bron.planned_date && uniekeDatums.includes(bron.planned_date)
      ? bron.planned_date
      : uniekeDatums.find((datum) => !bestaandeVoorDatum(datum))

    if (uniekeDatums.length > 0 && !primaireDatum) {
      return 'Op alle gekozen dagen staat dit kaartje al. Pas de selectie aan om dubbele kaartjes te voorkomen.'
    }

    const kopieDatums = uniekeDatums.filter((datum) =>
      datum !== primaireDatum && !bestaandeVoorDatum(datum))
    if (kopieDatums.length > 0 && !studentId) {
      return 'Geen leerling gevonden; het kaartje kan niet naar meerdere dagen worden ingepland.'
    }
    const basisVelden = {
      ...velden,
      planned_date: primaireDatum ?? null,
    }
    const kopieVelden = kopieDatums.map((planned_date) => ({
      household_id: householdId,
      student_id: studentId,
      ...inhoud,
      planned_date,
      status: 'TODO',
      position_key: bron.position_key + 1,
    }))

    const supabase = createClient()
    const { data: kopieën, error: kopieFout } = kopieVelden.length > 0
      ? await supabase.from('study_blocks').insert(kopieVelden).select()
      : { data: [], error: null }

    if (kopieFout) {
      return kopieFout.message
    }

    const { data: bijgewerkteRij, error: updateFout } = await supabase
      .from('study_blocks')
      .update({ ...basisVelden, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (updateFout || !bijgewerkteRij) {
      const ids = (kopieën ?? []).map((kopie) => kopie.id)
      const opruimResultaat = ids.length > 0
        ? await supabase.from('study_blocks').delete().in('id', ids)
        : { error: null }
      const foutmelding = updateFout?.message ?? 'Kaartje kon niet worden bijgewerkt; het is mogelijk verwijderd.'
      return opruimResultaat.error
        ? foutmelding + ' Ook konden aangemaakte kopieën niet automatisch worden opgeruimd: ' + opruimResultaat.error.message
        : foutmelding
    }

    const bijgewerkt = { ...bron, ...basisVelden } as Block
    setLokaal((prev) => [
      ...prev.map((block) => block.id === id ? bijgewerkt : block),
      ...((kopieën ?? []) as Block[]),
    ])
    router.refresh()
    return null
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
        style={{ ['--accent' as string]: kleur } as React.CSSProperties}
        className="banner rounded-lg px-2 py-1.5"
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
    const [vDatums, setVDatums] = useState<string[]>(b.planned_date ? [b.planned_date] : [])
    const [vTitel, setVTitel] = useState(b.title_override ?? '')
    const [vNote, setVNote] = useState(b.note ?? '')
    const [opslaan, setOpslaan] = useState(false)
    const [bewerkFout, setBewerkFout] = useState('')
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
      setBewerkFout('')
      const fout = await bewerkMetDagen(b.id, {
        task_id: vTask,
        duration_minutes: vDuur,
        title_override: vTitel.trim() || null,
        note: vNote.trim() || null,
        assessment_manual: vToets !== '',
        assessment_id: vToets === '' || vToets === 'NONE' ? null : vToets,
      }, vDatums)
      if (fout) setBewerkFout(fout)
      else setEditId(null)
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
        </div>
        <fieldset className="mb-2">
          <legend className="mb-1 text-xs opacity-70">Dagen (leeg = niet ingepland)</legend>
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
            {dagen.map((dag, i) => {
              const datum = toISODate(dag)
              const geselecteerd = vDatums.includes(datum)
              return (
                <label
                  key={datum}
                  className={
                    'flex cursor-pointer flex-col items-center rounded border px-1 py-1 text-[11px] focus-within:ring-2 focus-within:ring-blue-500 ' +
                    (geselecteerd ? 'border-blue-600 bg-blue-600 font-medium text-white' : 'border-gray-300 bg-white')
                  }
                >
                  <input
                    type="checkbox"
                    checked={geselecteerd}
                    disabled={opslaan}
                    onChange={(e) => setVDatums((prev) =>
                      e.target.checked
                        ? [...new Set([...prev, datum])]
                        : prev.filter((value) => value !== datum))}
                    className="sr-only"
                  />
                  <span>{DAGEN[i].slice(0, 2)}</span>
                  <span>{formatDag(dag)}</span>
                </label>
              )
            })}
          </div>
        </fieldset>
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
            disabled={opslaan}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-xs"
          >
            Annuleren
          </button>
        </div>
        {bewerkFout && <p className="mt-2 text-xs text-red-600">{bewerkFout}</p>}
      </div>
    )
  }

  function DupliceerPaneel({ b }: { b: Block }) {
    const [datums, setDatums] = useState<string[]>([])
    const [opslaan, setOpslaan] = useState(false)
    const [dupliceerFout, setDupliceerFout] = useState('')

    async function bewaarKopieën() {
      setOpslaan(true)
      setDupliceerFout('')
      const fout = await dupliceer(b, datums)
      if (fout) setDupliceerFout(fout)
      setOpslaan(false)
    }

    return (
      <div className="mt-2 rounded-lg border border-dashed p-2">
        <p className="mb-2 text-xs font-semibold">Kies een of meer dagen voor de kopie</p>
        <div className="grid grid-cols-4 gap-1 sm:grid-cols-7">
          {dagen.map((dag, i) => {
            const datum = toISODate(dag)
            const geselecteerd = datums.includes(datum)
            return (
              <label
                key={datum}
                className={
                  'flex cursor-pointer flex-col items-center rounded border px-1 py-1 text-[11px] focus-within:ring-2 focus-within:ring-blue-500 ' +
                  (geselecteerd ? 'border-blue-600 bg-blue-600 font-medium text-white' : 'border-gray-300 bg-white')
                }
              >
                <input
                  type="checkbox"
                  checked={geselecteerd}
                  disabled={busy || opslaan}
                  onChange={(e) => setDatums((prev) =>
                    e.target.checked
                      ? [...new Set([...prev, datum])]
                      : prev.filter((value) => value !== datum))}
                  className="sr-only"
                />
                <span>{DAGEN[i].slice(0, 2)}</span>
                <span>{formatDag(dag)}</span>
                {datum === b.planned_date && <span className="text-[9px]">origineel</span>}
              </label>
            )
          })}
        </div>
        <div className="mt-2 flex gap-1.5">
          <button
            type="button"
            onClick={bewaarKopieën}
            disabled={busy || opslaan || datums.length === 0}
            className="flex-1 rounded bg-black px-2 py-1.5 text-xs text-white disabled:opacity-50"
          >
            {opslaan ? 'Bezig...' : 'Kopieën opslaan'}
          </button>
          <button
            type="button"
            onClick={() => setDuplicateId(null)}
            disabled={busy || opslaan}
            className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs disabled:opacity-50"
          >
            Annuleren
          </button>
        </div>
        {dupliceerFout && <p className="mt-2 text-xs text-red-600">{dupliceerFout}</p>}
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
          ['--accent' as string]: kleur,
          opacity: isDragging ? 0.35 : 1,
        } as React.CSSProperties}
        className={
          'tile rounded-lg p-2 text-sm ' +
          (klaar ? 'tile-done ' : '') +
          (urgent && !klaar ? 'tile-urgent ' : '') +
          (overlay ? 'shadow-lg rotate-2 cursor-grabbing' : '')
        }
      >
        <div
          {...(overlay ? {} : listeners)}
          {...(overlay ? {} : attributes)}
          className={
            overlay
              ? ''
              : 'cursor-grab touch-pan-x touch-pan-y active:cursor-grabbing'
          }
        >
          <p className={'font-medium leading-tight ' + (klaar ? 'line-through opacity-60' : '')}>
            {titel}
          </p>
          <p className="text-xs opacity-70">
            {s?.name} &middot; {b.duration_minutes} min
          </p>
          {b.note && (
            <p className="chip mt-1 rounded px-1.5 py-0.5 text-xs italic">
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
                    ? 'bg-amber-500 font-medium text-white'
                    : 'chip')
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
              className="ctl tap min-w-0 flex-1 rounded px-2 py-1 text-xs"
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
              className="ctl tap rounded px-2 py-1 text-sm font-semibold disabled:opacity-40"
            >
              &#9998;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setDuplicateId(duplicateId === b.id ? null : b.id)
                setEditId(null)
                setError('')
              }}
              disabled={busy}
              title="Dupliceren"
              className="ctl tap rounded px-2 py-1 text-sm font-semibold disabled:opacity-40"
            >
              &#43;&#43;
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => verwijder(b.id)}
              disabled={busy}
              title="Verwijderen"
              className="ctl tap rounded px-2 py-1 text-lg font-bold hover:text-red-500 disabled:opacity-40"
            >
              &times;
            </button>
          </div>
        )}
        {!overlay && duplicateId === b.id && <DupliceerPaneel b={b} />}
        {!overlay && error && duplicateId === b.id && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
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
          className="ctl tap w-full rounded px-2 py-1.5 text-xs"
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
            className="ctl tap min-w-0 flex-1 rounded px-2 py-1.5 text-xs"
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
    id, titel, subtitel, blokken, toetsen, highlight, groot,
  }: {
    id: string
    titel: string
    subtitel: string
    blokken: Block[]
    toetsen: Assessment[]
    highlight?: boolean
    groot?: boolean
  }) {
    const { setNodeRef, isOver } = useDroppable({ id })
    const minuten = blokken.reduce((n, b) => n + b.duration_minutes, 0)
    return (
      <div
        ref={setNodeRef}
        className={
          'rounded-xl p-3 transition-colors ' +
          (isOver ? 'surface-2 ring-2 ring-blue-500'
            : highlight ? 'surface-2 ring-1 ring-blue-400' : 'surface')
        }
      >
        <div className="flex items-baseline justify-between">
          <h2 className={groot ? 'text-lg font-semibold' : 'text-sm font-semibold'}>{titel}</h2>
          <span className="muted text-xs">{subtitel}</span>
        </div>
        {minuten > 0 && <p className="muted text-xs">{minuten} min</p>}
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
              className="brd muted tap w-full rounded-lg border border-dashed py-2 text-xs disabled:opacity-40"
            >
              + Blok
            </button>
          )}
        </div>
      </div>
    )
  }

  const actief = dragId ? lokaal.find((b) => b.id === dragId) : null
  const nietIngepland = lokaal.filter((b) => !b.planned_date)
  const huidigeDag = dagen[dagIndex]
  const huidigeISO = huidigeDag ? toISODate(huidigeDag) : ''

  function downloadPdf() {
    setError('')

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const gap = 2
      const exportDays = view === 'week'
        ? dagen.map((date, index) => ({ date, index }))
        : [{ date: huidigeDag, index: dagIndex }]
      const columnWidth = (pageWidth - margin * 2 - gap * (exportDays.length - 1)) / exportDays.length
      const pageTitle = view === 'week'
        ? 'Week ' + week
        : DAGEN[dagIndex] + ' ' + formatDag(huidigeDag)
      const marginBottom = 8
      const contentTop = 32
      const contentBottom = pageHeight - marginBottom
      const fontSize = exportDays.length === 7 ? 6 : 9
      const lineHeight = exportDays.length === 7 ? 2.8 : 4
      const textWidth = columnWidth - 6
      const maxLinesPerCard = Math.floor((contentBottom - contentTop - 5) / lineHeight)
      const entriesByDay = exportDays.map(({ date }) => {
        const iso = toISODate(date)
        const entries: { lines: string[]; color: [number, number, number] }[] = []
        const dayAssessments = assessments.filter((assessment) => assessment.date === iso)
        const dayBlocks = lokaal.filter((block) => block.planned_date === iso)

        for (const assessment of dayAssessments) {
          const subject = subjectById(assessment.subject_id)
          entries.push({
            lines: ['Toets: ' + assessment.title, subject?.name ?? ''],
            color: [180, 83, 9],
          })
        }

        for (const block of dayBlocks) {
          const task = taskOf(block)
          const subject = subjectOf(task)
          const assessment = toetsVanBlok(block)
          const status = STATUS.find((item) => item.value === block.status)?.label ?? block.status
          entries.push({
            lines: [
              block.title_override ?? task?.title ?? 'Onbekend',
              [subject?.name, block.duration_minutes + ' min', status].filter(Boolean).join(' · '),
              ...(block.note ? [block.note] : []),
              ...(assessment ? ['Toets: ' + assessment.title] : []),
            ],
            color: pdfColor(subject?.color),
          })
        }

        if (entries.length === 0) {
          entries.push({ lines: ['Geen geplande blokken'], color: [148, 163, 184] })
        }
        return entries.flatMap((entry) => {
          const wrappedLines = entry.lines.flatMap((line) => {
            const normalized = line.replace(/\s+/g, ' ').trim()
            if (!normalized) return []
            const wrapped = pdf.splitTextToSize(normalized, textWidth)
            return Array.isArray(wrapped) ? wrapped : [wrapped]
          })
          const fragments: { lines: string[]; color: [number, number, number] }[] = []
          for (let line = 0; line < wrappedLines.length; line += maxLinesPerCard) {
            fragments.push({
              lines: wrappedLines.slice(line, line + maxLinesPerCard),
              color: entry.color,
            })
          }
          return fragments
        })
      })

      const entryOffsets = exportDays.map(() => 0)
      let pageNumber = 0

      while (entryOffsets.some((offset, index) => offset < entriesByDay[index].length)) {
        if (pageNumber > 0) pdf.addPage('a4', 'landscape')
        pdf.setTextColor(25, 35, 50)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(15)
        pdf.text(pageTitle, margin, 13)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.setTextColor(90, 100, 115)
        const dateRange = view === 'week'
          ? formatDag(dagen[0]) + ' t/m ' + formatDag(dagen[6]) + ' ' + dagen[6].getFullYear()
          : formatDag(huidigeDag) + ' ' + huidigeDag.getFullYear()
        pdf.text(dateRange, margin, 19)

        for (let column = 0; column < exportDays.length; column++) {
          const x = margin + column * (columnWidth + gap)
          const { date, index } = exportDays[column]
          const isContinuation = entryOffsets[column] > 0
          pdf.setFillColor(238, 242, 247)
          pdf.roundedRect(x, 23, columnWidth, 7, 1, 1, 'F')
          pdf.setTextColor(25, 35, 50)
          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(exportDays.length === 7 ? 7 : 10)
          pdf.text(
            DAGEN[index].slice(0, 2) + ' ' + formatDag(date) + (isContinuation ? ' ·' : ''),
            x + 2,
            27.5,
            { maxWidth: columnWidth - 4 },
          )

          let y = contentTop
          const entries = entriesByDay[column]
          while (entryOffsets[column] < entries.length) {
            const entry = entries[entryOffsets[column]]
            const cardHeight = Math.max(8, entry.lines.length * lineHeight + 4)
            if (y + cardHeight > contentBottom) break

            pdf.setDrawColor(205, 213, 223)
            pdf.setFillColor(255, 255, 255)
            pdf.roundedRect(x, y, columnWidth, cardHeight, 1, 1, 'FD')
            pdf.setDrawColor(...entry.color)
            pdf.setLineWidth(0.8)
            pdf.line(x + 0.5, y + 1, x + 0.5, y + cardHeight - 1)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(fontSize)
            pdf.setTextColor(40, 50, 65)
            pdf.text(entry.lines, x + 3, y + 3.5, { lineHeightFactor: 1.15 })
            y += cardHeight + 1.5
            entryOffsets[column]++
          }
        }
        pageNumber++
      }

      if (nietIngepland.length > 0) {
        const columns = 4
        const unplannedGap = 3
        const unplannedWidth = (pageWidth - margin * 2 - unplannedGap * (columns - 1)) / columns
        const maxUnplannedLines = Math.floor((pageHeight - 36) / 3.5)
        const unplannedEntries = nietIngepland.flatMap((block) => {
          const task = taskOf(block)
          const subject = subjectOf(task)
          const assessment = toetsVanBlok(block)
          const lines = [
            block.title_override ?? task?.title ?? 'Onbekend',
            [subject?.name, block.duration_minutes + ' min'].filter(Boolean).join(' · '),
            ...(block.note ? [block.note] : []),
            ...(assessment ? ['Toets: ' + assessment.title] : []),
          ].flatMap((line) => {
            const normalized = line.replace(/\s+/g, ' ').trim()
            if (!normalized) return []
            const wrapped = pdf.splitTextToSize(normalized, unplannedWidth - 6)
            return Array.isArray(wrapped) ? wrapped : [wrapped]
          })
          const fragments: string[][] = []
          for (let line = 0; line < lines.length; line += maxUnplannedLines) {
            fragments.push(lines.slice(line, line + maxUnplannedLines))
          }
          return fragments
        })
        let y = 25
        let unplannedPage = 0
        for (let rowStart = 0; rowStart < unplannedEntries.length; rowStart += columns) {
          const row = unplannedEntries.slice(rowStart, rowStart + columns)
          const rowHeight = Math.max(...row.map((lines) => Math.max(10, lines.length * 3.5 + 4)))
          if (y + rowHeight > pageHeight - margin) {
            pdf.addPage('a4', 'landscape')
            y = 25
            unplannedPage++
          }
          if (y === 25) {
            pdf.setTextColor(25, 35, 50)
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(15)
            pdf.text(pageTitle + ' · Niet ingepland' + (unplannedPage ? ' (vervolg)' : ''), margin, 13)
          }
          row.forEach((lines, column) => {
            const x = margin + column * (unplannedWidth + unplannedGap)
            const cardHeight = Math.max(10, lines.length * 3.5 + 4)
            pdf.setDrawColor(205, 213, 223)
            pdf.roundedRect(x, y, unplannedWidth, cardHeight, 1, 1, 'S')
            pdf.setDrawColor(148, 163, 184)
            pdf.setLineWidth(0.8)
            pdf.line(x + 0.5, y + 1, x + 0.5, y + cardHeight - 1)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(8)
            pdf.setTextColor(40, 50, 65)
            pdf.text(lines, x + 3, y + 4, { lineHeightFactor: 1.15 })
          })
          y += rowHeight + 2
        }
      }

      pdf.save('Studieplanner- week ' + week + '.pdf')
    } catch (downloadError) {
      setError(downloadError instanceof Error
        ? 'PDF downloaden is niet gelukt: ' + downloadError.message
        : 'PDF downloaden is niet gelukt.')
    }
  }

  return (
    <div className="mt-2 overflow-x-hidden">
      <div className="week-screen">
      <div className="sticky left-0 right-0 top-0 z-30 -mx-4 w-[calc(100%+2rem)] max-w-[100vw] overflow-hidden border-b border-[var(--brd)] bg-[var(--background)]/95 px-4 pb-3 pt-1 backdrop-blur sm:static sm:mx-0 sm:w-auto sm:max-w-none sm:overflow-visible sm:border-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
        <div className="flex w-full items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Week {week}</h1>
          <p className="muted text-sm">
            {formatDag(dagen[0])} t/m {formatDag(dagen[6])} {dagen[6].getFullYear()}
          </p>
        </div>
        <div className="surface-2 flex shrink-0 rounded-lg p-1">
          <button type="button" onClick={() => zetView('dag')} className={'tap rounded-md px-3 text-sm ' + (view === 'dag' ? 'bg-blue-600 font-semibold text-white' : 'muted')}>Dag</button>
          <button type="button" onClick={() => zetView('week')} className={'tap rounded-md px-3 text-sm ' + (view === 'week' ? 'bg-blue-600 font-semibold text-white' : 'muted')}>Week</button>
        </div>
        </div>
        <div className="mt-2 grid w-full grid-cols-3 gap-2 sm:mt-3 sm:flex">
        {view === 'week' ? (
          <>
            <button type="button" onClick={() => ga(-1)} className="ctl tap min-w-0 rounded-lg px-1 py-2 text-[11px] sm:px-3 sm:text-sm">← Vorige</button>
            <button type="button" onClick={() => router.push('/week?start=' + toISODate(mondayOf(new Date())))} className="ctl tap min-w-0 rounded-lg px-1 py-2 text-[11px] sm:px-3 sm:text-sm">Deze week</button>
            <button type="button" onClick={() => ga(1)} className="ctl tap min-w-0 rounded-lg px-1 py-2 text-[11px] sm:px-3 sm:text-sm">Volgende →</button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => gaDag(-1)} className="ctl tap rounded-lg px-4 py-2 text-sm">←</button>
            <div className="surface-2 flex flex-1 items-center justify-center rounded-lg px-3 py-2 text-sm font-medium">
              {DAGEN[dagIndex]} {formatDag(dagen[dagIndex])}
              {huidigeISO === vandaag && <span className="ml-2 rounded bg-blue-600 px-1.5 py-0.5 text-xs text-white">vandaag</span>}
            </div>
            <button type="button" onClick={() => gaDag(1)} className="ctl tap rounded-lg px-4 py-2 text-sm">→</button>
          </>
        )}
        </div>
        <div className="mt-2 flex justify-end sm:mt-3">
          <button
            type="button"
            onClick={downloadPdf}
            className="ctl tap flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium sm:w-auto"
          >
            <span aria-hidden="true">&#8595;</span>
            PDF downloaden
          </button>
        </div>
      </div>
      {komende.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-xs">
          <span className="shrink-0 font-semibold uppercase tracking-wide">Komt eraan</span>
          {komende.map((a) => {
            const s = subjectById(a.subject_id)
            const d = dagenTot(a.date)
            return <span key={a.id} style={{ ['--accent' as string]: s?.color ?? '#999' } as React.CSSProperties} className="chip max-w-full rounded px-2 py-0.5 break-words">
              {s?.name}: {a.title}{d !== null && <span className="opacity-75"> · over {d} dgn</span>}
            </span>
          })}
        </div>
      )}
      {error && <p className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm text-white">{error}</p>}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        {view === 'week' ? (
          <>
            <div
              ref={mobileWeekRef}
              className="mt-4 flex w-full snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-3 sm:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <div className="w-[calc(100vw-3rem)] max-w-[28rem] shrink-0 snap-start self-start">
                <Kolom id="UNPLANNED" titel="Niet ingepland" subtitel={String(nietIngepland.length)} blokken={nietIngepland} toetsen={[]} groot />
              </div>
              {dagen.map((d, i) => {
                const iso = toISODate(d)
                return <div key={iso} className="w-[calc(100vw-3rem)] max-w-[28rem] shrink-0 snap-start self-start">
                  <Kolom id={iso} titel={DAGEN[i]} subtitel={formatDag(d)} blokken={lokaal.filter((b) => b.planned_date === iso)} toetsen={assessments.filter((a) => a.date === iso)} highlight={iso === vandaag} groot />
                </div>
              })}
            </div>
            <div className="mt-4 hidden gap-3 sm:grid sm:grid-cols-2 lg:grid-cols-4">
              <Kolom id="UNPLANNED" titel="Niet ingepland" subtitel={String(nietIngepland.length)} blokken={nietIngepland} toetsen={[]} />
              {dagen.map((d, i) => {
                const iso = toISODate(d)
                return <Kolom key={iso} id={iso} titel={DAGEN[i]} subtitel={formatDag(d)} blokken={lokaal.filter((b) => b.planned_date === iso)} toetsen={assessments.filter((a) => a.date === iso)} highlight={iso === vandaag} />
              })}
            </div>
          </>
        ) : (
          <div className="mt-4 space-y-3">
            <Kolom id={huidigeISO} titel={DAGEN[dagIndex]} subtitel={formatDag(dagen[dagIndex])} blokken={lokaal.filter((b) => b.planned_date === huidigeISO)} toetsen={assessments.filter((a) => a.date === huidigeISO)} highlight={huidigeISO === vandaag} groot />
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dagen.map((d, i) => {
                const iso = toISODate(d)
                const n = lokaal.filter((b) => b.planned_date === iso).length
                const heeftToets = assessments.some((a) => a.date === iso)
                return <button key={iso} type="button" onClick={() => setDagIndex(i)} className={'tap shrink-0 rounded-lg px-3 py-2 text-xs ' + (i === dagIndex ? 'bg-blue-600 font-medium text-white' : 'surface-2')}>
                  <span className="block">{DAGEN[i].slice(0, 2)}</span>
                  <span className="block opacity-80">{heeftToets ? '📝' : ''}{n > 0 ? n : ''}</span>
                </button>
              })}
            </div>
            <Kolom id="UNPLANNED" titel="Niet ingepland" subtitel={String(nietIngepland.length)} blokken={nietIngepland} toetsen={[]} />
          </div>
        )}
        <DragOverlay>{actief ? <Kaart b={actief} overlay /> : null}</DragOverlay>
      </DndContext>
      </div>
    </div>
  )
}
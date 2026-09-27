'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

type Lid = { user_id: string; role: string; display_name: string }
type GeparsedKaartje = { side1: string; side2: string }
type GeparsedBestand = {
  title: string
  side1Label: string
  side2Label: string
  cards: GeparsedKaartje[]
}
type BestaandeModule = { id: string; side_1_label: string; side_2_label: string }

function vindWaarde(rows: any[][], label: string): string | null {
  const labelLower = label.toLowerCase()
  for (const row of rows) {
    const a = (row[0] ?? '').toString().trim().toLowerCase()
    if (a === labelLower || a === labelLower + ':') {
      const waarde = (row[1] ?? '').toString().trim()
      return waarde || null
    }
  }
  return null
}

function parseWorkbook(rows: any[][]): { data?: GeparsedBestand; fout?: string } {
  const title = vindWaarde(rows, 'toetsnaam')
  if (!title) return { fout: 'Kan "Toetsnaam:" niet vinden in kolom A.' }

  const side1Label = vindWaarde(rows, 'taal 1')
  if (!side1Label) return { fout: 'Kan "Taal 1" niet vinden in kolom A.' }

  const side2Label = vindWaarde(rows, 'taal 2')
  if (!side2Label) return { fout: 'Kan "Taal 2" niet vinden in kolom A.' }

  const kaartjesIndex = rows.findIndex(
    (row) => (row[0] ?? '').toString().trim().toLowerCase() === 'kaartjes'
  )
  if (kaartjesIndex === -1) return { fout: 'Kan de rij "Kaartjes" niet vinden in kolom A.' }

  // De rij direct na "Kaartjes" is de kolomkop-rij (Taal1 / taal2).
  // De echte kaartjes-data begint daarna.
  let i = kaartjesIndex + 2
  const cards: GeparsedKaartje[] = []

  while (i < rows.length) {
    const row = rows[i] ?? []
    const a = (row[0] ?? '').toString().trim()
    const b = (row[1] ?? '').toString().trim()

    if (a === '' && b === '') break // lege regel gevonden: dit is de lastrow, stoppen

    if (a === '' || b === '') {
      return {
        fout:
          'Rij ' + (i + 1) + ' is niet compleet: beide talen moeten ingevuld zijn. ' +
          'De hele import is afgekeurd. Pas het bestand aan en probeer opnieuw.',
      }
    }

    cards.push({ side1: a, side2: b })
    i++
  }

  if (cards.length === 0) {
    return { fout: 'Er zijn geen kaartjes gevonden onder "Kaartjes".' }
  }

  return { data: { title, side1Label, side2Label, cards } }
}

export default function ExcelImport({
  householdId,
  currentUserId,
  isParent,
  leden,
}: {
  householdId: string
  currentUserId: string
  isParent: boolean
  leden: Lid[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [stap, setStap] = useState<'kiezen' | 'voorbeeld' | 'conflict' | 'klaar'>('kiezen')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [bestand, setBestand] = useState<GeparsedBestand | null>(null)
  const [bestaandeModule, setBestaandeModule] = useState<BestaandeModule | null>(null)

  const kinderen = leden.filter((l) => l.role !== 'PARENT')
  const [voorWie, setVoorWie] = useState('')

  // Effectieve eigenaar van de nieuwe/aangevulde module:
  // bij een ouder altijd een kind, anders de gebruiker zelf.
  const eigenaarId = isParent ? voorWie : currentUserId

  function resetAlles() {
    setStap('kiezen')
    setBestand(null)
    setBestaandeModule(null)
    setError('')
    setVoorWie(kinderen.length === 1 ? kinderen[0].user_id : '')
  }

  function openPaneel() {
    resetAlles()
    setOpen(true)
  }

  async function bestandGekozen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setBusy(true)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const eersteBladNaam = workbook.SheetNames[0]
      const blad = workbook.Sheets[eersteBladNaam]
      const rows = XLSX.utils.sheet_to_json(blad, { header: 1, defval: '' }) as any[][]

      const resultaat = parseWorkbook(rows)
      if (resultaat.fout) {
        setError(resultaat.fout)
        setBestand(null)
      } else if (resultaat.data) {
        setBestand(resultaat.data)
        setStap('voorbeeld')
      }
    } catch (err) {
      setError('Kon het bestand niet lezen. Is het een geldig .xlsx-bestand?')
    }

    setBusy(false)
    e.target.value = ''
  }

  async function controleerEnImporteer() {
    if (!bestand) return
    if (isParent && !eigenaarId) {
      setError('Kies voor welk kind je dit importeert.')
      return
    }

    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: bestaande, error: e1 } = await supabase
      .from('training_modules')
      .select('id, side_1_label, side_2_label')
      .eq('household_id', householdId)
      .eq('owner_user_id', eigenaarId)
      .ilike('title', bestand.title)
      .maybeSingle()

    if (e1) {
      setError(e1.message)
      setBusy(false)
      return
    }

    if (bestaande) {
      setBestaandeModule(bestaande)
      setStap('conflict')
      setBusy(false)
      return
    }

    await maakNieuweModule()
  }

  async function maakNieuweModule() {
    if (!bestand) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: nieuweModule, error: e2 } = await supabase
      .from('training_modules')
      .insert({
        household_id: householdId,
        owner_user_id: eigenaarId,
        title: bestand.title,
        side_1_label: bestand.side1Label,
        side_2_label: bestand.side2Label,
      })
      .select('id')
      .single()

    if (e2 || !nieuweModule) {
      setError(e2?.message ?? 'Kon de module niet aanmaken.')
      setBusy(false)
      return
    }

    await voegKaartjesToe(nieuweModule.id)
  }

  async function voegKaartjesToe(moduleId: string) {
    if (!bestand) return
    const supabase = createClient()

    const { error: e3 } = await supabase.from('training_cards').insert(
      bestand.cards.map((c) => ({
        module_id: moduleId,
        side_1_text: c.side1,
        side_2_text: c.side2,
      }))
    )

    if (e3) {
      setError(e3.message)
      setBusy(false)
      return
    }

    setStap('klaar')
    setBusy(false)
    router.refresh()
  }

  async function kaartjesToevoegenAanBestaande() {
    if (!bestaandeModule) return
    setBusy(true)
    await voegKaartjesToe(bestaandeModule.id)
  }

  async function kaartjesVervangen() {
    if (!bestaandeModule || !bestand) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { error: e4 } = await supabase
      .from('training_cards')
      .delete()
      .eq('module_id', bestaandeModule.id)

    if (e4) {
      setError(e4.message)
      setBusy(false)
      return
    }

    await voegKaartjesToe(bestaandeModule.id)
  }

  if (!open) {
    return (
      <button
        onClick={openPaneel}
        className="mt-3 w-full rounded-lg border border-dashed px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
      >
        Excel importeren
      </button>
    )
  }

  return (
    <div className="mt-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Module importeren uit Excel</p>
        <button onClick={() => setOpen(false)} className="text-sm text-gray-400 hover:text-black">
          &times;
        </button>
      </div>

      {stap === 'kiezen' && (
        <div className="mt-3">
          {isParent && kinderen.length === 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Er is nog geen kind toegevoegd aan dit huishouden. Voeg eerst een kind toe
              voordat je kunt importeren.
            </p>
          )}

          {isParent && kinderen.length > 1 && (
            <select
              value={voorWie}
              onChange={(e) => setVoorWie(e.target.value)}
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Kies voor welk kind&hellip;</option>
              {kinderen.map((k) => (
                <option key={k.user_id} value={k.user_id}>
                  {k.display_name}
                </option>
              ))}
            </select>
          )}

          {isParent && kinderen.length === 1 && (
            <p className="mb-2 text-sm text-gray-500">Voor: {kinderen[0].display_name}</p>
          )}

          <input
            type="file"
            accept=".xlsx"
            onChange={bestandGekozen}
            disabled={busy || (isParent && kinderen.length === 0)}
            className="w-full text-sm"
          />

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {stap === 'voorbeeld' && bestand && (
        <div className="mt-3">
          <p className="text-sm">
            <span className="font-medium">{bestand.title}</span>
            <span className="text-gray-500">
              {' '}&middot; {bestand.side1Label} &rarr; {bestand.side2Label}
            </span>
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {bestand.cards.length} kaartjes gevonden
          </p>

          <ul className="mt-2 max-h-40 overflow-y-auto rounded border text-sm">
            {bestand.cards.map((c, i) => (
              <li key={i} className="flex gap-3 border-b px-2 py-1 last:border-0">
                <span className="flex-1">{c.side1}</span>
                <span className="flex-1">{c.side2}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <button
              onClick={controleerEnImporteer}
              disabled={busy}
              className="flex-1 rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {busy ? 'Bezig...' : 'Importeren'}
            </button>
            <button onClick={resetAlles} className="rounded-lg border px-4 py-2 text-sm">
              Annuleren
            </button>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {stap === 'conflict' && bestand && (
        <div className="mt-3">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Er bestaat al een module met de naam &ldquo;{bestand.title}&rdquo;. Wat wil je doen?
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={kaartjesToevoegenAanBestaande}
              disabled={busy}
              className="flex-1 rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
            >
              Kaartjes toevoegen
            </button>
            <button
              onClick={kaartjesVervangen}
              disabled={busy}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Kaartjes vervangen
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Toevoegen: nieuwe kaartjes komen erbij, bestaande blijven staan.<br />
            Vervangen: alle bestaande kaartjes worden verwijderd en vervangen door het bestand.
          </p>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}

      {stap === 'klaar' && (
        <div className="mt-3 text-center">
          <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            Import gelukt! &#10003;
          </p>
          <button
            onClick={resetAlles}
            className="mt-3 w-full rounded-lg border px-4 py-2 text-sm"
          >
            Nog een bestand importeren
          </button>
        </div>
      )}
    </div>
  )
}
'use client'

import { useState } from 'react'

type Card = { id: string; side_1_text: string; side_2_text: string }
type Richting = 'S1_NAAR_S2' | 'S2_NAAR_S1' | 'GEMENGD'
type Vraag = { card: Card; toonZijde1: boolean }

function normaliseer(tekst: string): string {
  return tekst
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function schud<T>(lijst: T[]): T[] {
  const kopie = [...lijst]
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[kopie[i], kopie[j]] = [kopie[j], kopie[i]]
  }
  return kopie
}

function bouwVragen(cards: Card[], richting: Richting): Vraag[] {
  const geschud = schud(cards)
  return geschud.map((card) => {
    let toonZijde1: boolean
    if (richting === 'S1_NAAR_S2') toonZijde1 = true
    else if (richting === 'S2_NAAR_S1') toonZijde1 = false
    else toonZijde1 = Math.random() < 0.5
    return { card, toonZijde1 }
  })
}

export default function OefenManager({
  moduleId,
  side1Label,
  side2Label,
  cards,
}: {
  moduleId: string
  side1Label: string
  side2Label: string
  cards: Card[]
}) {
  const [fase, setFase] = useState<'instellen' | 'bezig' | 'klaar'>('instellen')
  const [richting, setRichting] = useState<Richting>('GEMENGD')
  const [vragen, setVragen] = useState<Vraag[]>([])
  const [index, setIndex] = useState(0)
  const [antwoord, setAntwoord] = useState('')
  const [status, setStatus] = useState<'idle' | 'goed' | 'fout' | 'toonAntwoord'>('idle')
  const [goedAantal, setGoedAantal] = useState(0)
  const [foutAantal, setFoutAantal] = useState(0)

  function start() {
    setVragen(bouwVragen(cards, richting))
    setIndex(0)
    setAntwoord('')
    setStatus('idle')
    setGoedAantal(0)
    setFoutAantal(0)
    setFase('bezig')
  }

  function opnieuwBeginnen() {
    setFase('instellen')
  }

  const huidigeVraag = vragen[index]
  const prompt = huidigeVraag
    ? (huidigeVraag.toonZijde1 ? huidigeVraag.card.side_1_text : huidigeVraag.card.side_2_text)
    : ''
  const verwacht = huidigeVraag
    ? (huidigeVraag.toonZijde1 ? huidigeVraag.card.side_2_text : huidigeVraag.card.side_1_text)
    : ''
  const promptLabel = huidigeVraag
    ? (huidigeVraag.toonZijde1 ? side1Label : side2Label)
    : ''
  const antwoordLabel = huidigeVraag
    ? (huidigeVraag.toonZijde1 ? side2Label : side1Label)
    : ''

  function controleer() {
    if (!antwoord.trim()) return
    const correct = normaliseer(antwoord) === normaliseer(verwacht)
    if (correct) {
      setGoedAantal((n) => n + 1)
      setStatus('goed')
    } else {
      setFoutAantal((n) => n + 1)
      setStatus('fout')
    }
  }

  function opnieuwProberen() {
    setAntwoord('')
    setStatus('idle')
  }

  function toonAntwoord() {
    setStatus('toonAntwoord')
  }

  function volgende() {
    if (index + 1 >= vragen.length) {
      setFase('klaar')
      return
    }
    setIndex((i) => i + 1)
    setAntwoord('')
    setStatus('idle')
  }

  if (fase === 'instellen') {
    return (
      <div className="mt-6 rounded-lg border p-4">
        <p className="mb-2 text-sm font-medium">Hoe wil je oefenen?</p>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={richting === 'S1_NAAR_S2'}
              onChange={() => setRichting('S1_NAAR_S2')}
            />
            {side1Label} &rarr; {side2Label}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={richting === 'S2_NAAR_S1'}
              onChange={() => setRichting('S2_NAAR_S1')}
            />
            {side2Label} &rarr; {side1Label}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={richting === 'GEMENGD'}
              onChange={() => setRichting('GEMENGD')}
            />
            Door elkaar
          </label>
        </div>
        <button
          onClick={start}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white"
        >
          Start oefenen ({cards.length} kaartjes)
        </button>
      </div>
    )
  }

  if (fase === 'klaar') {
    return (
      <div className="mt-6 rounded-lg border p-6 text-center">
        <p className="text-lg font-semibold">Klaar geoefend!</p>
        <p className="mt-2 text-sm text-gray-500">
          {goedAantal} goed &middot; {foutAantal} fout van de {vragen.length} kaartjes
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <button
            onClick={start}
            className="rounded-lg bg-black px-4 py-2 text-white"
          >
            Nog een keer
          </button>
          <button
            onClick={opnieuwBeginnen}
            className="rounded-lg border px-4 py-2"
          >
            Andere richting
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p className="text-xs text-gray-400">
        Kaart {index + 1} van {vragen.length}
      </p>

      <div className="mt-2 rounded-lg border p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-400">{promptLabel}</p>
        <p className="mt-1 text-2xl font-semibold">{prompt}</p>

        <input
          value={antwoord}
          onChange={(e) => setAntwoord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (status === 'idle') controleer()
            else if (status === 'goed' || status === 'toonAntwoord') volgende()
          }}
          placeholder={antwoordLabel}
          disabled={status !== 'idle'}
          autoFocus
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-center disabled:bg-gray-50"
        />

        {status === 'idle' && (
          <button
            onClick={controleer}
            disabled={!antwoord.trim()}
            className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            Controleer
          </button>
        )}

        {status === 'goed' && (
          <div className="mt-3">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              Goed zo! &#10003;
            </p>
            <button
              onClick={volgende}
              className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white"
            >
              Volgende
            </button>
          </div>
        )}

        {status === 'fout' && (
          <div className="mt-3">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Niet helemaal juist
            </p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={opnieuwProberen}
                className="flex-1 rounded-lg border px-4 py-2"
              >
                Opnieuw proberen
              </button>
              <button
                onClick={toonAntwoord}
                className="flex-1 rounded-lg bg-black px-4 py-2 text-white"
              >
                Antwoord tonen
              </button>
            </div>
          </div>
        )}

        {status === 'toonAntwoord' && (
          <div className="mt-3">
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm">
              Juiste antwoord: <span className="font-semibold">{verwacht}</span>
            </p>
            <button
              onClick={volgende}
              className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white"
            >
              Volgende
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
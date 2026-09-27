'use client'

import { useEffect, useState } from 'react'
import { spreekUit } from '@/lib/speech'

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

  // De wachtrij bevat de kaartjes die nog aan bod moeten komen.
  // huidigeVraag is het kaartje dat nu op het scherm staat.
  const [wachtrij, setWachtrij] = useState<Vraag[]>([])
  const [huidigeVraag, setHuidigeVraag] = useState<Vraag | null>(null)

  const [antwoord, setAntwoord] = useState('')
  const [status, setStatus] = useState<'idle' | 'goed' | 'fout' | 'toonAntwoord'>('idle')

  // klaarIds: kaartjes die de gebruiker zelf goed heeft beantwoord (komen niet terug).
  // moeiteIds: kaartjes waarbij minstens één keer "antwoord tonen" is gebruikt.
  const [klaarIds, setKlaarIds] = useState<Set<string>>(new Set())
  const [moeiteIds, setMoeiteIds] = useState<Set<string>>(new Set())

  const totaalKaarten = cards.length

  function start() {
    const vragen = bouwVragen(cards, richting)
    const [eerste, ...rest] = vragen
    setWachtrij(rest ?? [])
    setHuidigeVraag(eerste ?? null)
    setKlaarIds(new Set())
    setMoeiteIds(new Set())
    setAntwoord('')
    setStatus('idle')
    setFase(eerste ? 'bezig' : 'klaar')
  }

  function opnieuwBeginnen() {
    setFase('instellen')
  }

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


  useEffect(() => {
    if (fase === 'bezig' && huidigeVraag && prompt) {
      spreekUit(prompt, promptLabel)
    }
  }, [fase, huidigeVraag, prompt, promptLabel])

  function controleer() {
    if (!antwoord.trim() || !huidigeVraag) return
    const correct = normaliseer(antwoord) === normaliseer(verwacht)
    if (correct) {
      setKlaarIds((prev) => new Set(prev).add(huidigeVraag.card.id))
      setStatus('goed')
    } else {
      setStatus('fout')
    }
  }

  function opnieuwProberen() {
    setAntwoord('')
    setStatus('idle')
  }

  function toonAntwoord() {
    if (!huidigeVraag) return
    setMoeiteIds((prev) => new Set(prev).add(huidigeVraag.card.id))
    setStatus('toonAntwoord')
  }

  function volgende() {
    if (!huidigeVraag) return

    // Herhalingsfunctie: een kaartje waarvan het antwoord getoond is,
    // gaat niet weg maar wordt achteraan de wachtrij gezet. Zo krijgt
    // de gebruiker het later in dezelfde sessie nog een keer, net
    // zolang tot hij het zelf goed beantwoordt.
    const nieuweWachtrij =
      status === 'toonAntwoord' ? [...wachtrij, huidigeVraag] : wachtrij

    if (nieuweWachtrij.length === 0) {
      setFase('klaar')
      setWachtrij([])
      setHuidigeVraag(null)
      return
    }

    const [volgendeVraag, ...rest] = nieuweWachtrij
    setWachtrij(rest)
    setHuidigeVraag(volgendeVraag)
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
    const foutAantal = moeiteIds.size
    const goedAantal = totaalKaarten - foutAantal

    return (
      <div className="mt-6 rounded-lg border p-6 text-center">
        <p className="text-lg font-semibold">Klaar geoefend!</p>
        <p className="mt-2 text-sm text-gray-500">
          {goedAantal} in één keer goed &middot; {foutAantal} met hulp geleerd
          &middot; {totaalKaarten} kaartjes in totaal
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

  // fase === 'bezig'
  const geleerd = klaarIds.size
  const nogTeGaan = wachtrij.length + (huidigeVraag ? 1 : 0)

  return (
    <div className="mt-6">
      <p className="text-xs text-gray-400">
        Geleerd: {geleerd} van {totaalKaarten} &middot; nog {nogTeGaan} te gaan
      </p>

      <div className="mt-2 rounded-lg border p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-400">{promptLabel}</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <p className="text-2xl font-semibold">{prompt}</p>
          <button
            type="button"
            onClick={() => spreekUit(prompt, promptLabel)}
            className="rounded-md border px-2 py-1"
            aria-label="Uitspraak herhalen"
            title="Uitspraak herhalen"
          >
            🔊
          </button>
        </div>

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
            <div className="mt-2 flex items-center justify-center gap-2">
              <span className="font-semibold">{verwacht}</span>
              <button
                type="button"
                onClick={() => spreekUit(verwacht, antwoordLabel)}
                className="rounded-md border px-2 py-1"
                aria-label="Vertaling beluisteren"
                title="Vertaling beluisteren"
              >
                🔊
              </button>
            </div>
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
              <button
                type="button"
                onClick={() => spreekUit(verwacht, antwoordLabel)}
                className="ml-2 rounded-md border px-2 py-1"
                aria-label="Juiste antwoord beluisteren"
                title="Juiste antwoord beluisteren"
              >
                🔊
              </button>
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Dit kaartje komt later nog een keer terug.
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
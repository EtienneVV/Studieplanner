'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'

type Vraag = {
  question_index: number
  prompt: string
  direction: string
}
type Feedback = {
  is_correct: boolean
  correct_answer: string | null
  next_question_index: number | null
  completed: boolean
  score_percent: number | null
}
type ResultRij = {
  question_index: number
  direction: string
  prompt: string
  expected_answer: string
  submitted_answer: string | null
  is_correct: boolean | null
}

export default function ToetsManager({
  moduleId,
  side1Label,
  side2Label,
  aantalKaartjes,
}: {
  moduleId: string
  side1Label: string
  side2Label: string
  aantalKaartjes: number
}) {
  const [fase, setFase] = useState<'start' | 'vraag' | 'klaar'>('start')
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [huidigeVraag, setHuidigeVraag] = useState<Vraag | null>(null)
  const [antwoord, setAntwoord] = useState('')
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [beantwoordAantal, setBeantwoordAantal] = useState(0)
  const [resultaat, setResultaat] = useState<ResultRij[]>([])
  const [scorePercent, setScorePercent] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function labelVoor(direction: string, kant: 'vraag' | 'antwoord'): string {
    // direction: 'SIDE_1_TO_2' betekent prompt = taal 1, verwacht antwoord = taal 2
    const isS1NaarS2 = direction === 'SIDE_1_TO_2'
    if (kant === 'vraag') return isS1NaarS2 ? side1Label : side2Label
    return isS1NaarS2 ? side2Label : side1Label
  }

  async function startToets() {
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data: nieuwAttemptId, error: e1 } = await supabase.rpc(
      'start_training_test',
      { p_module_id: moduleId }
    )

    if (e1 || !nieuwAttemptId) {
      setError(e1?.message ?? 'Kon de toets niet starten')
      setBusy(false)
      return
    }

    setAttemptId(nieuwAttemptId)
    await haalVolgendeVraag(nieuwAttemptId)
    setBusy(false)
  }

  async function haalVolgendeVraag(idOverride?: string) {
    const idOmTeGebruiken = idOverride ?? attemptId
    if (!idOmTeGebruiken) return

    const supabase = createClient()
    const { data, error: e2 } = await supabase.rpc('get_next_training_question', {
      p_attempt_id: idOmTeGebruiken,
    })

    if (e2) {
      setError(e2.message)
      return
    }

    const rijen = (data ?? []) as Vraag[]
    if (rijen.length === 0) {
      // Geen open vraag meer: toets is al klaar
      await toonResultaat(idOmTeGebruiken)
      return
    }

    setHuidigeVraag(rijen[0])
    setAntwoord('')
    setFeedback(null)
    setFase('vraag')
  }

  async function verstuur() {
    if (!antwoord.trim() || !huidigeVraag || !attemptId) return
    setBusy(true)
    setError('')
    const supabase = createClient()

    const { data, error: e3 } = await supabase.rpc('submit_training_answer', {
      p_attempt_id: attemptId,
      p_question_index: huidigeVraag.question_index,
      p_submitted_answer: antwoord,
    })

    if (e3) {
      setError(e3.message)
      setBusy(false)
      return
    }

    const rij = ((data ?? [])[0]) as Feedback | undefined
    if (rij) {
      setFeedback(rij)
      setBeantwoordAantal((n) => n + 1)
    }
    setBusy(false)
  }

  async function volgende() {
    if (!attemptId) return
    setBusy(true)

    if (feedback?.completed) {
      await toonResultaat(attemptId)
    } else {
      await haalVolgendeVraag()
    }
    setBusy(false)
  }

  async function toonResultaat(idOmTeGebruiken: string) {
    const supabase = createClient()
    const { data, error: e4 } = await supabase.rpc('get_training_test_result', {
      p_attempt_id: idOmTeGebruiken,
    })

    if (e4) {
      setError(e4.message)
      return
    }

    setResultaat((data ?? []) as ResultRij[])
    setScorePercent(feedback?.score_percent ?? null)
    setFase('klaar')
  }

  if (fase === 'start') {
    return (
      <div className="mt-6 rounded-lg border p-4 text-center">
        <p className="text-sm text-gray-500">
          {aantalKaartjes} vragen &middot; richting wordt automatisch gemengd
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Let op: eenmaal ingediende antwoorden kun je niet meer aanpassen.
        </p>
        <button
          onClick={startToets}
          disabled={busy}
          className="mt-4 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {busy ? 'Bezig...' : 'Start toets'}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  if (fase === 'klaar') {
    const goedAantal = resultaat.filter((r) => r.is_correct).length
    const foutAantal = resultaat.length - goedAantal

    return (
      <div className="mt-6">
        <div className="rounded-lg border p-6 text-center">
          <p className="text-lg font-semibold">Toets afgerond</p>
          <p className="mt-2 text-sm text-gray-500">
            {resultaat.length} vragen &middot; {goedAantal} goed &middot; {foutAantal} fout
          </p>
          <p className="mt-2 text-2xl font-bold">
            Score: {scorePercent !== null ? Math.round(scorePercent) : '?'}%
          </p>
        </div>

        <ul className="mt-4 space-y-2">
          {resultaat.map((r) => (
            <li
              key={r.question_index}
              className={
                'rounded-lg border p-3 text-sm ' +
                (r.is_correct ? 'bg-green-50' : 'bg-red-50')
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{labelVoor(r.direction, 'vraag')}</p>
                  <p className="font-medium">{r.prompt}</p>
                </div>
                <span className="text-lg">{r.is_correct ? '\u2713' : '\u2717'}</span>
              </div>
              <p className="mt-1">
                Jouw antwoord: <span className="font-medium">{r.submitted_answer}</span>
              </p>
              {!r.is_correct && (
                <p>
                  Juiste antwoord: <span className="font-medium">{r.expected_answer}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  // fase === 'vraag'
  return (
    <div className="mt-6">
      <p className="text-xs text-gray-400">
        Vraag {beantwoordAantal + 1} van {aantalKaartjes}
      </p>

      <div className="mt-2 rounded-lg border p-6 text-center">
        <p className="text-xs uppercase tracking-wide text-gray-400">
          {huidigeVraag ? labelVoor(huidigeVraag.direction, 'vraag') : ''}
        </p>
        <p className="mt-1 text-2xl font-semibold">{huidigeVraag?.prompt}</p>

        <input
          value={antwoord}
          onChange={(e) => setAntwoord(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (!feedback) verstuur()
            else volgende()
          }}
          placeholder={huidigeVraag ? labelVoor(huidigeVraag.direction, 'antwoord') : ''}
          disabled={!!feedback || busy}
          autoFocus
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-center disabled:bg-gray-50"
        />

        {!feedback && (
          <button
            onClick={verstuur}
            disabled={!antwoord.trim() || busy}
            className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {busy ? 'Bezig...' : 'Antwoord indienen'}
          </button>
        )}

        {feedback && feedback.is_correct && (
          <div className="mt-3">
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
              Goed zo! &#10003;
            </p>
            <button
              onClick={volgende}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {feedback.completed ? 'Bekijk resultaat' : 'Volgende'}
            </button>
          </div>
        )}

        {feedback && !feedback.is_correct && (
          <div className="mt-3">
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              Niet correct. Juiste antwoord:{' '}
              <span className="font-semibold">{feedback.correct_answer}</span>
            </p>
            <button
              onClick={volgende}
              disabled={busy}
              className="mt-3 w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50"
            >
              {feedback.completed ? 'Bekijk resultaat' : 'Volgende'}
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}
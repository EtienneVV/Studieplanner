'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('busy')
    setMessage('')
    const supabase = createClient()

    if (mode === 'password') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setStatus('error')
        setMessage(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
      return
    }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-2xl font-semibold">Studieplanner</h1>

        <div className="mb-5 flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => { setMode('password'); setStatus('idle') }}
            className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'password' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            Wachtwoord
          </button>
          <button
            onClick={() => { setMode('magic'); setStatus('idle') }}
            className={`flex-1 rounded-md px-3 py-1.5 ${mode === 'magic' ? 'bg-white shadow-sm' : 'text-gray-500'}`}
          >
            Inloglink
          </button>
        </div>

        {status === 'sent' ? (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-800">
            Check je mail. De link is 1 uur geldig.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />

            {mode === 'password' && (
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Wachtwoord"
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            )}

            <button
              type="submit"
              disabled={status === 'busy'}
              className="w-full rounded-lg bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {status === 'busy'
                ? 'Bezig…'
                : mode === 'password'
                  ? 'Inloggen'
                  : 'Stuur inloglink'}
            </button>

            {status === 'error' && <p className="text-sm text-red-600">{message}</p>}
          </form>
        )}
      </div>
      

        
    </main>
  )
}
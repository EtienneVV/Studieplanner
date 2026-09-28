import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AcceptManager from './accept-manager'

export default async function UitnodigingPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Alleen-lezen preview: laat zien om welk gezin het gaat, zonder
  // meteen lid te worden. Werkt ook als je nog niet bent ingelogd,
  // want de functie zelf vraagt geen auth.uid() af voor de preview.
  const { data: preview } = await supabase.rpc('preview_household_invitation', {
    p_token: token,
  })

  const info = preview?.[0]

  if (!info || !info.is_valid) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Uitnodiging niet geldig</h1>
        <p className="mt-2 text-sm text-gray-500">
          {info?.reden ?? 'Deze uitnodiging kon niet gevonden worden.'}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm underline">
          Terug naar de app
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">Uitnodiging voor {info.household_name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        Je wordt uitgenodigd als {info.role === 'PARENT' ? 'ouder' : 'leerling'}.
      </p>

      {!user ? (
        <div className="mt-6 rounded-lg border p-4">
          <p className="text-sm">
            Je bent nog niet ingelogd. Log eerst in of maak een account aan, kom dan
            terug naar deze link om de uitnodiging te accepteren.
          </p>
          <Link
            href={'/login?terug=' + encodeURIComponent('/uitnodiging/' + token)}
            className="mt-3 inline-block w-full rounded-lg bg-black px-4 py-2 text-center text-white"
          >
            Inloggen / account aanmaken
          </Link>
        </div>
      ) : (
        <AcceptManager token={token} householdName={info.household_name} />
      )}
    </main>
  )
}
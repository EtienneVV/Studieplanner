import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HouseholdSetup from './household-setup'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('household_members')
    .select('role, households(id, name)')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">Studieplanner</h1>
      <p className="mt-1 text-sm text-gray-500">Ingelogd als {user.email}</p>

      {memberships && memberships.length > 0 ? (
        <div className="mt-6 rounded-lg border p-4">
          {memberships.map((m, i) => (
            <div key={i}>
              <p className="font-medium">
                {(m.households as any)?.name}
              </p>
              <p className="text-sm text-gray-500">
                Jouw rol: {m.role === 'PARENT' ? 'ouder' : 'leerling'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <HouseholdSetup />
      )}

      <div className="mt-6 flex gap-2">
        <Link
          href="/vakken"
          className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
        >
          Vakken
        </Link>
        <Link
          href="/taken"
          className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
        >
          Taken
        </Link>
      </div>

      <form action="/auth/signout" method="post" className="mt-6">
        <button className="text-sm text-gray-500 underline">Uitloggen</button>
      </form>
    </main>
  )
}

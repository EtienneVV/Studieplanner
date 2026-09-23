import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SubjectManager from './subject-manager'

export default async function VakkenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)

  const householdId = memberships?.[0]?.household_id

  if (!householdId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <p>Je hebt nog geen gezin. <Link href="/" className="underline">Terug</Link></p>
      </main>
    )
  }

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, color, active')
    .order('name')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <h1 className="mt-2 text-2xl font-semibold">Vakken</h1>
      <p className="mt-1 text-sm text-gray-500">
        Voeg de vakken van Zoe toe. Daarna kun je er taken aan koppelen.
      </p>
      <SubjectManager householdId={householdId} initialSubjects={subjects ?? []} />
    </main>
  )
}

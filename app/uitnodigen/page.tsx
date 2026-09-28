import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import UitnodigManager from './uitnodig-manager'

export default async function UitnodigenPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: eigenLidmaatschap } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle()

  const householdId = eigenLidmaatschap?.household_id
  const isParent = eigenLidmaatschap?.role === 'PARENT'

  if (!householdId) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
        <p className="mt-4">Je hebt nog geen gezin.</p>
      </main>
    )
  }

  if (!isParent) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
        <p className="mt-4">Alleen een ouder kan gezinsleden uitnodigen.</p>
      </main>
    )
  }

  const { data: uitnodigingen } = await supabase
    .from('household_invitations')
    .select('id, token, role, created_at, expires_at, used_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <h1 className="mt-2 text-2xl font-semibold">Gezinslid uitnodigen</h1>
      <p className="mt-1 text-sm text-gray-500">
        Maak een uitnodigingslink aan en deel die met je kind of partner.
      </p>

      <UitnodigManager
        householdId={householdId}
        initialUitnodigingen={uitnodigingen ?? []}
      />
    </main>
  )
}
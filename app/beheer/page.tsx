import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LedenManager from './leden-manager'

export default async function BeheerPage() {
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
        <p className="mt-4">Alleen een ouder kan het gezin beheren.</p>
      </main>
    )
  }

  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .maybeSingle()

  const { data: leden } = await supabase
    .from('household_members')
    .select('user_id, role, status')
    .eq('household_id', householdId)
    .order('role', { ascending: true })

  const ledenIds = (leden ?? []).map((l) => l.user_id)

  const { data: profielen } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ledenIds.length > 0 ? ledenIds : ['00000000-0000-0000-0000-000000000000'])

  // E-mailadres ophalen als fallback voor accounts zonder profiel
  // (bijv. handmatig aangemaakt via Supabase Authentication, of nog
  // nooit ingelogd geweest zodat er geen profielnaam is ingevuld).
  const { data: emailData } = await supabase.rpc('get_household_member_emails', {
    p_household_id: householdId,
  })

  const naamVan = (id: string) =>
    profielen?.find((p) => p.user_id === id)?.display_name ?? null

  const emailVan = (id: string) =>
    (emailData ?? []).find((e: any) => e.user_id === id)?.email ?? null

  const leden_met_naam = (leden ?? []).map((l) => {
    const naam = naamVan(l.user_id)
    const email = emailVan(l.user_id)
    return {
      user_id: l.user_id,
      role: l.role,
      status: l.status,
      display_name: naam ?? email ?? 'Onbekend',
      email,
      isJezelf: l.user_id === user.id,
    }
  })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <h1 className="mt-2 text-2xl font-semibold">Gezin beheren</h1>
      <p className="mt-1 text-sm text-gray-500">
        {household?.name} &middot; {leden_met_naam.length} lid/leden
      </p>

      <LedenManager
        householdId={householdId}
        initialLeden={leden_met_naam}
      />
    </main>
  )
}
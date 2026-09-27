import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ModuleManager from './module-manager'

export default async function TrainingPage() {
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
        <p className="mt-4">Je hebt nog geen gezin. Maak er eerst een aan op de homepage.</p>
      </main>
    )
  }

  // Actieve gezinsleden ophalen (voor de "voor wie" keuze en om namen te tonen)
  const { data: leden } = await supabase
    .from('household_members')
    .select('user_id, role')
    .eq('household_id', householdId)
    .eq('status', 'ACTIVE')

  const ledenIds = (leden ?? []).map((l) => l.user_id)

  const { data: profielen } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', ledenIds.length > 0 ? ledenIds : ['00000000-0000-0000-0000-000000000000'])

  const naamVan = (id: string) =>
    profielen?.find((p) => p.user_id === id)?.display_name ?? 'Onbekend'

  const leden_met_naam = (leden ?? []).map((l) => ({
    user_id: l.user_id,
    role: l.role,
    display_name: naamVan(l.user_id),
  }))

  // Modules ophalen. RLS bepaalt al wat zichtbaar mag zijn:
  // eigen modules, of (als ouder) modules van actieve gezinsleden.
  const { data: modules } = await supabase
    .from('training_modules')
    .select('id, title, owner_user_id, side_1_label, side_2_label, created_at')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true })

  const modules_met_naam = (modules ?? []).map((m) => ({
    ...m,
    owner_naam: naamVan(m.owner_user_id),
  }))

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <h1 className="mt-2 text-2xl font-semibold">Training</h1>
      <p className="mt-1 text-sm text-gray-500">
        Maak flashcard-modules om woordjes of begrippen te oefenen en te toetsen.
      </p>

      <ModuleManager
        householdId={householdId}
        currentUserId={user.id}
        isParent={isParent}
        leden={leden_met_naam}
        initialModules={modules_met_naam}
      />
    </main>
  )
}
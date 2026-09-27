import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import CardManager from './card-manager'

export default async function ModulePage({
  params,
}: {
  params: Promise<{ moduleId: string }>
}) {
  const { moduleId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: module } = await supabase
    .from('training_modules')
    .select('id, title, side_1_label, side_2_label, owner_user_id, household_id')
    .eq('id', moduleId)
    .maybeSingle()

  // RLS levert null als de module niet bestaat of niet toegankelijk is
  if (!module) notFound()

  const { data: kaartjes } = await supabase
    .from('training_cards')
    .select('id, side_1_text, side_2_text, created_at')
    .eq('module_id', moduleId)
    .order('created_at', { ascending: true })

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/training" className="text-sm text-gray-500 underline">Terug naar training</Link>
      <h1 className="mt-2 text-2xl font-semibold">{module.title}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {module.side_1_label} &rarr; {module.side_2_label}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={'/training/' + moduleId + '/oefenen'}
          className="rounded-lg bg-black px-4 py-2 font-medium text-white"
        >
          Oefenen
        </Link>
        <Link
          href={'/training/' + moduleId + '/toets'}
          className="rounded-lg border px-4 py-2 font-medium hover:bg-gray-50"
        >
          Toetsen
        </Link>
      </div>

      <CardManager
        moduleId={moduleId}
        side1Label={module.side_1_label}
        side2Label={module.side_2_label}
        initialCards={kaartjes ?? []}
      />
    </main>
  )
}
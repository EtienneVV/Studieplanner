import { createClient } from '@/lib/supabase-server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import OefenManager from './oefen-manager'

export default async function OefenPage({
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
    .select('id, title, side_1_label, side_2_label')
    .eq('id', moduleId)
    .maybeSingle()

  if (!module) notFound()

  const { data: kaartjes } = await supabase
    .from('training_cards')
    .select('id, side_1_text, side_2_text')
    .eq('module_id', moduleId)

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={'/training/' + moduleId} className="text-sm text-gray-500 underline">
        Terug naar {module.title}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Oefenen &mdash; {module.title}</h1>

      {(!kaartjes || kaartjes.length === 0) ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-gray-500">
          Deze module heeft nog geen kaartjes. Voeg er eerst een paar toe.
        </p>
      ) : (
        <OefenManager
          moduleId={moduleId}
          side1Label={module.side_1_label}
          side2Label={module.side_2_label}
          cards={kaartjes}
        />
      )}
    </main>
  )
}
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TaskManager from './task-manager'

export default async function TakenPage() {
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
    .select('id, name, color')
    .eq('active', true)
    .order('name')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, notes, task_type, subject_id')
    .order('title')

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <h1 className="mt-2 text-2xl font-semibold">Taken</h1>
      <p className="mt-1 text-sm text-gray-500">
        Wat moet er gedaan worden per vak. Inplannen doe je later op het weekbord.
      </p>

      {(!subjects || subjects.length === 0) ? (
        <p className="mt-6 rounded-lg border p-4 text-sm text-gray-500">
          Voeg eerst vakken toe via <Link href="/vakken" className="underline">Vakken beheren</Link>.
        </p>
      ) : (
        <TaskManager
          householdId={householdId}
          subjects={subjects}
          initialTasks={tasks ?? []}
        />
      )}
    </main>
  )
}

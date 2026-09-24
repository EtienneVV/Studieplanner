import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WeekBoard from './week-board'
import { mondayOf, addDays, toISODate } from './week-utils'

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const start = params.start ? new Date(params.start) : mondayOf(new Date())
  const monday = mondayOf(start)
  const sunday = addDays(monday, 6)

  const { data: memberships } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)

  const householdId = memberships?.[0]?.household_id

  if (!householdId) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p>Je hebt nog geen gezin. <Link href="/" className="underline">Terug</Link></p>
      </main>
    )
  }

  const { data: student } = await supabase
    .from('student_profiles')
    .select('id')
    .limit(1)
    .maybeSingle()

  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name, color')
    .eq('active', true)
    .order('name')

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, subject_id, task_type, assessment_id')
    .order('title')

  const { data: blocks } = await supabase
    .from('study_blocks')
    .select('id, task_id, planned_date, duration_minutes, status, position_key')
    .or('planned_date.is.null,and(planned_date.gte.' + toISODate(monday) + ',planned_date.lte.' + toISODate(sunday) + ')')
    .order('position_key')

  const { data: alleToetsen } = await supabase
    .from('assessments')
    .select('id, title, date, weight, syllabus, date_confidence, subject_id')
    .order('date', { ascending: true, nullsFirst: false })

  const inDeWeek = (alleToetsen ?? []).filter(
    (a) => a.date && a.date >= toISODate(monday) && a.date <= toISODate(sunday)
  )

  const komende = (alleToetsen ?? [])
    .filter((a) => a.date && a.date > toISODate(sunday))
    .slice(0, 5)

  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-gray-500 underline">Terug</Link>
      <WeekBoard
        householdId={householdId}
        studentId={student?.id ?? null}
        mondayISO={toISODate(monday)}
        subjects={subjects ?? []}
        tasks={tasks ?? []}
        blocks={blocks ?? []}
        assessments={inDeWeek}
        komende={komende}
        alleToetsen={alleToetsen ?? []}
      />
    </main>
  )
}

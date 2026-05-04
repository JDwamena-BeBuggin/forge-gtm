import { db } from '@/lib/db/client'
import { sequences, sequenceSteps, sequenceEnrollments } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SequencesClient } from '@/components/sequences-client'

async function getData() {
  const [seqs, steps, enrollCounts] = await Promise.all([
    db.select().from(sequences).orderBy(sequences.createdAt),
    db.select().from(sequenceSteps),
    db
      .select({
        sequenceId: sequenceEnrollments.sequenceId,
        active: sql<number>`count(*) filter (where status = 'active')::int`,
        total: sql<number>`count(*)::int`,
      })
      .from(sequenceEnrollments)
      .groupBy(sequenceEnrollments.sequenceId),
  ])
  const countMap = Object.fromEntries(enrollCounts.map((c) => [c.sequenceId, c]))
  return seqs.map((s) => ({
    ...s,
    steps: steps.filter((st) => st.sequenceId === s.id).sort((a, b) => a.stepOrder - b.stepOrder),
    activeEnrollments: countMap[s.id]?.active ?? 0,
    totalEnrollments: countMap[s.id]?.total ?? 0,
  }))
}

export default async function SequencesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const data = await getData()
  return <SequencesClient sequences={data} />
}

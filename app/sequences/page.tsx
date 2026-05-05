import { db } from '@/lib/db/client'
import { sequences, sequenceSteps, sequenceEnrollments } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { SequencesClient } from '@/components/sequences-client'
import { hasClerkRuntimeEnv, hasDatabaseRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'
import { SetupState } from '@/components/setup-state'

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

function getDemoSequences() {
  const now = new Date()
  return [
    {
      id: 'demo-seq-1',
      name: 'Warm Intro Follow-up',
      description: 'Three-step sequence for recent warm leads.',
      isActive: true,
      createdAt: now,
      updatedAt: now,
      steps: [
        {
          id: 'demo-step-1',
          sequenceId: 'demo-seq-1',
          stepOrder: 1,
          delayDays: 0,
          subjectPrompt: 'Personal intro referencing the lead company',
          bodyPrompt: 'Short, relevant intro with one clear CTA',
          sendWindowStart: '09:00',
          sendWindowEnd: '16:00',
          timezone: 'America/New_York',
        },
      ],
      activeEnrollments: 8,
      totalEnrollments: 12,
    },
  ]
}

export default async function SequencesPage() {
  const authDisabled = isAuthDisabled()
  if (!authDisabled && !hasClerkRuntimeEnv()) {
    return <SetupState title="Sequences view is waiting on auth setup" />
  }

  if (!authDisabled) {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')
  }
  const data = hasDatabaseRuntimeEnv() ? await getData().catch(() => getDemoSequences()) : getDemoSequences()
  return <SequencesClient sequences={data} />
}

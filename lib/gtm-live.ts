import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { subDays } from 'date-fns'
import { db } from '@/lib/db/client'
import { emails, leads, replies, sequenceEnrollments, sequences } from '@/lib/db/schema'
import { hasDatabaseRuntimeEnv } from '@/lib/runtime-env'
import type { GtmStatus } from '@/lib/utils'

const QUALIFIED_STATUSES = ['qualified', 'demo', 'proposal', 'closed_won'] as const
const ACTIVE_STATUSES = ['contacted', 'engaged', 'qualified', 'demo', 'proposal'] as const

function asInt(value: unknown) {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

function percent(part: number, total: number) {
  if (!total) return 0
  return Math.round((part / total) * 100)
}

function safeName(firstName: string | null, lastName: string | null, email: string) {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim()
  return full || email
}

function daysAgo(date: Date | null | undefined) {
  if (!date) return null
  const diffMs = Date.now() - date.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

export async function getLiveGtmSnapshot() {
  if (!hasDatabaseRuntimeEnv()) return null

  const since7d = subDays(new Date(), 7)
  const since14d = subDays(new Date(), 14)
  const since30d = subDays(new Date(), 30)

  try {
    const [
      totals,
      byStatus,
      bySegment,
      priorityLeadRows,
      enrichmentRows,
      activeSequenceCount,
      enrollmentCount,
      emailStats,
      unreadReplies,
    ] = await Promise.all([
      db
        .select({
          totalLeads: sql<number>`count(*)::int`,
          newThisWeek: sql<number>`count(*) filter (where ${leads.createdAt} >= ${since7d})::int`,
          qualifiedPipeline: sql<number>`count(*) filter (where ${inArray(leads.gtmStatus, [...QUALIFIED_STATUSES])})::int`,
          engagedAccounts: sql<number>`count(*) filter (where ${or(isNotNull(leads.lastContactedAt), sql`${leads.totalEmailsSent} > 0`)})::int`,
          dormantLeads: sql<number>`count(*) filter (where ${and(isNull(leads.lastContactedAt), lte(leads.createdAt, since30d))})::int`,
          weeklyMovement: sql<number>`count(*) filter (where ${and(gte(leads.updatedAt, since7d), ne(leads.gtmStatus, 'new'))})::int`,
          researchComplete: sql<number>`count(*) filter (where ${or(isNotNull(leads.enrichedAt), isNotNull(leads.researchUpdatedAt), isNotNull(leads.researchNotes))})::int`,
          missingCompany: sql<number>`count(*) filter (where ${isNull(leads.company)})::int`,
          missingTitle: sql<number>`count(*) filter (where ${isNull(leads.title)})::int`,
          missingWebsite: sql<number>`count(*) filter (where ${isNull(leads.website)})::int`,
          missingLinkedin: sql<number>`count(*) filter (where ${isNull(leads.linkedinUrl)})::int`,
          atRiskAccounts: sql<number>`count(*) filter (where ${and(inArray(leads.gtmStatus, [...ACTIVE_STATUSES]), sql`${leads.totalReplies} = 0`, sql`${leads.lastContactedAt} is not null`, sql`${leads.lastContactedAt} < ${since14d}`)})::int`,
        })
        .from(leads),
      db
        .select({
          status: leads.gtmStatus,
          count: sql<number>`count(*)::int`,
        })
        .from(leads)
        .groupBy(leads.gtmStatus)
        .orderBy(desc(sql`count(*)`)),
      db
        .select({
          segment: sql<string>`coalesce(${leads.segment}, 'Unsegmented')`,
          leads: sql<number>`count(*)::int`,
          qualified: sql<number>`count(*) filter (where ${inArray(leads.gtmStatus, [...QUALIFIED_STATUSES])})::int`,
          researched: sql<number>`count(*) filter (where ${or(isNotNull(leads.enrichedAt), isNotNull(leads.researchUpdatedAt), isNotNull(leads.researchNotes))})::int`,
          contacted: sql<number>`count(*) filter (where ${or(isNotNull(leads.lastContactedAt), sql`${leads.totalEmailsSent} > 0`)})::int`,
          avgDealValue: sql<number>`coalesce(avg(${leads.dealValue}), 0)::float`,
        })
        .from(leads)
        .groupBy(sql`coalesce(${leads.segment}, 'Unsegmented')`)
        .orderBy(desc(sql`count(*)`))
        .limit(6),
      db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          email: leads.email,
          company: leads.company,
          title: leads.title,
          segment: leads.segment,
          gtmStatus: leads.gtmStatus,
          totalEmailsSent: leads.totalEmailsSent,
          totalReplies: leads.totalReplies,
          lastContactedAt: leads.lastContactedAt,
          researchNotes: leads.researchNotes,
          dealValue: leads.dealValue,
        })
        .from(leads)
        .orderBy(
          desc(sql`${leads.totalReplies}`),
          desc(sql`${leads.dealValue}`),
          asc(sql`case when ${leads.lastContactedAt} is null then 0 else 1 end`),
          desc(leads.updatedAt),
        )
        .limit(6),
      db
        .select({
          id: leads.id,
          firstName: leads.firstName,
          lastName: leads.lastName,
          email: leads.email,
          company: leads.company,
          title: leads.title,
          segment: leads.segment,
          gtmStatus: leads.gtmStatus,
          linkedinUrl: leads.linkedinUrl,
          website: leads.website,
          researchNotes: leads.researchNotes,
        })
        .from(leads)
        .where(
          or(
            isNull(leads.company),
            isNull(leads.title),
            isNull(leads.website),
            isNull(leads.linkedinUrl),
            isNull(leads.researchNotes),
          ),
        )
        .orderBy(
          desc(sql`case when ${leads.company} is null then 1 else 0 end + case when ${leads.title} is null then 1 else 0 end + case when ${leads.website} is null then 1 else 0 end + case when ${leads.linkedinUrl} is null then 1 else 0 end + case when ${leads.researchNotes} is null then 1 else 0 end`),
          desc(leads.updatedAt),
        )
        .limit(6),
      db.select({ count: sql<number>`count(*)::int` }).from(sequences).where(eq(sequences.isActive, true)),
      db.select({ count: sql<number>`count(*)::int` }).from(sequenceEnrollments),
      db
        .select({
          sent: sql<number>`count(*) filter (where ${emails.status} = 'sent')::int`,
          drafts: sql<number>`count(*) filter (where ${emails.status} = 'draft')::int`,
          opens: sql<number>`coalesce(sum(${emails.openCount}), 0)::int`,
          replies: sql<number>`count(*) filter (where ${isNotNull(emails.repliedAt)})::int`,
        })
        .from(emails),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(replies)
        .where(eq(replies.isRead, false)),
    ])

    const totalLeads = asInt(totals[0]?.totalLeads)
    const researchComplete = asInt(totals[0]?.researchComplete)
    const totalSent = asInt(emailStats[0]?.sent)
    const totalReplies = asInt(emailStats[0]?.replies)
    const totalOpens = asInt(emailStats[0]?.opens)

    return {
      overview: {
        totalLeads,
        newThisWeek: asInt(totals[0]?.newThisWeek),
        qualifiedPipeline: asInt(totals[0]?.qualifiedPipeline),
        enrichmentCoverage: percent(researchComplete, totalLeads),
        avgLeadScore: null,
        weeklyMovement: asInt(totals[0]?.weeklyMovement),
        dormantLeads: asInt(totals[0]?.dormantLeads),
        engagedAccounts: asInt(totals[0]?.engagedAccounts),
        atRiskAccounts: asInt(totals[0]?.atRiskAccounts),
      },
      analyticsCards: [
        {
          label: 'Total Leads',
          value: totalLeads.toLocaleString(),
          detail: `${asInt(totals[0]?.newThisWeek).toLocaleString()} added in the last 7 days`,
        },
        {
          label: 'Research Complete',
          value: researchComplete.toLocaleString(),
          detail: `${percent(researchComplete, totalLeads)}% of the lead base is enrichment-ready`,
        },
        {
          label: 'Qualified Pipeline',
          value: asInt(totals[0]?.qualifiedPipeline).toLocaleString(),
          detail: `${percent(asInt(totals[0]?.qualifiedPipeline), totalLeads)}% of leads are in qualified+ stages`,
        },
        {
          label: 'Weekly Movement',
          value: asInt(totals[0]?.weeklyMovement).toLocaleString(),
          detail: `${asInt(totals[0]?.engagedAccounts).toLocaleString()} leads show contact activity`,
        },
      ],
      segments: bySegment.map((segment) => {
        const leadCount = asInt(segment.leads)
        const qualified = asInt(segment.qualified)
        const researched = asInt(segment.researched)
        return {
          name: segment.segment,
          leads: leadCount,
          qualifiedRate: percent(qualified, leadCount),
          enrichmentCoverage: percent(researched, leadCount),
          engagedRate: percent(asInt(segment.contacted), leadCount),
          avgDealValue: Math.round(asInt(segment.avgDealValue)),
        }
      }),
      insights: [
        `${bySegment[0]?.segment ?? 'Your top segment'} currently holds the largest lead concentration in the database.`,
        `${percent(researchComplete, totalLeads)}% enrichment coverage means ${Math.max(totalLeads - researchComplete, 0).toLocaleString()} leads still need deeper context before they are GTM-ready.`,
        `${asInt(totals[0]?.atRiskAccounts).toLocaleString()} active leads appear at risk because they were contacted but have not replied in the last two weeks.`,
      ],
      priorityLeads: priorityLeadRows.map((lead) => ({
        id: lead.id,
        name: safeName(lead.firstName, lead.lastName, lead.email),
        email: lead.email,
        company: lead.company || 'Unknown company',
        title: lead.title || 'Title missing',
        segment: lead.segment || 'Unsegmented',
        status: lead.gtmStatus as GtmStatus,
        score: lead.totalReplies > 0 ? 95 : lead.totalEmailsSent > 0 ? 78 : 62,
        fit: (lead.dealValue && Number(lead.dealValue) >= 10000 ? 'A' : lead.company ? 'B' : 'C') as 'A' | 'B' | 'C',
        intent: (lead.totalReplies > 0 ? 'High' : lead.totalEmailsSent > 0 ? 'Medium' : 'Low') as 'High' | 'Medium' | 'Low',
        lastTouched: lead.lastContactedAt ? `${daysAgo(lead.lastContactedAt)}d ago` : null,
        enrichmentState: (lead.researchNotes ? 'ready' : lead.company && lead.title ? 'queued' : 'missing') as 'ready' | 'queued' | 'missing',
        nextBestAction: lead.totalReplies > 0
          ? 'Review the reply and move this account forward.'
          : lead.totalEmailsSent > 0
            ? 'Decide whether this lead needs a follow-up or deeper research.'
            : 'Complete enrichment before activating outreach.',
      })),
      enrichmentQueue: enrichmentRows.map((lead) => {
        const missing = [
          !lead.company ? 'Company' : null,
          !lead.title ? 'Title' : null,
          !lead.website ? 'Website' : null,
          !lead.linkedinUrl ? 'LinkedIn' : null,
          !lead.researchNotes ? 'Research notes' : null,
        ].filter(Boolean) as string[]

        return {
          company: lead.company || safeName(lead.firstName, lead.lastName, lead.email),
          missing,
          priority: missing.length >= 4 ? 'High' : 'Medium',
          reason: `${safeName(lead.firstName, lead.lastName, lead.email)} still needs ${missing.length} key data points before it is fully GTM-ready.`,
        }
      }),
      outreachSummary: {
        activeSequences: asInt(activeSequenceCount[0]?.count),
        enrolledLeads: asInt(enrollmentCount[0]?.count),
        replyRate: totalSent ? Number(((totalReplies / totalSent) * 100).toFixed(1)) : 0,
        openRate: totalSent ? Number(((totalOpens / totalSent) * 100).toFixed(1)) : 0,
        drafts: asInt(emailStats[0]?.drafts),
        unreadReplies: asInt(unreadReplies[0]?.count),
      },
      statusBreakdown: byStatus,
    }
  } catch {
    return null
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { leads, emails, replies } from '@/lib/db/schema'
import { sql, and, gte } from 'drizzle-orm'
import { requireAuth } from '@/lib/auth'
import { subDays } from 'date-fns'

export const revalidate = 60 // Cache for 60 seconds

export async function GET(_req: NextRequest) {
  const { error } = requireAuth()
  if (error) return error

  const since30d = subDays(new Date(), 30)

  const [statusCounts, totals, recentSends, recentReplies] = await Promise.all([
    db.select({
      status: leads.gtmStatus,
      count: sql<number>`count(*)::int`,
    }).from(leads).groupBy(leads.gtmStatus),

    db.select({
      totalLeads: sql<number>`count(*)::int`,
      totalSent: sql<number>`sum(total_emails_sent)::int`,
      totalOpens: sql<number>`sum(total_opens)::int`,
      totalClicks: sql<number>`sum(total_clicks)::int`,
      totalReplies: sql<number>`sum(total_replies)::int`,
    }).from(leads),

    db.select({ count: sql<number>`count(*)::int` }).from(emails)
      .where(and(gte(emails.sentAt, since30d), sql`status = 'sent'`)),

    db.select({ count: sql<number>`count(*)::int` }).from(replies)
      .where(gte(replies.receivedAt, since30d)),
  ])

  const sentCount = recentSends[0]?.count ?? 0
  const replyCount = recentReplies[0]?.count ?? 0
  const t = totals[0]

  const byStatus = Object.fromEntries(statusCounts.map((r) => [r.status, r.count]))

  return NextResponse.json({
    byStatus,
    totals: {
      leads: t?.totalLeads ?? 0,
      sent: t?.totalSent ?? 0,
      opens: t?.totalOpens ?? 0,
      clicks: t?.totalClicks ?? 0,
      replies: t?.totalReplies ?? 0,
    },
    last30d: {
      sent: sentCount,
      replies: replyCount,
      replyRate: sentCount > 0 ? ((replyCount / sentCount) * 100).toFixed(1) : '0',
      openRate: sentCount > 0 && t ? (((t.totalOpens ?? 0) / sentCount) * 100).toFixed(1) : '0',
    },
  })
}

import { db } from '@/lib/db/client'
import { replies, leads } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { formatRelative } from '@/lib/utils'
import { hasClerkRuntimeEnv, hasDatabaseRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'
import { SetupState } from '@/components/setup-state'

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-green-50 text-green-700',
  neutral: 'bg-zinc-100 text-zinc-600',
  negative: 'bg-red-50 text-red-600',
  ooo: 'bg-blue-50 text-blue-700',
  unsubscribe: 'bg-orange-50 text-orange-700',
  referral: 'bg-purple-50 text-purple-700',
}

export default async function InboxPage() {
  const authDisabled = isAuthDisabled()
  if (!authDisabled && !hasClerkRuntimeEnv()) {
    return <SetupState title="Inbox is waiting on auth setup" />
  }

  if (!authDisabled) {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')
  }
  const rows = hasDatabaseRuntimeEnv()
    ? await db
      .select({
        id: replies.id,
        subject: replies.subject,
        bodyText: replies.bodyText,
        fromAddress: replies.fromAddress,
        receivedAt: replies.receivedAt,
        sentiment: replies.sentiment,
        isRead: replies.isRead,
        leadFirstName: leads.firstName,
        leadLastName: leads.lastName,
        leadCompany: leads.company,
      })
      .from(replies)
      .leftJoin(leads, eq(replies.leadId, leads.id))
      .orderBy(desc(replies.receivedAt))
      .limit(100)
      .catch(() => [])
    : []
  const unread = rows.filter((r) => !r.isRead).length
  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-serif font-light">Inbox</h1>
        <p className="text-sm text-[#6b6560] mt-0.5">{unread} unread · {rows.length} total replies</p>
      </div>
      {rows.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-lg font-serif font-light text-[#9b9589]">No replies yet</p>
          <p className="text-sm text-[#9b9589] mt-1">Replies will appear here once leads respond to your emails</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className={`bg-white rounded-xl border p-5 transition-colors ${r.isRead ? 'border-[#e8e4dc]' : 'border-[#c2410c]/30 bg-[#fff9f7]'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-[#1a1814] truncate">
                      {r.leadFirstName
                        ? `${r.leadFirstName} ${r.leadLastName ?? ''}`.trim()
                        : r.fromAddress}
                    </p>
                    {r.leadCompany && <span className="text-xs text-[#9b9589]">· {r.leadCompany}</span>}
                    {!r.isRead && <span className="w-2 h-2 rounded-full bg-[#c2410c] flex-shrink-0" />}
                  </div>
                  {r.subject && <p className="text-sm text-[#3a362e] font-medium mb-1">{r.subject}</p>}
                  <p className="text-sm text-[#6b6560] line-clamp-2">{r.bodyText}</p>
                </div>
                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-xs text-[#9b9589]">{formatRelative(r.receivedAt)}</span>
                  {r.sentiment && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${SENTIMENT_STYLES[r.sentiment] ?? 'bg-zinc-100 text-zinc-600'}`}>
                      {r.sentiment}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

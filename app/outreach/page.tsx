import Link from 'next/link'
import { Mail, MessageSquare, Send, Workflow } from 'lucide-react'
import { demoOutreachSummary } from '@/lib/gtm-demo'
import { getLiveGtmSnapshot } from '@/lib/gtm-live'

export const dynamic = 'force-dynamic'

export default async function OutreachPage() {
  const liveSnapshot = await getLiveGtmSnapshot()
  const outreachSummary = liveSnapshot?.outreachSummary ?? demoOutreachSummary
  const queueNote = liveSnapshot
    ? `${liveSnapshot.outreachSummary.unreadReplies} unread replies and ${liveSnapshot.outreachSummary.drafts} draft emails are waiting for review.`
    : ''

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9b9589]">Action Layer</p>
        <h1 className="mt-2 font-serif text-4xl font-light text-[#1a1814]">Outreach</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6560]">
          Outreach is intentionally secondary here. The GTM hub should decide who matters first, then this page helps translate that into coordinated messaging.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><Workflow size={18} /> <span className="text-xs uppercase tracking-wide">Active sequences</span></div>
          <p className="font-serif text-3xl font-light">{outreachSummary.activeSequences}</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><Send size={18} /> <span className="text-xs uppercase tracking-wide">Enrolled</span></div>
          <p className="font-serif text-3xl font-light">{outreachSummary.enrolledLeads}</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><Mail size={18} /> <span className="text-xs uppercase tracking-wide">Open rate</span></div>
          <p className="font-serif text-3xl font-light">{outreachSummary.openRate}%</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><MessageSquare size={18} /> <span className="text-xs uppercase tracking-wide">Reply rate</span></div>
          <p className="font-serif text-3xl font-light">{outreachSummary.replyRate}%</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">Programs</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Sequence coordination</h2>
          <p className="mt-3 text-sm leading-6 text-[#6b6560]">
            Sequence logic still exists, but it should be fed by lead scoring, enrichment, and segment prioritization from the rest of the GTM hub.
          </p>
          <Link href="/sequences" className="mt-5 inline-flex rounded-lg bg-[#1a1814] px-4 py-2 text-sm text-white hover:bg-[#2a2620]">
            Open sequences
          </Link>
        </div>

        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">Replies</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Conversation monitoring</h2>
          <p className="mt-3 text-sm leading-6 text-[#6b6560]">
            Inbox remains the place to review direct responses, but it should not be the main control surface of the product.
          </p>
          <p className="mt-3 text-sm text-[#9b9589]">{queueNote}</p>
          <Link href="/inbox" className="mt-5 inline-flex rounded-lg border border-[#d4cfc5] px-4 py-2 text-sm text-[#1a1814] hover:bg-[#f0ede8]">
            Open inbox
          </Link>
        </div>
      </div>
    </div>
  )
}

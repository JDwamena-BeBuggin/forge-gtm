'use client'

import { useState, useEffect } from 'react'
import type { Lead, Email, Reply, Activity } from '@/lib/db/schema'
import { StatusPill } from '@/components/status-pill'
import { formatDate, formatRelative, GTM_STATUSES, STATUS_LABELS, type GtmStatus } from '@/lib/utils'
import { X, Sparkles, Mail, ChevronDown } from 'lucide-react'

type DetailData = {
  lead: Lead
  emails: Email[]
  replies: Reply[]
  activities: Activity[]
}

export function LeadDrawer({
  lead,
  onClose,
  onCompose,
}: {
  lead: Lead
  onClose: () => void
  onCompose: () => void
}) {
  const [data, setData] = useState<DetailData | null>(null)
  const [generatingResearch, setGeneratingResearch] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [editNotes, setEditNotes] = useState(lead.notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    fetch(`/api/leads/${lead.id}`)
      .then((r) => r.json())
      .then(setData)
  }, [lead.id])

  async function generateResearch() {
    setGeneratingResearch(true)
    const res = await fetch(`/api/leads/${lead.id}/research`, { method: 'POST' })
    const { researchNotes } = await res.json()
    setData((d) => d ? { ...d, lead: { ...d.lead, researchNotes } } : d)
    setGeneratingResearch(false)
  }

  async function updateStatus(newStatus: string) {
    setUpdatingStatus(true)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gtmStatus: newStatus }),
    })
    setData((d) => d ? { ...d, lead: { ...d.lead, gtmStatus: newStatus } } : d)
    setUpdatingStatus(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: editNotes }),
    })
    setSavingNotes(false)
  }

  const current = data?.lead ?? lead

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-[480px] bg-[#faf9f6] border-l border-[#e8e4dc] z-50 flex flex-col animate-slide-in overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-[#e8e4dc]">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-serif font-light truncate">
              {current.firstName || current.lastName
                ? `${current.firstName ?? ''} ${current.lastName ?? ''}`.trim()
                : current.email}
            </h2>
            <p className="text-sm text-[#9b9589] font-mono mt-0.5 truncate">{current.email}</p>
          </div>
          <button onClick={onClose} className="ml-4 p-1 rounded hover:bg-[#ece8de] text-[#9b9589]">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Quick actions */}
          <div className="flex gap-2">
            <button
              onClick={onCompose}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] transition-colors"
            >
              <Mail size={14} /> Compose Email
            </button>
            <button
              onClick={generateResearch}
              disabled={generatingResearch}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[#d4cfc5] rounded-lg hover:bg-[#ece8de] transition-colors disabled:opacity-50"
            >
              <Sparkles size={14} /> {generatingResearch ? 'Generating…' : 'Research'}
            </button>
          </div>

          {/* Status */}
          <Section title="Pipeline Status">
            <div className="flex items-center gap-2">
              <StatusPill status={current.gtmStatus as GtmStatus} />
              <select
                value={current.gtmStatus}
                disabled={updatingStatus}
                onChange={(e) => updateStatus(e.target.value)}
                className="text-sm border border-[#d4cfc5] rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
              >
                {GTM_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </Section>

          {/* Details */}
          <Section title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Detail label="Company" value={current.company} />
              <Detail label="Title" value={current.title} />
              <Detail label="Industry" value={current.industry} />
              <Detail label="Segment" value={current.segment} />
              <Detail label="Source" value={current.source} />
              <Detail label="Deal Value" value={current.dealValue ? `$${Number(current.dealValue).toLocaleString()}` : null} />
              <Detail label="Added" value={formatDate(current.createdAt)} />
              <Detail label="Last Contact" value={formatRelative(current.lastContactedAt)} />
            </dl>
            {current.linkedinUrl && (
              <a href={current.linkedinUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#c2410c] hover:underline mt-2 inline-block">
                LinkedIn ↗
              </a>
            )}
          </Section>

          {/* Engagement */}
          <Section title="Engagement">
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                { label: 'Sent', val: current.totalEmailsSent },
                { label: 'Opens', val: current.totalOpens },
                { label: 'Clicks', val: current.totalClicks },
                { label: 'Replies', val: current.totalReplies },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white rounded-lg border border-[#e8e4dc] py-3">
                  <p className="text-lg font-serif font-light">{val}</p>
                  <p className="text-xs text-[#9b9589]">{label}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Research notes */}
          <Section title="Research Notes">
            {current.researchNotes ? (
              <p className="text-sm text-[#3a362e] leading-relaxed whitespace-pre-line">{current.researchNotes}</p>
            ) : (
              <p className="text-sm text-[#9b9589] italic">No research yet. Click "Research" to generate.</p>
            )}
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={3}
              className="w-full text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
              placeholder="Add notes…"
            />
            <button
              onClick={saveNotes}
              disabled={savingNotes}
              className="mt-2 text-xs text-[#c2410c] hover:underline disabled:opacity-50"
            >
              {savingNotes ? 'Saving…' : 'Save notes'}
            </button>
          </Section>

          {/* Email thread */}
          {data && data.emails.length > 0 && (
            <Section title={`Emails (${data.emails.length})`}>
              <div className="space-y-3">
                {data.emails.map((e) => (
                  <div key={e.id} className="border border-[#e8e4dc] rounded-lg p-3 bg-white text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-[#1a1814] truncate">{e.subject}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        e.status === 'sent' ? 'bg-green-50 text-green-700' :
                        e.status === 'draft' ? 'bg-amber-50 text-amber-700' :
                        'bg-zinc-100 text-zinc-600'
                      }`}>{e.status}</span>
                    </div>
                    <p className="text-xs text-[#9b9589] mt-1">{formatRelative(e.sentAt ?? e.createdAt)}</p>
                    {e.openCount > 0 && <p className="text-xs text-emerald-600 mt-1">Opened {e.openCount}×</p>}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Replies */}
          {data && data.replies.length > 0 && (
            <Section title={`Replies (${data.replies.length})`}>
              <div className="space-y-3">
                {data.replies.map((r) => (
                  <div key={r.id} className="border border-[#e8e4dc] rounded-lg p-3 bg-white text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-[#9b9589]">{formatRelative(r.receivedAt)}</span>
                      {r.sentiment && (
                        <span className="text-xs px-1.5 py-0.5 bg-[#f0ede8] rounded">{r.sentiment}</span>
                      )}
                    </div>
                    <p className="text-[#3a362e] line-clamp-3">{r.bodyText}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </aside>
    </>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-[#9b9589] uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <>
      <dt className="text-[#9b9589]">{label}</dt>
      <dd className="text-[#1a1814] font-medium">{value ?? '—'}</dd>
    </>
  )
}

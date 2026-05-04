'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { Lead } from '@/lib/db/schema'
import { StatusPill } from '@/components/status-pill'
import { LeadDrawer } from '@/components/lead-drawer'
import { Composer } from '@/components/composer'
import { formatRelative, GTM_STATUSES, STATUS_LABELS, type GtmStatus } from '@/lib/utils'
import {
  Search, SlidersHorizontal, Upload, Plus, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react'

type PageData = {
  rows: Lead[]
  total: number
  page: number
  limit: number
  segments: string[]
}

export function LeadsClient({
  initialData,
  searchParams,
}: {
  initialData: PageData
  searchParams: Record<string, string | undefined>
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [composingFor, setComposingFor] = useState<Lead | null>(null)
  const [isPending, startTransition] = useTransition()

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams as Record<string, string>)
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page') // reset pagination on filter change
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  function toggleSort(col: string) {
    const current = searchParams.sort
    const order = searchParams.order
    if (current === col) {
      updateParam('order', order === 'asc' ? 'desc' : 'asc')
    } else {
      const params = new URLSearchParams(searchParams as Record<string, string>)
      params.set('sort', col)
      params.set('order', 'desc')
      params.delete('page')
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    }
  }

  function SortIcon({ col }: { col: string }) {
    if (searchParams.sort !== col) return <ArrowUpDown size={13} className="text-[#c9c3b8]" />
    return searchParams.order === 'asc'
      ? <ArrowUp size={13} className="text-[#c2410c]" />
      : <ArrowDown size={13} className="text-[#c2410c]" />
  }

  const totalPages = Math.ceil(initialData.total / initialData.limit)

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-light">Leads</h1>
          <p className="text-sm text-[#6b6560] mt-0.5">
            {initialData.total.toLocaleString()} total{searchParams.status ? ` · ${STATUS_LABELS[searchParams.status as GtmStatus] ?? searchParams.status}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => document.getElementById('csv-import')?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-[#d4cfc5] rounded-lg hover:bg-[#ece8de] transition-colors"
          >
            <Upload size={14} /> Import CSV
          </button>
          <input id="csv-import" type="file" accept=".csv,.xlsx" className="hidden" onChange={handleImport} />
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] transition-colors">
            <Plus size={14} /> Add Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b9589]" />
          <input
            type="text"
            defaultValue={searchParams.search ?? ''}
            placeholder="Search leads…"
            className="pl-9 pr-4 py-1.5 text-sm bg-white border border-[#d4cfc5] rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value || null)
            }}
          />
        </div>

        <select
          value={searchParams.status ?? ''}
          onChange={(e) => updateParam('status', e.target.value || null)}
          className="px-3 py-1.5 text-sm bg-white border border-[#d4cfc5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
        >
          <option value="">All statuses</option>
          {GTM_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {initialData.segments.length > 0 && (
          <select
            value={searchParams.segment ?? ''}
            onChange={(e) => updateParam('segment', e.target.value || null)}
            className="px-3 py-1.5 text-sm bg-white border border-[#d4cfc5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
          >
            <option value="">All segments</option>
            {initialData.segments.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {isPending && <span className="text-xs text-[#9b9589]">Loading…</span>}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#e8e4dc] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#e8e4dc] bg-[#faf9f6]">
              <Th onClick={() => toggleSort('firstName')} label="Name"><SortIcon col="firstName" /></Th>
              <Th onClick={() => toggleSort('company')} label="Company"><SortIcon col="company" /></Th>
              <Th label="Status" />
              <Th label="Segment" />
              <Th onClick={() => toggleSort('totalEmailsSent')} label="Sent"><SortIcon col="totalEmailsSent" /></Th>
              <Th onClick={() => toggleSort('lastContactedAt')} label="Last Contact"><SortIcon col="lastContactedAt" /></Th>
              <Th label="" />
            </tr>
          </thead>
          <tbody>
            {initialData.rows.map((lead) => (
              <tr
                key={lead.id}
                className="table-row border-b border-[#f0ede8] cursor-pointer"
                onClick={() => setSelectedLead(lead)}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-[#1a1814]">
                    {lead.firstName || lead.lastName
                      ? `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim()
                      : lead.email}
                  </p>
                  <p className="text-xs text-[#9b9589] font-mono">{lead.email}</p>
                </td>
                <td className="px-4 py-3 text-[#3a362e]">{lead.company ?? '—'}</td>
                <td className="px-4 py-3">
                  <StatusPill status={lead.gtmStatus as GtmStatus} />
                </td>
                <td className="px-4 py-3 text-[#9b9589]">
                  {lead.segment
                    ? <span className="px-2 py-0.5 bg-[#f0ede8] rounded text-xs">{lead.segment}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-[#6b6560]">{lead.totalEmailsSent}</td>
                <td className="px-4 py-3 text-[#9b9589] text-xs">{formatRelative(lead.lastContactedAt)}</td>
                <td className="px-4 py-3">
                  <button
                    onClick={(e) => { e.stopPropagation(); setComposingFor(lead) }}
                    className="px-2 py-1 text-xs bg-[#c2410c]/10 text-[#c2410c] rounded hover:bg-[#c2410c]/20 transition-colors"
                  >
                    Compose
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {initialData.rows.length === 0 && (
          <div className="py-16 text-center text-[#9b9589]">
            <p className="text-lg font-serif font-light">No leads found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-[#9b9589]">
            Page {initialData.page} of {totalPages} · {initialData.total.toLocaleString()} leads
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={initialData.page <= 1}
              onClick={() => updateParam('page', String(initialData.page - 1))}
              className="p-1.5 rounded hover:bg-[#ece8de] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={initialData.page >= totalPages}
              onClick={() => updateParam('page', String(initialData.page + 1))}
              className="p-1.5 rounded hover:bg-[#ece8de] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Lead Drawer */}
      {selectedLead && (
        <LeadDrawer lead={selectedLead} onClose={() => setSelectedLead(null)} onCompose={() => setComposingFor(selectedLead)} />
      )}

      {/* Email Composer */}
      {composingFor && (
        <Composer lead={composingFor} onClose={() => setComposingFor(null)} />
      )}
    </div>
  )
}

function Th({ label, children, onClick }: { label: string; children?: React.ReactNode; onClick?: () => void }) {
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-[#9b9589] uppercase tracking-wide cursor-pointer select-none"
      onClick={onClick}
    >
      <span className="flex items-center gap-1">
        {label} {children}
      </span>
    </th>
  )
}

async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0]
  if (!file) return
  // Client-side CSV parse → POST /api/leads/import
  const text = await file.text()
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'))
  const rows = lines.slice(1).map((line) => {
    const vals = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']))
  })

  const res = await fetch('/api/leads/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  })
  const data = await res.json()
  alert(`Imported ${data.inserted} leads, skipped ${data.skipped} duplicates`)
  window.location.reload()
}

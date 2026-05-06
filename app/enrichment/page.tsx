import { Sparkles, ScanSearch, ShieldCheck } from 'lucide-react'
import { demoEnrichmentQueue, demoLeads } from '@/lib/gtm-demo'
import { getLiveGtmSnapshot } from '@/lib/gtm-live'

export const dynamic = 'force-dynamic'

export default async function EnrichmentPage() {
  const liveSnapshot = await getLiveGtmSnapshot()
  const queue = liveSnapshot?.enrichmentQueue ?? demoEnrichmentQueue
  const leadRows = liveSnapshot?.priorityLeads ?? demoLeads
  const coverage = liveSnapshot?.overview.enrichmentCoverage ?? 68

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#9b9589]">Lead Intelligence</p>
          <h1 className="mt-2 font-serif text-4xl font-light text-[#1a1814]">Enrichment</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6560]">
            Use enrichment to close the gap between a raw contact list and a GTM-ready pipeline. This page surfaces what still needs to be known before sorting or acting on leads.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">Coverage target</p>
          <p className="mt-2 font-serif text-3xl font-light text-[#1a1814]">{coverage}%</p>
          <p className="text-sm text-[#6b6560]">current GTM-ready coverage</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Enrichment Queue</p>
              <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">What is blocking lead readiness</h2>
            </div>
            <Sparkles size={18} className="text-[#9b9589]" />
          </div>
          <div className="space-y-4">
            {queue.map((item) => (
              <div key={item.company} className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-[#1a1814]">{item.company}</p>
                    <p className="mt-1 text-sm text-[#6b6560]">{item.reason}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${
                    item.priority === 'High' ? 'bg-[#fff1eb] text-[#c2410c]' : 'bg-zinc-100 text-zinc-700'
                  }`}>
                    {item.priority} priority
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.missing.map((field) => (
                    <span key={field} className="rounded-full bg-white px-3 py-1 text-xs text-[#6b6560] border border-[#e8e4dc]">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Readiness Signals</p>
              <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Lead-by-lead context</h2>
            </div>
            <ScanSearch size={18} className="text-[#9b9589]" />
          </div>
          <div className="space-y-3">
            {leadRows.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-[#efeae1] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[#1a1814]">{lead.name}</p>
                    <p className="text-sm text-[#6b6560]">{lead.company} · {lead.segment}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs ${
                    lead.enrichmentState === 'ready'
                      ? 'bg-green-50 text-green-700'
                      : lead.enrichmentState === 'queued'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-red-50 text-red-700'
                  }`}>
                    {lead.enrichmentState}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-[#faf9f6] px-3 py-2">
                    <p className="uppercase tracking-wide text-[#9b9589]">Fit</p>
                    <p className="mt-1 font-medium text-[#1a1814]">{lead.fit}</p>
                  </div>
                  <div className="rounded-lg bg-[#faf9f6] px-3 py-2">
                    <p className="uppercase tracking-wide text-[#9b9589]">Intent</p>
                    <p className="mt-1 font-medium text-[#1a1814]">{lead.intent}</p>
                  </div>
                  <div className="rounded-lg bg-[#faf9f6] px-3 py-2">
                    <p className="uppercase tracking-wide text-[#9b9589]">Score</p>
                    <p className="mt-1 font-medium text-[#1a1814]">{lead.score}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[#dbe7ef] bg-[#f3f8fb] p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#2563eb]" />
              <p className="text-sm font-medium text-[#1a1814]">Enrichment rule</p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[#506173]">
              Leads should not move into qualified review until company data, buyer role, and enough personalization context are present.
            </p>
          </div>
        </section>
      </div>
    </div>
  )
}

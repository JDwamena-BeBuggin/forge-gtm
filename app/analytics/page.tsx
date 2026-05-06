import { BarChart3, Clock3, Filter, TrendingUp } from 'lucide-react'
import { demoOverview, demoSegments } from '@/lib/gtm-demo'
import { getLiveGtmSnapshot } from '@/lib/gtm-live'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const liveSnapshot = await getLiveGtmSnapshot()
  const overview = liveSnapshot?.overview ?? demoOverview
  const segments = liveSnapshot?.segments ?? demoSegments

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.22em] text-[#9b9589]">Decision Support</p>
        <h1 className="mt-2 font-serif text-4xl font-light text-[#1a1814]">Analytics</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6560]">
          Analytics is where you evaluate lead quality, segment performance, coverage, and pipeline pressure before deciding which programs deserve attention.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><Filter size={18} /> <span className="text-xs uppercase tracking-wide">Pipeline flow</span></div>
          <p className="font-serif text-3xl font-light">{overview.weeklyMovement}</p>
          <p className="mt-2 text-sm text-[#6b6560]">leads progressed this week</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><Clock3 size={18} /> <span className="text-xs uppercase tracking-wide">Dormant pool</span></div>
          <p className="font-serif text-3xl font-light">{overview.dormantLeads}</p>
          <p className="mt-2 text-sm text-[#6b6560]">leads without recent movement</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><BarChart3 size={18} /> <span className="text-xs uppercase tracking-wide">Coverage</span></div>
          <p className="font-serif text-3xl font-light">{overview.enrichmentCoverage}%</p>
          <p className="mt-2 text-sm text-[#6b6560]">research-complete lead base</p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
          <div className="mb-3 flex items-center gap-2 text-[#9b9589]"><TrendingUp size={18} /> <span className="text-xs uppercase tracking-wide">Risk</span></div>
          <p className="font-serif text-3xl font-light">{overview.atRiskAccounts}</p>
          <p className="mt-2 text-sm text-[#6b6560]">accounts likely to stall</p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">Segment Comparison</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Conversion strength by segment</h2>
          <div className="mt-5 space-y-4">
            {segments.map((segment) => (
              <div key={segment.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-[#1a1814]">{segment.name}</span>
                  <span className="text-[#6b6560]">{segment.qualifiedRate}% qualified</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[#f0ede8]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#c2410c] via-[#ea580c] to-[#f59e0b]"
                    style={{ width: `${Math.min(segment.qualifiedRate * 3, 100)}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[#9b9589]">
                  <span>{segment.leads} leads</span>
                  <span>{'engagedRate' in segment ? `${segment.engagedRate}% engaged` : `${segment.velocityDays} day velocity`}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">Interpretation</p>
          <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">What the numbers suggest</h2>
          <div className="mt-5 space-y-4 text-sm leading-6 text-[#3a362e]">
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              Your largest segment should get the first pass of cleanup and prioritization because it creates the biggest downstream leverage.
            </div>
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              If enrichment coverage stays below 80%, outreach metrics will remain noisy and harder to trust for decision-making.
            </div>
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              At-risk leads are the best place to add a reactivation or research-refresh workflow before launching more outbound volume.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

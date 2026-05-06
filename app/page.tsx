import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { BarChart3, Radar, Sparkles, Target, TrendingUp, Users } from 'lucide-react'
import { StatusPill } from '@/components/status-pill'
import { SetupState } from '@/components/setup-state'
import { demoAnalyticsCards, demoInsights, demoLeads, demoOverview, demoSegments } from '@/lib/gtm-demo'
import { hasClerkRuntimeEnv, isAuthDisabled } from '@/lib/runtime-env'

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-[#e8e4dc] bg-white p-5">
      <div className="mb-3 flex items-center gap-2 text-[#9b9589]">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="font-serif text-3xl font-light text-[#1a1814]">{value}</p>
      <p className="mt-2 text-sm text-[#6b6560]">{detail}</p>
    </div>
  )
}

export default async function DashboardPage() {
  const authDisabled = isAuthDisabled()
  if (!authDisabled && !hasClerkRuntimeEnv()) {
    return (
      <SetupState
        title="Authentication still needs to be finalized"
        description="Forge GTM is deployed, but Clerk is not booting correctly in production yet. Once the live Clerk keys are available to the worker, the dashboard will load normally."
      />
    )
  }

  if (!authDisabled) {
    const { userId } = await auth()
    if (!userId) redirect('/sign-in')
  }

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      {authDisabled && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Test mode is enabled. Authentication is temporarily bypassed while the GTM hub is being validated.
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-[#9b9589]">GTM Command Center</p>
          <h1 className="mt-2 font-serif text-4xl font-light text-[#1a1814]">Lead intelligence first, outreach second.</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#6b6560]">
            Forge GTM is now centered on lead quality, enrichment coverage, pipeline movement, and segment performance so the team knows where to focus before sending anything.
          </p>
        </div>
        <div className="rounded-2xl border border-[#e8e4dc] bg-white px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-[#9b9589]">This week</p>
          <p className="mt-2 font-serif text-3xl font-light text-[#1a1814]">{demoOverview.weeklyMovement}</p>
          <p className="text-sm text-[#6b6560]">leads moved forward in pipeline</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {demoAnalyticsCards.map((card, idx) => (
          <MetricCard
            key={card.label}
            icon={[
              <Users key="users" size={18} />,
              <Sparkles key="sparkles" size={18} />,
              <Target key="target" size={18} />,
              <TrendingUp key="trend" size={18} />,
            ][idx]}
            label={card.label}
            value={card.value}
            detail={card.detail}
          />
        ))}
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Segment Performance</p>
              <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Where pipeline quality is actually coming from</h2>
            </div>
            <BarChart3 size={18} className="text-[#9b9589]" />
          </div>
          <div className="space-y-4">
            {demoSegments.map((segment) => (
              <div key={segment.name} className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-[#1a1814]">{segment.name}</p>
                    <p className="text-xs text-[#9b9589]">{segment.leads} active leads</p>
                  </div>
                  <span className="rounded-full bg-[#1a1814] px-2.5 py-1 text-xs text-white">
                    {segment.avgScore} avg score
                  </span>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#9b9589]">Qualified rate</p>
                    <p className="mt-1 font-serif text-xl font-light">{segment.qualifiedRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#9b9589]">Velocity</p>
                    <p className="mt-1 font-serif text-xl font-light">{segment.velocityDays}d</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[#9b9589]">Recommendation</p>
                    <p className="mt-1 text-sm text-[#3a362e]">
                      {segment.qualifiedRate >= 20 ? 'Double down on this segment.' : 'Needs stronger enrichment and qualification.'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">GTM Radar</p>
              <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Signals that need action</h2>
            </div>
            <Radar size={18} className="text-[#9b9589]" />
          </div>
          <div className="space-y-4">
            {demoInsights.map((insight) => (
              <div key={insight} className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4 text-sm leading-6 text-[#3a362e]">
                {insight}
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-xl border border-[#ead5c7] bg-[#fff4ed] p-4">
            <p className="text-xs uppercase tracking-wide text-[#9b9589]">Current focus</p>
            <p className="mt-2 text-sm leading-6 text-[#7a3412]">
              Enrichment coverage is trailing lead growth. Fixing research completeness will likely improve qualified conversion faster than adding more outbound volume.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-[#9b9589]">Priority Leads</p>
            <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">Who should the team work next</h2>
          </div>
          <div className="space-y-3">
            {demoLeads.map((lead) => (
              <div key={lead.id} className="rounded-xl border border-[#efeae1] p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#1a1814]">{lead.name}</p>
                      <StatusPill status={lead.status} />
                    </div>
                    <p className="mt-1 text-sm text-[#6b6560]">{lead.title} at {lead.company}</p>
                    <p className="mt-1 text-xs font-mono text-[#9b9589]">{lead.email}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm lg:w-[320px]">
                    <div className="rounded-lg bg-[#faf9f6] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-[#9b9589]">Lead score</p>
                      <p className="mt-1 font-serif text-xl font-light">{lead.score}</p>
                    </div>
                    <div className="rounded-lg bg-[#faf9f6] px-3 py-2">
                      <p className="text-[11px] uppercase tracking-wide text-[#9b9589]">Intent</p>
                      <p className="mt-1 font-medium text-[#1a1814]">{lead.intent}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[#3a362e]">{lead.nextBestAction}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e8e4dc] bg-white p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-wide text-[#9b9589]">Coverage Snapshot</p>
            <h2 className="mt-1 font-serif text-2xl font-light text-[#1a1814]">What the GTM system knows</h2>
          </div>
          <div className="space-y-4">
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Qualified pipeline</p>
              <p className="mt-2 font-serif text-3xl font-light">{demoOverview.qualifiedPipeline}</p>
              <p className="mt-1 text-sm text-[#6b6560]">accounts ready for closer review or outreach orchestration</p>
            </div>
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Enrichment coverage</p>
              <p className="mt-2 font-serif text-3xl font-light">{demoOverview.enrichmentCoverage}%</p>
              <p className="mt-1 text-sm text-[#6b6560]">of leads have enough data for segmentation and personalization</p>
            </div>
            <div className="rounded-xl border border-[#efeae1] bg-[#faf9f6] p-4">
              <p className="text-xs uppercase tracking-wide text-[#9b9589]">Dormant leads</p>
              <p className="mt-2 font-serif text-3xl font-light">{demoOverview.dormantLeads}</p>
              <p className="mt-1 text-sm text-[#6b6560]">accounts that need reactivation logic or cleanup</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

import type { GtmStatus } from './utils'

export type DemoLead = {
  id: string
  name: string
  email: string
  company: string
  title: string
  segment: string
  status: GtmStatus
  score: number
  fit: 'A' | 'B' | 'C'
  intent: 'High' | 'Medium' | 'Low'
  lastTouched: string | null
  enrichmentState: 'ready' | 'queued' | 'missing'
  nextBestAction: string
}

export const demoLeads: DemoLead[] = [
  {
    id: 'lead-ava-morgan',
    name: 'Ava Morgan',
    email: 'ava@northstarhq.com',
    company: 'Northstar HQ',
    title: 'VP Growth',
    segment: 'SaaS',
    status: 'engaged',
    score: 92,
    fit: 'A',
    intent: 'High',
    lastTouched: 'Today',
    enrichmentState: 'ready',
    nextBestAction: 'Prioritize for AE follow-up',
  },
  {
    id: 'lead-leo-chen',
    name: 'Leo Chen',
    email: 'leo@brightforge.ai',
    company: 'Brightforge AI',
    title: 'Founder',
    segment: 'AI',
    status: 'queued',
    score: 81,
    fit: 'A',
    intent: 'Medium',
    lastTouched: null,
    enrichmentState: 'queued',
    nextBestAction: 'Finish enrichment before outreach',
  },
  {
    id: 'lead-maya-james',
    name: 'Maya James',
    email: 'maya@harborops.com',
    company: 'Harbor Ops',
    title: 'Revenue Operations Lead',
    segment: 'Services',
    status: 'researching',
    score: 74,
    fit: 'B',
    intent: 'Medium',
    lastTouched: '2d ago',
    enrichmentState: 'missing',
    nextBestAction: 'Pull firmographic data and buyer context',
  },
  {
    id: 'lead-sam-irving',
    name: 'Sam Irving',
    email: 'sam@trailstack.io',
    company: 'Trailstack',
    title: 'Head of Partnerships',
    segment: 'SaaS',
    status: 'qualified',
    score: 88,
    fit: 'A',
    intent: 'High',
    lastTouched: 'Yesterday',
    enrichmentState: 'ready',
    nextBestAction: 'Move into qualified pipeline review',
  },
]

export const demoOverview = {
  totalLeads: 135,
  qualifiedPipeline: 23,
  enrichmentCoverage: 68,
  avgLeadScore: 76,
  weeklyMovement: 14,
  dormantLeads: 19,
  engagedAccounts: 28,
  atRiskAccounts: 7,
}

export const demoSegments = [
  { name: 'SaaS', leads: 52, qualifiedRate: 24, avgScore: 81, velocityDays: 12 },
  { name: 'AI', leads: 31, qualifiedRate: 19, avgScore: 77, velocityDays: 16 },
  { name: 'Services', leads: 28, qualifiedRate: 14, avgScore: 71, velocityDays: 20 },
  { name: 'Fintech', leads: 24, qualifiedRate: 11, avgScore: 69, velocityDays: 23 },
]

export const demoEnrichmentQueue = [
  {
    company: 'Brightforge AI',
    missing: ['Employee count', 'Tech stack', 'Recent funding'],
    priority: 'High',
    reason: 'Founder persona with strong ICP fit but incomplete firmographics',
  },
  {
    company: 'Harbor Ops',
    missing: ['Buyer seniority', 'Website signals'],
    priority: 'Medium',
    reason: 'Researching stage lead blocked by weak contact intelligence',
  },
  {
    company: 'Signal Port',
    missing: ['LinkedIn', 'Intent activity', 'Pain-point notes'],
    priority: 'High',
    reason: 'Large account cluster with no personalization context',
  },
]

export const demoInsights = [
  'Lead quality is strongest in SaaS and AI, but Services has the largest enrichment gap.',
  'Qualified conversion is being limited more by incomplete research than by outreach volume.',
  'Dormant lead count suggests the GTM team needs better reactivation views, not more sequences.',
]

export const demoAnalyticsCards = [
  { label: 'New This Week', value: '18', detail: 'up 22% week over week' },
  { label: 'Research Complete', value: '91', detail: '68% of total lead base' },
  { label: 'Qualified Rate', value: '17%', detail: 'best in SaaS at 24%' },
  { label: 'Pipeline Velocity', value: '16d', detail: 'median from new to qualified' },
]

export const demoOutreachSummary = {
  activeSequences: 4,
  enrolledLeads: 39,
  replyRate: 14.3,
  openRate: 46.4,
}

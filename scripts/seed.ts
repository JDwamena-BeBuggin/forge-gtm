/**
 * Seed the leads table with sample data.
 * Usage: pnpm seed  (or npx tsx scripts/seed.ts)
 *
 * Set DATABASE_URL in .env.local before running.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'

const SAMPLE_LEADS = [
  // General segment
  { email: 'sarah.chen@techflow.io', firstName: 'Sarah', lastName: 'Chen', company: 'TechFlow', title: 'VP of Product', industry: 'SaaS', segment: 'general', source: 'seed' },
  { email: 'marcus.williams@growthlab.com', firstName: 'Marcus', lastName: 'Williams', company: 'GrowthLab', title: 'CEO', industry: 'Marketing', segment: 'general', source: 'seed' },
  { email: 'priya.patel@cloudnine.ai', firstName: 'Priya', lastName: 'Patel', company: 'CloudNine AI', title: 'Co-founder', industry: 'AI/ML', segment: 'general', source: 'seed' },
  { email: 'james.rodriguez@scalehub.com', firstName: 'James', lastName: 'Rodriguez', company: 'ScaleHub', title: 'Head of Sales', industry: 'B2B SaaS', segment: 'general', source: 'seed' },
  { email: 'emma.davis@fundcraft.io', firstName: 'Emma', lastName: 'Davis', company: 'FundCraft', title: 'Founder', industry: 'Fintech', segment: 'general', source: 'seed' },

  // E-commerce segment
  { email: 'ryan.kim@shoplift.co', firstName: 'Ryan', lastName: 'Kim', company: 'Shoplift', title: 'Head of Growth', industry: 'E-Commerce', segment: 'ecommerce', source: 'seed' },
  { email: 'jessica.brown@cartridge.shop', firstName: 'Jessica', lastName: 'Brown', company: 'Cartridge', title: 'CMO', industry: 'E-Commerce', segment: 'ecommerce', source: 'seed' },
  { email: 'alex.turner@merch-ops.com', firstName: 'Alex', lastName: 'Turner', company: 'MerchOps', title: 'Operations Lead', industry: 'E-Commerce', segment: 'ecommerce', source: 'seed' },

  // MRR $500+ segment
  { email: 'lisa.nguyen@recur.ly', firstName: 'Lisa', lastName: 'Nguyen', company: 'RecurSoft', title: 'CEO', industry: 'Subscription SaaS', segment: 'mrr_500', source: 'seed', dealValue: '12000' },
  { email: 'david.park@subscriptionco.io', firstName: 'David', lastName: 'Park', company: 'SubscriptionCo', title: 'CTO', industry: 'SaaS', segment: 'mrr_500', source: 'seed', dealValue: '8400' },
  { email: 'anna.johnson@recurrentapp.com', firstName: 'Anna', lastName: 'Johnson', company: 'RecurrentApp', title: 'Founder', industry: 'B2B SaaS', segment: 'mrr_500', source: 'seed', dealValue: '15600' },

  // Sports camps segment
  { email: 'coach.mike@elitesportz.com', firstName: 'Mike', lastName: 'Thompson', company: 'Elite Sportz', title: 'Director', industry: 'Sports', segment: 'sports_camps', source: 'seed' },
  { email: 'samantha.lee@campchamps.org', firstName: 'Samantha', lastName: 'Lee', company: 'Camp Champs', title: 'Program Manager', industry: 'Youth Sports', segment: 'sports_camps', source: 'seed' },
  { email: 'greg.foster@youthathlete.io', firstName: 'Greg', lastName: 'Foster', company: 'Youth Athlete', title: 'Owner', industry: 'Sports Training', segment: 'sports_camps', source: 'seed' },

  // Construction segment
  { email: 'bob.mason@buildright.com', firstName: 'Bob', lastName: 'Mason', company: 'BuildRight', title: 'President', industry: 'Construction', segment: 'construction', source: 'seed' },
  { email: 'carol.walsh@wallworks.co', firstName: 'Carol', lastName: 'Walsh', company: 'WallWorks', title: 'GM', industry: 'Construction', segment: 'construction', source: 'seed' },
  { email: 'tony.nguyen@structureplus.com', firstName: 'Tony', lastName: 'Nguyen', company: 'StructurePlus', title: 'VP Operations', industry: 'Construction', segment: 'construction', source: 'seed' },
]

async function seed() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')

  const sqlClient = neon(url)
  const db = drizzle(sqlClient, { schema })

  console.log(`Seeding ${SAMPLE_LEADS.length} leads…`)

  for (const lead of SAMPLE_LEADS) {
    const [inserted] = await db
      .insert(schema.leads)
      .values(lead as typeof schema.leads.$inferInsert)
      .onConflictDoNothing()
      .returning({ id: schema.leads.id })

    if (inserted) {
      await db.insert(schema.activities).values({
        leadId: inserted.id,
        type: 'imported',
        metadata: { source: 'seed' },
      })
      console.log(`  ✓ ${lead.email}`)
    } else {
      console.log(`  – ${lead.email} (already exists)`)
    }
  }

  console.log('Done.')
  process.exit(0)
}

seed().catch((e) => {
  console.error(e)
  process.exit(1)
})

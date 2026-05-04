import Anthropic from '@anthropic-ai/sdk'
import type { Lead, SequenceStep, Email } from './db/schema'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `You write concise, professional 1:1 outreach emails.
Rules:
- 80-150 words total
- No mail-merge placeholders, no "{{name}}" syntax
- Personal opener referencing the research
- One clear ask
- Plain text style, no marketing voice
- Sign off as [Your Name]`

export async function generateEmail(
  lead: Lead,
  step: SequenceStep,
  priorEmails: Email[] = [],
  customPrompt?: string,
): Promise<{ subject: string; body: string; model: string; prompt: string }> {
  const priorThreadText = priorEmails.length
    ? priorEmails
        .map((e) => `--- ${e.sentAt?.toISOString() ?? 'unsent'} ---\nSubject: ${e.subject}\n${e.bodyText ?? ''}`)
        .join('\n\n')
    : 'None'

  const userPrompt = `Write step ${step.stepOrder} of a sequence for this lead.

LEAD:
- Name: ${lead.firstName ?? ''} ${lead.lastName ?? ''}
- Company: ${lead.company ?? 'Unknown'}
- Industry: ${lead.industry ?? 'Unknown'}
- Segment: ${lead.segment ?? 'Unknown'}
- Title: ${lead.title ?? 'Unknown'}

RESEARCH:
${lead.researchNotes ?? 'No research available.'}

PRIOR EMAILS IN THREAD:
${priorThreadText}

INSTRUCTION:
${customPrompt ?? step.bodyPrompt}

Return ONLY valid JSON: { "subject": "...", "body": "..." }`

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Claude returned non-JSON response')
  const parsed = JSON.parse(jsonMatch[0]) as { subject: string; body: string }

  return {
    subject: parsed.subject,
    body: parsed.body,
    model: 'claude-sonnet-4-6',
    prompt: userPrompt,
  }
}

export async function generateResearch(lead: Lead): Promise<string> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Write a 2-3 sentence research brief for a sales outreach targeting this lead.
Focus on their company's likely pain points and how to position an outreach.

Lead:
- Name: ${lead.firstName ?? ''} ${lead.lastName ?? ''}
- Company: ${lead.company ?? 'Unknown'}
- Title: ${lead.title ?? 'Unknown'}
- Industry: ${lead.industry ?? 'Unknown'}
- Website: ${lead.website ?? 'Unknown'}
- Segment: ${lead.segment ?? 'Unknown'}

Be concise, specific, and actionable. No bullet points — write flowing prose.`,
      },
    ],
  })

  return msg.content[0].type === 'text' ? msg.content[0].text : ''
}

export async function classifySentiment(
  subject: string,
  body: string,
): Promise<'positive' | 'neutral' | 'negative' | 'ooo' | 'unsubscribe' | 'referral'> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    messages: [
      {
        role: 'user',
        content: `Classify this email reply sentiment. Return ONLY one word: positive, neutral, negative, ooo, unsubscribe, or referral.

Subject: ${subject}
Body: ${body.slice(0, 500)}`,
      },
    ],
  })

  const text = msg.content[0].type === 'text' ? msg.content[0].text.trim().toLowerCase() : 'neutral'
  const valid = ['positive', 'neutral', 'negative', 'ooo', 'unsubscribe', 'referral']
  return (valid.includes(text) ? text : 'neutral') as ReturnType<typeof classifySentiment> extends Promise<infer T> ? T : never
}

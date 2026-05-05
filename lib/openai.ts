import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { z } from 'zod'
import type { Email, Lead, SequenceStep } from './db/schema'

const EMAIL_MODEL = process.env.OPENAI_EMAIL_MODEL ?? 'gpt-4.1-mini'
const RESEARCH_MODEL = process.env.OPENAI_RESEARCH_MODEL ?? 'gpt-4.1-mini'
const SENTIMENT_MODEL = process.env.OPENAI_SENTIMENT_MODEL ?? 'gpt-4.1-mini'

const emailOutputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
})

const researchOutputSchema = z.object({
  researchNotes: z.string().min(1),
})

const sentimentOutputSchema = z.object({
  sentiment: z.enum(['positive', 'neutral', 'negative', 'ooo', 'unsubscribe', 'referral']),
})

const globalForOpenAI = globalThis as unknown as {
  forgeOpenAIClient?: OpenAI
}

function resolveApiKey(apiKey?: string) {
  const resolved = apiKey ?? process.env.OPENAI_API_KEY
  if (!resolved) throw new Error('OPENAI_API_KEY is not set')
  return resolved
}

export function createOpenAIClient(apiKey?: string) {
  return new OpenAI({ apiKey: resolveApiKey(apiKey) })
}

function getDefaultClient() {
  if (!globalForOpenAI.forgeOpenAIClient) {
    globalForOpenAI.forgeOpenAIClient = createOpenAIClient()
  }
  return globalForOpenAI.forgeOpenAIClient
}

function getClient(apiKey?: string) {
  return apiKey ? createOpenAIClient(apiKey) : getDefaultClient()
}

function buildEmailSystemPrompt(senderName?: string) {
  return [
    'You write concise, professional 1:1 outreach emails.',
    'Rules:',
    '- 80-150 words total',
    '- No mail-merge placeholders and no template tokens',
    '- Personal opener referencing the research when available',
    '- One clear ask',
    '- Plain text style and no marketing fluff',
    senderName ? `- Close naturally as ${senderName}` : '- End with a natural close and no fake signature',
  ].join('\n')
}

export async function generateEmail(
  lead: Lead,
  step: Pick<SequenceStep, 'stepOrder' | 'bodyPrompt'>,
  priorEmails: Email[] = [],
  customPrompt?: string,
  options?: {
    apiKey?: string
    senderName?: string
    model?: string
  },
): Promise<{ subject: string; body: string; model: string; prompt: string }> {
  const model = options?.model ?? EMAIL_MODEL
  const client = getClient(options?.apiKey)
  const priorThreadText = priorEmails.length
    ? priorEmails
        .map((email) =>
          `--- ${email.sentAt?.toISOString() ?? 'unsent'} ---\nSubject: ${email.subject}\n${email.bodyText ?? ''}`,
        )
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
${customPrompt ?? step.bodyPrompt}`

  const completion = await client.chat.completions.parse({
    model,
    temperature: 0.7,
    max_tokens: 700,
    messages: [
      { role: 'system', content: buildEmailSystemPrompt(options?.senderName) },
      { role: 'user', content: userPrompt },
    ],
    response_format: zodResponseFormat(emailOutputSchema, 'forge_gtm_email'),
  })

  const parsed = completion.choices[0]?.message?.parsed
  if (!parsed) throw new Error('OpenAI did not return a structured email draft')

  return {
    subject: parsed.subject.trim(),
    body: parsed.body.trim(),
    model,
    prompt: userPrompt,
  }
}

export async function generateResearch(
  lead: Lead,
  options?: { apiKey?: string; model?: string },
): Promise<string> {
  const model = options?.model ?? RESEARCH_MODEL
  const client = getClient(options?.apiKey)

  const completion = await client.chat.completions.parse({
    model,
    temperature: 0.4,
    max_tokens: 400,
    messages: [
      {
        role: 'system',
        content:
          'Write a concise 2-3 sentence research brief for outbound sales outreach. Focus on likely pain points, positioning angles, and the best practical opening.',
      },
      {
        role: 'user',
        content: `Lead:
- Name: ${lead.firstName ?? ''} ${lead.lastName ?? ''}
- Company: ${lead.company ?? 'Unknown'}
- Title: ${lead.title ?? 'Unknown'}
- Industry: ${lead.industry ?? 'Unknown'}
- Website: ${lead.website ?? 'Unknown'}
- Segment: ${lead.segment ?? 'Unknown'}`,
      },
    ],
    response_format: zodResponseFormat(researchOutputSchema, 'forge_gtm_research'),
  })

  const parsed = completion.choices[0]?.message?.parsed
  if (!parsed) throw new Error('OpenAI did not return structured research notes')
  return parsed.researchNotes.trim()
}

export async function classifySentiment(
  subject: string,
  body: string,
  options?: { apiKey?: string; model?: string },
): Promise<'positive' | 'neutral' | 'negative' | 'ooo' | 'unsubscribe' | 'referral'> {
  const model = options?.model ?? SENTIMENT_MODEL
  const client = getClient(options?.apiKey)

  const completion = await client.chat.completions.parse({
    model,
    temperature: 0,
    max_tokens: 80,
    messages: [
      {
        role: 'system',
        content:
          'Classify inbound outreach replies. Choose exactly one sentiment: positive, neutral, negative, ooo, unsubscribe, or referral.',
      },
      {
        role: 'user',
        content: `Subject: ${subject}\nBody:\n${body.slice(0, 4000)}`,
      },
    ],
    response_format: zodResponseFormat(sentimentOutputSchema, 'forge_gtm_sentiment'),
  })

  const parsed = completion.choices[0]?.message?.parsed
  if (!parsed) throw new Error('OpenAI did not return a structured sentiment classification')
  return parsed.sentiment
}

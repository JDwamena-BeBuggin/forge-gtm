'use client'

import { useState } from 'react'
import type { Lead } from '@/lib/db/schema'
import { X, Sparkles, Send, Save } from 'lucide-react'

export function Composer({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [generationModel, setGenerationModel] = useState('')
  const [generationPrompt, setGenerationPrompt] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sentEmailId, setSentEmailId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'compose' | 'preview'>('compose')

  async function generate() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/emails/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, customPrompt: customPrompt || undefined }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setSubject(data.subject)
      setBody(data.bodyText)
      setBodyHtml(data.bodyHtml)
      setGenerationModel(data.generationModel)
      setGenerationPrompt(data.generationPrompt)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function saveDraft() {
    if (!subject || !body) return
    setSaving(true)
    const res = await fetch('/api/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: lead.id,
        subject,
        bodyHtml,
        bodyText: body,
        generationModel,
        generationPrompt,
      }),
    })
    const email = await res.json()
    setSaving(false)
    onClose()
  }

  async function sendNow() {
    if (!subject || !body) return
    setSending(true)
    setError(null)
    try {
      // First save as draft, then send
      const saveRes = await fetch('/api/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, subject, bodyHtml, bodyText: body, generationModel, generationPrompt }),
      })
      const email = await saveRes.json()

      const sendRes = await fetch(`/api/emails/${email.id}/send`, { method: 'POST' })
      if (!sendRes.ok) throw new Error(await sendRes.text())
      setSentEmailId(email.id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  if (sentEmailId) {
    return (
      <>
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send size={20} className="text-green-600" />
            </div>
            <h3 className="font-serif text-xl mb-2">Email sent!</h3>
            <p className="text-sm text-[#9b9589] mb-6">Your email to {lead.email} is on its way.</p>
            <button onClick={onClose} className="px-6 py-2 bg-[#1a1814] text-white rounded-lg text-sm hover:bg-[#2a2620]">
              Done
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50 flex items-end sm:items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e4dc]">
            <div>
              <h2 className="font-serif text-lg">New Email</h2>
              <p className="text-xs text-[#9b9589] font-mono mt-0.5">
                To: {lead.firstName ? `${lead.firstName} ${lead.lastName ?? ''}` : lead.email} &lt;{lead.email}&gt;
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#f0ede8] text-[#9b9589]">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
            {/* AI generation */}
            <div className="bg-[#faf9f6] border border-[#e8e4dc] rounded-xl p-4">
              <p className="text-xs font-medium text-[#9b9589] uppercase tracking-wide mb-2">AI Generation</p>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Optional: add custom context (e.g. 'mention their recent product launch')"
                rows={2}
                className="w-full text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30 mb-3"
              />
              <button
                onClick={generate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-[#1a1814] text-white rounded-lg hover:bg-[#2a2620] disabled:opacity-50 transition-colors"
              >
                <Sparkles size={14} />
                {generating ? 'Generating with Claude…' : 'Generate Email'}
              </button>
              {generationModel && (
                <p className="text-xs text-[#9b9589] mt-2 font-mono">Generated by {generationModel}</p>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Tabs */}
            {(subject || body) && (
              <div>
                <div className="flex border-b border-[#e8e4dc] mb-4">
                  <button
                    onClick={() => setTab('compose')}
                    className={`px-4 py-2 text-sm ${tab === 'compose' ? 'border-b-2 border-[#c2410c] text-[#c2410c]' : 'text-[#9b9589] hover:text-[#1a1814]'}`}
                  >
                    Compose
                  </button>
                  <button
                    onClick={() => setTab('preview')}
                    className={`px-4 py-2 text-sm ${tab === 'preview' ? 'border-b-2 border-[#c2410c] text-[#c2410c]' : 'text-[#9b9589] hover:text-[#1a1814]'}`}
                  >
                    Preview
                  </button>
                </div>

                {tab === 'compose' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#9b9589] uppercase tracking-wide">Subject</label>
                      <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9b9589] uppercase tracking-wide">Body</label>
                      <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={10}
                        className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30 font-mono leading-relaxed"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="border border-[#e8e4dc] rounded-xl p-6 bg-white">
                    <p className="text-base font-medium mb-4">{subject}</p>
                    <div
                      className="text-sm text-[#3a362e] leading-relaxed whitespace-pre-line"
                      dangerouslySetInnerHTML={{ __html: bodyHtml || body.replace(/\n/g, '<br/>') }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#e8e4dc]">
            <button onClick={onClose} className="text-sm text-[#9b9589] hover:text-[#1a1814]">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={saveDraft}
                disabled={!subject || !body || saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-[#d4cfc5] rounded-lg hover:bg-[#f0ede8] disabled:opacity-40 transition-colors"
              >
                <Save size={14} /> {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button
                onClick={sendNow}
                disabled={!subject || !body || sending}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] disabled:opacity-40 transition-colors"
              >
                <Send size={14} /> {sending ? 'Sending…' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

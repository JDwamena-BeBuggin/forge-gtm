'use client'

import { useState } from 'react'
import type { Sequence, SequenceStep } from '@/lib/db/schema'
import { formatDate } from '@/lib/utils'
import { Plus, ChevronDown, ChevronRight, Users, Play, Pause } from 'lucide-react'

type SequenceWithMeta = Sequence & {
  steps: SequenceStep[]
  activeEnrollments: number
  totalEnrollments: number
}

export function SequencesClient({ sequences }: { sequences: SequenceWithMeta[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-serif font-light">Sequences</h1>
          <p className="text-sm text-[#6b6560] mt-0.5">{sequences.length} sequences</p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] transition-colors"
        >
          <Plus size={14} /> New Sequence
        </button>
      </div>

      {sequences.length === 0 && !creating ? (
        <div className="text-center py-20">
          <p className="text-lg font-serif font-light text-[#9b9589]">No sequences yet</p>
          <p className="text-sm text-[#9b9589] mt-1">Create a sequence to start automating your outreach</p>
          <button
            onClick={() => setCreating(true)}
            className="mt-6 px-6 py-2 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409]"
          >
            Create first sequence
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sequences.map((seq) => (
            <div key={seq.id} className="bg-white rounded-xl border border-[#e8e4dc] overflow-hidden">
              <button
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-[#faf9f6] transition-colors"
                onClick={() => setExpanded(expanded === seq.id ? null : seq.id)}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${seq.isActive ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[#1a1814]">{seq.name}</p>
                  {seq.description && (
                    <p className="text-sm text-[#9b9589] truncate">{seq.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-6 text-sm text-[#9b9589] flex-shrink-0">
                  <span>{seq.steps.length} step{seq.steps.length !== 1 ? 's' : ''}</span>
                  <span className="flex items-center gap-1">
                    <Users size={13} /> {seq.activeEnrollments} active
                  </span>
                  <span>{formatDate(seq.createdAt)}</span>
                  {expanded === seq.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
              </button>

              {expanded === seq.id && (
                <div className="border-t border-[#e8e4dc] px-6 py-5">
                  <h3 className="text-xs font-medium text-[#9b9589] uppercase tracking-wide mb-4">Steps</h3>
                  <div className="space-y-3">
                    {seq.steps.map((step, idx) => (
                      <div key={step.id} className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#f0ede8] flex items-center justify-center text-xs font-mono text-[#6b6560]">
                          {step.stepOrder}
                        </div>
                        <div className="flex-1 bg-[#faf9f6] rounded-lg p-4 border border-[#e8e4dc]">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-medium text-[#1a1814]">Step {step.stepOrder}</p>
                            <span className="text-xs text-[#9b9589] font-mono">
                              {step.delayDays === 0 ? 'Immediately' : `+${step.delayDays}d`}
                            </span>
                          </div>
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="text-xs text-[#9b9589] uppercase tracking-wide">Subject prompt</span>
                              <p className="text-[#3a362e] mt-0.5">{step.subjectPrompt}</p>
                            </div>
                            <div>
                              <span className="text-xs text-[#9b9589] uppercase tracking-wide">Body prompt</span>
                              <p className="text-[#3a362e] mt-0.5 line-clamp-2">{step.bodyPrompt}</p>
                            </div>
                          </div>
                          <p className="text-xs text-[#9b9589] mt-2 font-mono">
                            Window: {step.sendWindowStart ?? '09:00'}–{step.sendWindowEnd ?? '16:00'} {step.timezone}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 pt-4 border-t border-[#e8e4dc] flex items-center gap-3">
                    <EnrollButton sequenceId={seq.id} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {creating && <CreateSequenceModal onClose={() => setCreating(false)} onCreated={() => { setCreating(false); window.location.reload() }} />}
    </div>
  )
}

function EnrollButton({ sequenceId }: { sequenceId: string }) {
  const [enrolling, setEnrolling] = useState(false)
  const [leadIds, setLeadIds] = useState('')
  const [result, setResult] = useState<{ enrolled: number; skipped: number } | null>(null)

  async function enroll() {
    const ids = leadIds.split(',').map((s) => s.trim()).filter(Boolean)
    if (!ids.length) return
    setEnrolling(true)
    const res = await fetch(`/api/sequences/${sequenceId}/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadIds: ids }),
    })
    setResult(await res.json())
    setEnrolling(false)
    setLeadIds('')
  }

  return (
    <div className="flex items-center gap-2 w-full">
      <input
        value={leadIds}
        onChange={(e) => setLeadIds(e.target.value)}
        placeholder="Paste lead IDs (comma-separated) to enroll…"
        className="flex-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
      />
      <button
        onClick={enroll}
        disabled={enrolling || !leadIds.trim()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] disabled:opacity-50"
      >
        <Play size={13} /> {enrolling ? 'Enrolling…' : 'Enroll'}
      </button>
      {result && (
        <span className="text-xs text-[#9b9589]">✓ {result.enrolled} enrolled, {result.skipped} skipped</span>
      )}
    </div>
  )
}

function CreateSequenceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState([
    { stepOrder: 1, delayDays: 0, subjectPrompt: '', bodyPrompt: '' },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addStep() {
    setSteps((s) => [...s, { stepOrder: s.length + 1, delayDays: s.length * 3, subjectPrompt: '', bodyPrompt: '' }])
  }

  function updateStep(idx: number, field: string, value: string | number) {
    setSteps((s) => s.map((st, i) => i === idx ? { ...st, [field]: value } : st))
  }

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, steps }),
      })
      if (!res.ok) throw new Error(await res.text())
      onCreated()
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e8e4dc]">
          <h2 className="font-serif text-lg">New Sequence</h2>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[#f0ede8] text-[#9b9589]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="text-xs text-[#9b9589] uppercase tracking-wide">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cold Outreach — SaaS Founders"
              className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
            />
          </div>
          <div>
            <label className="text-xs text-[#9b9589] uppercase tracking-wide">Description (optional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#c2410c]/30"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-[#9b9589] uppercase tracking-wide">Steps</label>
              <button onClick={addStep} className="text-xs text-[#c2410c] hover:underline">+ Add step</button>
            </div>
            <div className="space-y-4">
              {steps.map((step, idx) => (
                <div key={idx} className="bg-[#faf9f6] rounded-xl border border-[#e8e4dc] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-medium">Step {step.stepOrder}</span>
                    <input
                      type="number"
                      value={step.delayDays}
                      onChange={(e) => updateStep(idx, 'delayDays', parseInt(e.target.value) || 0)}
                      className="w-16 text-sm border border-[#d4cfc5] rounded px-2 py-1 bg-white"
                    />
                    <span className="text-xs text-[#9b9589]">days after previous</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-[#9b9589]">Subject prompt</label>
                      <input
                        value={step.subjectPrompt}
                        onChange={(e) => updateStep(idx, 'subjectPrompt', e.target.value)}
                        placeholder="e.g. Write a subject referencing their company pain point"
                        className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#9b9589]">Body prompt</label>
                      <textarea
                        value={step.bodyPrompt}
                        onChange={(e) => updateStep(idx, 'bodyPrompt', e.target.value)}
                        placeholder="e.g. Write a cold intro email. Mention their industry and how we help similar companies. End with a soft ask for a 15-minute call."
                        rows={3}
                        className="w-full mt-1 text-sm border border-[#d4cfc5] rounded-lg px-3 py-2 bg-white resize-none focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#e8e4dc]">
          <button onClick={onClose} className="text-sm text-[#9b9589] hover:text-[#1a1814]">Cancel</button>
          <button
            onClick={save}
            disabled={!name.trim() || saving}
            className="px-5 py-2 text-sm bg-[#c2410c] text-white rounded-lg hover:bg-[#a83409] disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Sequence'}
          </button>
        </div>
      </div>
    </div>
  )
}

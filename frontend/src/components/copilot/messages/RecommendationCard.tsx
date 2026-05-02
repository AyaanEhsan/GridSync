'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Check, Edit3, Users, Clock, Zap } from 'lucide-react'
import { useCopilotStore } from '@/stores/copilotStore'
import type { Recommendation } from '@/lib/types'
import { formatTimestamp } from '@/lib/formatters'

interface RecommendationCardProps {
  messageId: string
  recommendation: Recommendation
  timestamp: number
}

export default function RecommendationCard({ messageId, recommendation, timestamp }: RecommendationCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedAction, setEditedAction] = useState(recommendation.action)
  const approveRecommendation = useCopilotStore((s) => s.approveRecommendation)
  const modifyRecommendation = useCopilotStore((s) => s.modifyRecommendation)

  const confPct = Math.round(recommendation.confidence * 100)
  const isApproved = recommendation.status === 'approved'
  const isModified = recommendation.status === 'modified'
  const isResolved = isApproved || isModified

  const handleApprove = () => {
    approveRecommendation(messageId)
  }

  const handleModifySubmit = () => {
    modifyRecommendation(messageId, { action: editedAction })
    setIsEditing(false)
  }

  return (
    <div
      className="mx-3 my-2 rounded-lg overflow-hidden"
      style={{
        background: isApproved
          ? 'linear-gradient(var(--bg-elevated), var(--bg-elevated)) padding-box, linear-gradient(135deg, var(--accent-green), var(--accent-cyan)) border-box'
          : isModified
          ? 'linear-gradient(var(--bg-elevated), var(--bg-elevated)) padding-box, linear-gradient(135deg, var(--accent-amber), var(--accent-cyan)) border-box'
          : 'linear-gradient(var(--bg-elevated), var(--bg-elevated)) padding-box, linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan)) border-box',
        border: '1px solid transparent',
      }}
    >
      <div className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] font-bold text-[var(--accent-indigo)] uppercase tracking-wide">
            WATT Recommendation
          </span>
          <span className="font-mono text-[10px] text-[var(--text-muted)]">
            {formatTimestamp(timestamp, 'HH:mm:ss')}
          </span>
        </div>

        {/* Situation */}
        <p className="font-mono text-[11px] text-[var(--text-secondary)] leading-relaxed mb-2">
          {recommendation.situation}
        </p>

        {/* Action */}
        {isEditing ? (
          <textarea
            value={editedAction}
            onChange={(e) => setEditedAction(e.target.value)}
            className="w-full font-mono text-xs bg-[var(--bg-tertiary)] border border-[var(--border-default)] rounded p-2 text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent-cyan)] mb-2"
            rows={3}
          />
        ) : (
          <div
            className="font-mono text-xs font-semibold text-[var(--text-primary)] leading-relaxed mb-3 p-2 rounded"
            style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.1)' }}
          >
            {isModified ? editedAction : recommendation.action}
          </div>
        )}

        {/* Confidence */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-[10px] text-[var(--text-muted)] w-20">Confidence</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--border-default)] overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confPct}%` }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="h-full rounded-full"
              style={{
                background: confPct >= 85 ? 'var(--accent-green)' : confPct >= 70 ? 'var(--accent-cyan)' : 'var(--accent-amber)',
              }}
            />
          </div>
          <span className="font-mono text-[10px] font-bold text-[var(--accent-cyan)] w-8 text-right">
            {confPct}%
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="flex flex-col items-center p-1.5 rounded bg-[var(--bg-tertiary)]">
            <Clock className="w-3 h-3 text-[var(--accent-cyan)] mb-0.5" />
            <span className="font-mono text-[9px] text-[var(--text-muted)]">Recovery</span>
            <span className="font-mono text-[10px] font-bold text-[var(--text-secondary)]">{recommendation.estimatedRecovery}</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded bg-[var(--bg-tertiary)]">
            <Zap className="w-3 h-3 text-[var(--accent-amber)] mb-0.5" />
            <span className="font-mono text-[9px] text-[var(--text-muted)]">Shed Risk</span>
            <span className="font-mono text-[10px] font-bold text-[var(--accent-amber)]">{recommendation.loadShedRisk}%</span>
          </div>
          <div className="flex flex-col items-center p-1.5 rounded bg-[var(--bg-tertiary)]">
            <Users className="w-3 h-3 text-[var(--accent-red)] mb-0.5" />
            <span className="font-mono text-[9px] text-[var(--text-muted)]">At Risk</span>
            <span className="font-mono text-[10px] font-bold text-[var(--accent-red)]">
              {(recommendation.customersAtRisk / 1000).toFixed(0)}k
            </span>
          </div>
        </div>

        {/* Action buttons */}
        <AnimatePresence mode="wait">
          {isResolved ? (
            <motion.div
              key="resolved"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 justify-center py-1.5"
            >
              <Check
                className="w-4 h-4"
                style={{ color: isApproved ? 'var(--accent-green)' : 'var(--accent-amber)' }}
              />
              <span
                className="font-mono text-xs font-bold"
                style={{ color: isApproved ? 'var(--accent-green)' : 'var(--accent-amber)' }}
              >
                {isApproved ? `Approved by ${recommendation.approvedBy}` : 'Modified & Logged'}
              </span>
            </motion.div>
          ) : isEditing ? (
            <motion.div
              key="editing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <button
                onClick={handleModifySubmit}
                className="flex-1 py-1.5 rounded text-xs font-mono font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-amber)' }}
              >
                Submit Modified
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="px-3 py-1.5 rounded text-xs font-mono text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="pending"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleApprove}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-mono font-semibold text-[var(--bg-primary)] transition-opacity hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-green)' }}
              >
                <Check className="w-3 h-3" />
                Approve
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                Modify
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

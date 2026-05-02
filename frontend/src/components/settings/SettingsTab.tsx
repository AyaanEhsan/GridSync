'use client'

import { useState } from 'react'
import { motion } from 'motion/react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Slider } from '@/components/ui/slider'
import StatusDot from '@/components/shared/StatusDot'
import { useUIStore } from '@/stores/uiStore'
import { useGridStore } from '@/stores/gridStore'

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-3 py-2 ${className ?? ''}`}>{children}</div>
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="font-mono text-xs text-[var(--text-secondary)]">{label}</span>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function ApiStatus({ name, connected = true, lastSync = '2 min ago', docCount }: {
  name: string; connected?: boolean; lastSync?: string; docCount?: number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <StatusDot status={connected ? 'online' : 'offline'} />
        <span className="font-mono text-xs text-[var(--text-secondary)]">{name}</span>
      </div>
      <div className="flex items-center gap-2">
        {docCount && <span className="font-mono text-[10px] text-[var(--text-muted)]">{docCount} docs</span>}
        <span className="font-mono text-[10px] text-[var(--text-muted)]">{lastSync}</span>
        <span
          className="font-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{
            color: connected ? 'var(--accent-green)' : 'var(--text-muted)',
            background: connected ? 'var(--accent-green-dim)' : 'var(--bg-elevated)',
          }}
        >
          {connected ? 'Connected' : 'Offline'}
        </span>
      </div>
    </div>
  )
}

export default function SettingsTab() {
  const { wattConfidenceThreshold, setWattConfidenceThreshold, theme, setTheme, chartAnimationsEnabled, setChartAnimationsEnabled } = useUIStore()
  const demoMode = useGridStore((s) => s.demoMode)
  const startDemo = useGridStore((s) => s.startDemo)
  const stopDemo = useGridStore((s) => s.stopDemo)
  const [freqThreshold, setFreqThreshold] = useState([0.05])
  const [loadThreshold, setLoadThreshold] = useState([5])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full overflow-auto"
    >
      <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
        <h2 className="font-mono text-sm font-bold text-[var(--text-primary)]">Settings</h2>
        <p className="font-mono text-[11px] text-[var(--text-muted)] mt-0.5">Configure WATT behavior and preferences</p>
      </div>

      <div className="px-4 py-2">
        <Accordion defaultValue={['watt', 'thresholds', 'sources']} className="space-y-1">

          {/* WATT Configuration */}
          <AccordionItem value="watt" className="border-[var(--border-subtle)]">
            <AccordionTrigger className="font-mono text-xs font-semibold text-[var(--text-primary)] hover:no-underline hover:text-[var(--accent-cyan)] py-3">
              WATT Configuration
            </AccordionTrigger>
            <AccordionContent>
              <Section>
                <SettingRow label={`Confidence threshold: ${wattConfidenceThreshold}%`}>
                  <div className="w-36">
                    <Slider
                      value={wattConfidenceThreshold}
                      onValueChange={(v) => setWattConfidenceThreshold(typeof v === 'number' ? v : Array.isArray(v) ? v[0] : wattConfidenceThreshold)}
                      min={40} max={95} step={5}
                      className="w-full"
                    />
                  </div>
                </SettingRow>

                <SettingRow label="Model">
                  <span className="font-mono text-xs text-[var(--accent-cyan)] bg-[var(--accent-cyan-dim)] px-2 py-0.5 rounded">
                    claude-sonnet-4-6
                  </span>
                </SettingRow>

                <SettingRow label="Active agents">
                  <div className="flex gap-1.5">
                    {['MONITOR', 'DIAGNOSE', 'DRAFT', 'ESCALATE'].map((a) => (
                      <span key={a} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent-indigo-dim)] text-[var(--accent-indigo)]">
                        {a}
                      </span>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow label="Looping incident simulation">
                  <button
                    onClick={() => (demoMode ? stopDemo() : startDemo())}
                    className="font-mono text-[11px] px-3 py-1.5 rounded font-semibold transition-all hover:opacity-90"
                    style={
                      demoMode
                        ? { background: 'var(--accent-red)', color: 'var(--bg-primary)' }
                        : { background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-cyan))', color: 'var(--bg-primary)' }
                    }
                  >
                    {demoMode ? 'Stop Demo' : 'Run Demo'}
                  </button>
                </SettingRow>
              </Section>
            </AccordionContent>
          </AccordionItem>

          {/* Alert Thresholds */}
          <AccordionItem value="thresholds" className="border-[var(--border-subtle)]">
            <AccordionTrigger className="font-mono text-xs font-semibold text-[var(--text-primary)] hover:no-underline hover:text-[var(--accent-cyan)] py-3">
              Alert Thresholds
            </AccordionTrigger>
            <AccordionContent>
              <Section>
                <SettingRow label={`Frequency deviation: ±${freqThreshold[0]} Hz`}>
                  <div className="w-36">
                    <Slider
                      value={freqThreshold[0]}
                      onValueChange={(v) => setFreqThreshold([typeof v === 'number' ? v : freqThreshold[0]])}
                      min={0.01} max={0.15} step={0.01}
                    />
                  </div>
                </SettingRow>
                <SettingRow label={`Load deviation: ±${loadThreshold[0]}%`}>
                  <div className="w-36">
                    <Slider
                      value={loadThreshold[0]}
                      onValueChange={(v) => setLoadThreshold([typeof v === 'number' ? v : loadThreshold[0]])}
                      min={1} max={15} step={1}
                    />
                  </div>
                </SettingRow>
                <SettingRow label="DC load warning">
                  <span className="font-mono text-xs text-[var(--accent-amber)]">800 MW</span>
                </SettingRow>
                <SettingRow label="DC load critical">
                  <span className="font-mono text-xs text-[var(--accent-red)]">1,200 MW</span>
                </SettingRow>
              </Section>
            </AccordionContent>
          </AccordionItem>

          {/* Data Sources */}
          <AccordionItem value="sources" className="border-[var(--border-subtle)]">
            <AccordionTrigger className="font-mono text-xs font-semibold text-[var(--text-primary)] hover:no-underline hover:text-[var(--accent-cyan)] py-3">
              Data Sources
            </AccordionTrigger>
            <AccordionContent>
              <Section>
                <ApiStatus name="GridStatus.io · ercot_load" connected lastSync="30s poll" />
                <ApiStatus name="GridStatus.io · ercot_fuel_mix" connected lastSync="5m poll" />
                <ApiStatus name="GridStatus.io · ercot/pjm LMP" connected lastSync="5m poll" />
                <ApiStatus name="Open-Meteo · weather (ERCOT)" connected lastSync="30m cache" />
                <div className="mt-2 p-2 rounded bg-[var(--accent-cyan-dim)] border border-[rgba(0,240,255,0.15)]">
                  <span className="font-mono text-[10px] text-[var(--accent-cyan)]">
                    GRIDSTATUS_API_KEY required in .env.local — see references/README.md
                  </span>
                </div>
              </Section>
            </AccordionContent>
          </AccordionItem>

          {/* Operator Profile */}
          <AccordionItem value="profile" className="border-[var(--border-subtle)]">
            <AccordionTrigger className="font-mono text-xs font-semibold text-[var(--text-primary)] hover:no-underline hover:text-[var(--accent-cyan)] py-3">
              Operator Profile
            </AccordionTrigger>
            <AccordionContent>
              <Section>
                <SettingRow label="Name"><span className="font-mono text-xs text-[var(--text-secondary)]">Maria K.</span></SettingRow>
                <SettingRow label="Shift"><span className="font-mono text-xs text-[var(--text-secondary)]">Night Shift</span></SettingRow>
                <SettingRow label="Certification"><span className="font-mono text-xs text-[var(--accent-green)]">NERC System Operator (Active)</span></SettingRow>
              </Section>
            </AccordionContent>
          </AccordionItem>

          {/* Display Preferences */}
          <AccordionItem value="display" className="border-[var(--border-subtle)]">
            <AccordionTrigger className="font-mono text-xs font-semibold text-[var(--text-primary)] hover:no-underline hover:text-[var(--accent-cyan)] py-3">
              Display Preferences
            </AccordionTrigger>
            <AccordionContent>
              <Section>
                <SettingRow label="Theme">
                  <div className="flex gap-1">
                    {(['dark', 'light'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTheme(t)}
                        className="font-mono text-[11px] h-7 px-2 rounded border transition-colors capitalize"
                        style={{
                          backgroundColor: theme === t ? 'var(--accent-cyan)' : 'transparent',
                          borderColor: theme === t ? 'var(--accent-cyan)' : 'var(--border-default)',
                          color: theme === t ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </SettingRow>

                <SettingRow label="Chart animations">
                  <button
                    onClick={() => setChartAnimationsEnabled(!chartAnimationsEnabled)}
                    className="font-mono text-[11px] px-2.5 py-1 rounded transition-colors"
                    style={{
                      backgroundColor: chartAnimationsEnabled ? 'var(--accent-green-dim)' : 'var(--bg-elevated)',
                      color: chartAnimationsEnabled ? 'var(--accent-green)' : 'var(--text-muted)',
                      border: `1px solid ${chartAnimationsEnabled ? 'rgba(0,230,118,0.3)' : 'var(--border-default)'}`,
                    }}
                  >
                    {chartAnimationsEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </SettingRow>
              </Section>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
      </div>
    </motion.div>
  )
}

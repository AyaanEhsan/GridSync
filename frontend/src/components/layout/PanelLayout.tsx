'use client'

import { useEffect } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'
import { AnimatePresence } from 'motion/react'
import { useUIStore } from '@/stores/uiStore'
import TabBar from './TabBar'
import CopilotPanel from '@/components/copilot/CopilotPanel'
import CollapsedPill from '@/components/copilot/CollapsedPill'
import TabContent from './TabContent'

export default function PanelLayout() {
  const copilotCollapsed = useUIStore((s) => s.copilotCollapsed)
  const setCopilotCollapsed = useUIStore((s) => s.setCopilotCollapsed)
  const panelRef = usePanelRef()

  useEffect(() => {
    if (copilotCollapsed) {
      panelRef.current?.collapse()
    } else {
      panelRef.current?.expand()
    }
  }, [copilotCollapsed]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 min-h-0 relative">
      <Group
        orientation="horizontal"
        className="h-full"
      >
        {/* Left panel */}
        <Panel
          id="left-panel"
          minSize="50%"
          defaultSize="68%"
          className="flex flex-col min-h-0"
        >
          <TabBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            <TabContent />
          </div>
        </Panel>

        {/* Resize handle */}
        <Separator
          className="w-[2px] bg-[var(--border-subtle)] hover:bg-[var(--accent-cyan)] transition-colors cursor-col-resize relative group"
        >
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-[var(--accent-cyan-dim)] transition-colors" />
        </Separator>

        {/* Right panel — Co-Pilot */}
        <Panel
          id="right-panel"
          panelRef={panelRef}
          collapsible
          collapsedSize="0%"
          minSize="0%"
          defaultSize="32%"
          onResize={(size) => {
            if (size.asPercentage < 2) {
              setCopilotCollapsed(true)
            } else if (size.asPercentage >= 2 && copilotCollapsed) {
              setCopilotCollapsed(false)
            }
          }}
          className="min-h-0"
        >
          <CopilotPanel />
        </Panel>
      </Group>

      {/* Floating pill when collapsed */}
      <AnimatePresence>
        {copilotCollapsed && <CollapsedPill />}
      </AnimatePresence>
    </div>
  )
}

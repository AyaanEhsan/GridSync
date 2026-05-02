'use client'

import CopilotHeader from './CopilotHeader'
import MessageStream from './MessageStream'
import CopilotInput from './CopilotInput'

export default function CopilotPanel() {
  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-[var(--border-subtle)]"
      style={{ backgroundColor: 'var(--bg-secondary)' }}
    >
      <CopilotHeader />
      <MessageStream />
      <CopilotInput />
    </div>
  )
}

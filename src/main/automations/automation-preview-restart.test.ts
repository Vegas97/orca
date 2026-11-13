import { expect, it } from 'vitest'
import { chatAutomationRunObservation } from './automation-chat-run-observation'

it('settles an unsent automation attempt retained as a draft after restart', () => {
  const observation = chatAutomationRunObservation(
    {
      sessionId: 'claude_chat',
      cursor: { epoch: 'epoch', sequence: 3 },
      items: [],
      submissions: [
        {
          clientMessageId: 'automation-prompt',
          fence: 1,
          payloadFingerprint: 'hash',
          dispatchState: 'rejected',
          providerItemId: null,
          reason: null,
          rejection: { kind: 'hostRestarted' },
          keptAsQueuedMessageId: 'automation-prompt',
          submittedAt: 1,
          resolvedAt: 2
        }
      ]
    },
    'automation-prompt',
    'Claude',
    {
      clientMessageId: 'automation-prompt',
      queued: { messageId: 'automation-prompt', position: 0, state: 'waiting' }
    }
  )

  expect(observation).toMatchObject({ status: 'dispatch_failed' })
})

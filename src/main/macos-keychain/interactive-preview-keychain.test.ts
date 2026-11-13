import { afterEach, describe, expect, it, vi } from 'vitest'
import { execSecurityCommand, readKeychainPassword } from './generic-password'

vi.mock('node:child_process', () => ({
  execFile: (
    _file: string,
    _args: string[],
    _options: unknown,
    callback: (error: null, stdout: string, stderr: string) => void
  ) => {
    callback(null, 'fixture-credential', '')
    return { kill: () => true }
  }
}))

afterEach(() => vi.unstubAllGlobals())

function useInteractivePreview(): void {
  vi.stubGlobal('ORCA_CUSTOM_BUILD_INFO', {
    id: 'interactive-test',
    baseVersion: '1.4.255',
    profileMode: 'interactive-preview',
    changes: []
  })
}

describe('Interactive preview Keychain boundary', () => {
  it.runIf(process.platform === 'darwin')('does not expose a stored credential', async () => {
    useInteractivePreview()
    expect(await readKeychainPassword('fixture-service', 'fixture-account')).toBeNull()
  })

  it('refuses account changes', async () => {
    useInteractivePreview()
    await expect(
      execSecurityCommand(['delete-generic-password', '-s', 'fixture-service'])
    ).rejects.toThrow()
  })
})

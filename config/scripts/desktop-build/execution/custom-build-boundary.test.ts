import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createCustomBuildBoundaryBanner } from '../../../build-plugins/custom-build-manifest'

const root = mkdtempSync(join(tmpdir(), 'orca-custom-boundary-'))
const profiles = join(root, 'profiles')
const home = join(profiles, 'home')
const profile = join(profiles, 'profile')
const outside = join(root, 'outside')
for (const directory of [home, profile, outside]) {
  mkdirSync(directory, { recursive: true })
}
const banner = createCustomBuildBoundaryBanner({
  info: {
    id: 'boundary-test',
    baseVersion: '1.4.255',
    profileMode: 'isolated-preview',
    changes: []
  },
  isolatedProfileRoot: profiles
})

afterAll(() => rmSync(root, { recursive: true, force: true }))

function runBoundary(overrides: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ['-e', `${banner}process.stdout.write('startup-continued')`], {
    env: {
      PATH: process.env.PATH,
      SYSTEMROOT: process.env.SYSTEMROOT,
      HOME: home,
      USERPROFILE: home,
      ORCA_BACKGROUND_LAUNCH: '1',
      ORCA_E2E_HEADLESS: '1',
      ORCA_E2E_ENFORCE_SINGLE_INSTANCE_LOCK: '1',
      ORCA_E2E_HOME_DIR: home,
      ORCA_E2E_USER_DATA_DIR: profile,
      ...overrides
    },
    encoding: 'utf8',
    timeout: 10_000
  })
}

describe('Custom preview startup boundary', () => {
  it('continues startup inside the isolated home and profile', () => {
    const result = runBoundary()
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(0)
    expect(result.stdout).toBe('startup-continued')
  })

  it.each([
    { ORCA_E2E_USER_DATA_DIR: undefined },
    { ORCA_E2E_USER_DATA_DIR: outside },
    { ORCA_E2E_HOME_DIR: outside },
    { HOME: outside, USERPROFILE: outside },
    { ORCA_BACKGROUND_LAUNCH: undefined },
    { ORCA_E2E_HEADLESS: undefined },
    { ORCA_E2E_ENFORCE_SINGLE_INSTANCE_LOCK: undefined },
    { ORCA_BYPASS_SINGLE_INSTANCE_LOCK: '1' }
  ])('refuses unsafe launch environment %j before startup', (overrides) => {
    const result = runBoundary(overrides)
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(78)
    expect(result.stdout).toBe('')
  })

  it('refuses a profile symlink that escapes the isolated root', () => {
    const linkedProfile = join(profiles, 'linked-profile')
    symlinkSync(outside, linkedProfile, process.platform === 'win32' ? 'junction' : 'dir')
    const result = runBoundary({ ORCA_E2E_USER_DATA_DIR: linkedProfile })
    expect(result.error).toBeUndefined()
    expect(result.status).toBe(78)
    expect(result.stdout).toBe('')
  })
})

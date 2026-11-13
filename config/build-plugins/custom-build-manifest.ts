import { createBootstrapFatalExitBanner } from './bootstrap-fatal-exit-banner'
import { readFileSync } from 'node:fs'
import { isAbsolute, resolve } from 'node:path'
import { z } from 'zod'
import { readCustomBuildInfo } from './custom-build-info'
import { createInteractivePreviewBoundary } from './interactive-preview-boundary'
import type { CustomBuildInfo } from '../../src/shared/custom-build'
type CustomBuildManifest = {
  info: CustomBuildInfo
  isolatedProfileRoot: string
  sharedUserDataPath?: string
  interactiveProfileRoot?: string
  interactiveProfileRootName?: string
}
const absoluteDirectory = z
  .string()
  .refine((value) => isAbsolute(value) && resolve(value) !== resolve('/'))
export function readCustomBuildManifest(): CustomBuildManifest | null {
  const path = process.env.ORCA_CUSTOM_BUILD_MANIFEST
  if (!path) {
    return null
  }
  const info = readCustomBuildInfo()
  if (!info) {
    throw new Error('Custom build information is required')
  }
  const roots = z
    .object({
      isolatedProfileRoot: absoluteDirectory.optional(),
      sharedUserDataPath: absoluteDirectory.optional(),
      interactiveProfileRoot: absoluteDirectory.optional()
    })
    .parse(JSON.parse(readFileSync(resolve(path), 'utf8')))
  if (
    (info.profileMode === 'isolated-preview' && !roots.isolatedProfileRoot) ||
    (info.profileMode === 'shared-profile' && !roots.sharedUserDataPath)
  ) {
    throw new Error('A profile boundary is required for this Custom build')
  }
  return {
    info,
    ...roots,
    isolatedProfileRoot: roots.isolatedProfileRoot ?? '',
    interactiveProfileRootName:
      info.profileMode === 'interactive-preview' && !roots.interactiveProfileRoot
        ? 'Orca Custom Preview'
        : undefined
  }
}

export function createCustomBuildBoundaryBanner(manifest: CustomBuildManifest | null): string {
  if (!manifest) {
    return ''
  }
  return `;(() => {
  try {
    const path = require('node:path');
    const fs = require('node:fs');
    const env = process.env;
    if (env.ORCA_BYPASS_SINGLE_INSTANCE_LOCK === '1') throw new Error('profile locks required');
    if (${JSON.stringify(manifest.info.profileMode)} === 'interactive-preview' &&
        !env.ORCA_E2E_HOME_DIR && !env.ORCA_E2E_USER_DATA_DIR) {
      ${createInteractivePreviewBoundary(manifest.interactiveProfileRoot ?? '', manifest.interactiveProfileRootName)}
    } else if (${JSON.stringify(manifest.info.profileMode)} === 'shared-profile' &&
        !env.ORCA_E2E_HOME_DIR && !env.ORCA_E2E_USER_DATA_DIR) {
      if (process.argv.some(arg => arg === '--user-data-dir' || arg.startsWith('--user-data-dir='))) {
        throw new Error('shared profile override refused');
      }
      const app = require('electron').app;
      const actual = fs.realpathSync(app.getPath('userData'));
      const expected = fs.realpathSync(${JSON.stringify(manifest.sharedUserDataPath ?? '')});
      if (actual !== expected) throw new Error('shared profile path mismatch');
      const processHome = process.platform === 'win32' ? env.USERPROFILE : env.HOME;
      if (!processHome || fs.realpathSync(processHome) !== fs.realpathSync(app.getPath('home'))) {
        throw new Error('shared profile home mismatch');
      }
      if (process.argv.includes('--custom-build-preflight')) {
        if (process.platform === 'darwin') app.setActivationPolicy('accessory');
        process.stdout.write(JSON.stringify({preflightOnly: true, profileMode: 'shared-profile', userDataPath: actual, home: app.getPath('home')}) + '\\n');
        process.exit(0);
      }
    } else {
    const root = fs.realpathSync(${JSON.stringify(manifest.isolatedProfileRoot)});
    const inside = (value) => {
      if (!value) return false;
      const relative = path.relative(root, fs.realpathSync(value));
      return relative !== '' && relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
    };
    const home = env.ORCA_E2E_HOME_DIR;
    const userData = env.ORCA_E2E_USER_DATA_DIR;
    const processHome = process.platform === 'win32' ? env.USERPROFILE : env.HOME;
    if (env.ORCA_BACKGROUND_LAUNCH !== '1' || env.ORCA_E2E_HEADLESS !== '1' ||
        env.ORCA_E2E_ENFORCE_SINGLE_INSTANCE_LOCK !== '1' || env.ORCA_BYPASS_SINGLE_INSTANCE_LOCK === '1' ||
        !inside(home) || !inside(userData) ||
        !processHome || fs.realpathSync(processHome) !== fs.realpathSync(home)) {
      throw new Error('isolated launch environment required');
    }
    }
  } catch {
    process.stderr.write('[custom-preview] Refusing startup outside the configured home and profile.\\n');
    process.exit(78);
  }
})();\n`
}

export function customPreviewBanner(diagnostics: string): string {
  return (
    createCustomBuildBoundaryBanner(readCustomBuildManifest()) +
    createBootstrapFatalExitBanner() +
    diagnostics
  )
}

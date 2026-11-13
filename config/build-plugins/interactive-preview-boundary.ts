export function createInteractivePreviewBoundary(rootPath: string, rootName?: string): string {
  return `
      if (process.argv.some(arg => arg === '--user-data-dir' || arg.startsWith('--user-data-dir=') || arg === '--serve')) {
        throw new Error('interactive preview override refused');
      }
      const root = path.resolve(${rootName ? `path.join(require('electron').app.getPath('appData'), ${JSON.stringify(rootName)})` : JSON.stringify(rootPath)});
      const provision = ${JSON.stringify(Boolean(rootName))};
      if (provision) fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      if (fs.realpathSync(root) !== root) throw new Error('preview root alias refused');
      const directory = (name) => {
        const expected = path.join(root, name);
        if (provision) fs.mkdirSync(expected, { recursive: true, mode: 0o700 });
        if (fs.realpathSync(expected) !== expected || !fs.statSync(expected).isDirectory()) {
          throw new Error('preview directory mismatch');
        }
        return expected;
      };
      const locations = {
        home: directory('home'), userData: directory('profile'), appData: directory('app-data'),
        sessionData: directory('profile'), temp: directory('tmp'), logs: directory('logs'),
        crashDumps: directory('crash-dumps'), downloads: directory('downloads')
      };
      const retained = new Set([
        'PATH', 'Path', 'LANG', 'LANGUAGE', 'LC_ALL', 'LC_CTYPE', 'DISPLAY', 'WAYLAND_DISPLAY',
        'XAUTHORITY', 'SYSTEMROOT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'PATHEXT',
        'ProgramFiles', 'ProgramFiles(x86)', 'ProgramW6432', 'USER', 'USERNAME', 'LOGNAME',
        'ORCA_BACKGROUND_LAUNCH', 'ELECTRON_ENABLE_LOGGING'
      ]);
      for (const name of Object.keys(env)) {
        if (!retained.has(name)) delete env[name];
      }
      Object.assign(env, {
        HOME: locations.home, USERPROFILE: locations.home,
        APPDATA: locations.appData, LOCALAPPDATA: directory('local-app-data'),
        XDG_CONFIG_HOME: directory('config'), XDG_DATA_HOME: directory('data'),
        XDG_CACHE_HOME: directory('cache'), XDG_STATE_HOME: directory('state'),
        TMPDIR: locations.temp, TEMP: locations.temp, TMP: locations.temp,
        CODEX_HOME: directory(path.join('home', '.codex')),
        ORCA_CODEX_HOME: directory(path.join('home', '.codex')),
        CLAUDE_CONFIG_DIR: directory(path.join('home', '.claude')),
        ORCA_USER_DATA_PATH: locations.userData,
        ORCA_CLI_INSTALL_PATH: path.join(directory('bin'), process.platform === 'win32' ? 'orca.cmd' : 'orca'),
        ORCA_DISABLE_MACOS_LOGIN_SHELL: '1'
      });
      const app = require('electron').app;
      for (const [name, value] of Object.entries(locations)) app.setPath(name, value);
      if (process.argv.includes('--custom-preview-preflight')) {
        if (process.platform === 'darwin') app.setActivationPolicy('accessory');
        process.stdout.write(JSON.stringify({
          preflightOnly: true, profileMode: 'interactive-preview',
          home: app.getPath('home'), userData: app.getPath('userData'),
          appData: app.getPath('appData'), sessionData: app.getPath('sessionData'),
          cliInstallPath: env.ORCA_CLI_INSTALL_PATH,
          inheritedCredentialPresent: Boolean(env.GH_TOKEN || env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY),
          e2eMode: Boolean(env.ORCA_E2E_USER_DATA_DIR || env.ORCA_E2E_HEADLESS)
        }) + '\\n');
        process.exit(0);
      }
  `
}

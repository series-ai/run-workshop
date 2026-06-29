import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'

interface InstallJsonFile {
  from: string
  to: string
  kind?: string
}

interface InstallJson {
  files: InstallJsonFile[]
}

interface FixtureFileState {
  destination: string
  existed: boolean
  originalContents?: Buffer
}

const TEMPLATE_ROOT = fileURLToPath(new URL('../../', import.meta.url))

// When running inside the game-bot monorepo, resolve the repo root to access
// shared modules. Outside the monorepo (standalone project), this path won't
// exist and the module fixture step is skipped gracefully.
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const FEATURE_FLAGS_MODULE_ROOT = path.join(REPO_ROOT, 'modules', 'data', 'feature-flags')
const FEATURE_FLAGS_INSTALL_JSON_PATH = path.join(FEATURE_FLAGS_MODULE_ROOT, 'install.json')
const IN_MONOREPO = fs.existsSync(FEATURE_FLAGS_INSTALL_JSON_PATH)
const FEATURE_FLAGS_CONFIG_FIXTURE_PATH = path.join(
  TEMPLATE_ROOT,
  'e2e',
  'playwright',
  'fixtures',
  'feature-flags-config.fixture.ts',
)

function parseArg(flag: string): string {
  const index = process.argv.indexOf(flag)
  if (index === -1 || index === process.argv.length - 1) {
    throw new Error(`Missing required argument: ${flag}`)
  }

  return process.argv[index + 1] as string
}

function loadFeatureFlagsInstallMetadata(): InstallJson {
  return JSON.parse(fs.readFileSync(FEATURE_FLAGS_INSTALL_JSON_PATH, 'utf8')) as InstallJson
}

function installModuleFixture(): FixtureFileState[] {
  const metadata = loadFeatureFlagsInstallMetadata()
  const fixtureEntries = metadata.files.filter((entry) => entry.kind === 'source' || entry.kind === 'debug-console')
  const fixtureState: FixtureFileState[] = []

  for (const entry of fixtureEntries) {
    const destination = path.join(TEMPLATE_ROOT, entry.to)
    const source =
      entry.to === 'src/services/feature-flags/config.ts'
        ? FEATURE_FLAGS_CONFIG_FIXTURE_PATH
        : path.join(FEATURE_FLAGS_MODULE_ROOT, entry.from)
    const existed = fs.existsSync(destination)

    fixtureState.push({
      destination,
      existed,
      originalContents: existed ? fs.readFileSync(destination) : undefined,
    })

    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.copyFileSync(source, destination)
  }

  return fixtureState
}

function cleanupModuleFixture(files: FixtureFileState[]): void {
  for (const file of [...files].reverse()) {
    if (file.existed) {
      if (file.originalContents) {
        fs.writeFileSync(file.destination, file.originalContents)
      }
      continue
    }

    if (fs.existsSync(file.destination)) {
      fs.rmSync(file.destination, { force: true })
    }

    let currentDir = path.dirname(file.destination)
    while (currentDir.startsWith(path.join(TEMPLATE_ROOT, 'src')) && currentDir !== path.join(TEMPLATE_ROOT, 'src')) {
      if (fs.existsSync(currentDir) && fs.readdirSync(currentDir).length === 0) {
        fs.rmdirSync(currentDir)
        currentDir = path.dirname(currentDir)
        continue
      }

      break
    }
  }
}

async function main(): Promise<void> {
  const host = parseArg('--host')
  const port = parseArg('--port')
  const fixtureFiles = IN_MONOREPO ? installModuleFixture() : []
  let cleanedUp = false

  const cleanup = () => {
    if (cleanedUp) {
      return
    }

    cleanedUp = true
    if (fixtureFiles.length > 0) {
      cleanupModuleFixture(fixtureFiles)
    }
  }

  const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const devServer = spawn(npmCommand, ['run', 'dev', '--', '--host', host, '--port', port, '--strictPort'], {
    cwd: TEMPLATE_ROOT,
    stdio: 'inherit',
    env: process.env,
  })

  const forwardSignal = (signal: NodeJS.Signals) => {
    cleanup()
    devServer.kill(signal)
  }

  process.on('exit', cleanup)
  process.on('SIGINT', () => forwardSignal('SIGINT'))
  process.on('SIGTERM', () => forwardSignal('SIGTERM'))

  devServer.on('exit', (code, signal) => {
    cleanup()

    if (signal) {
      process.kill(process.pid, signal)
      return
    }

    process.exit(code ?? 0)
  })
}

void main()

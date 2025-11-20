import { cp, mkdir, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = path.resolve(projectRoot, '..')
const sourceRoot = path.resolve(repoRoot, 'frontend', 'dist', 'build', 'h5')
const publicDir = path.join(projectRoot, 'public')

const ensureExists = async (target) => {
  try {
    await stat(target)
  } catch (error) {
    throw new Error(`未找到目录: ${target}\n请先在 frontend 目录执行 \`npm run build:h5\` 并重新运行同步脚本`)
  }
}

const copyDir = async (src, dest) => {
  await rm(dest, { recursive: true, force: true })
  await mkdir(path.dirname(dest), { recursive: true })
  await cp(src, dest, { recursive: true })
}

const run = async () => {
  await ensureExists(sourceRoot)
  await copyDir(path.join(sourceRoot, 'assets'), path.join(publicDir, 'assets'))
  await copyDir(path.join(sourceRoot, 'static'), path.join(publicDir, 'static'))
  await copyDir(sourceRoot, path.join(publicDir, 'h5'))

  const txtFile = path.join(sourceRoot, 'kNNXOz2HCs.txt')
  if (existsSync(txtFile)) {
    await cp(txtFile, path.join(publicDir, 'kNNXOz2HCs.txt'))
  }

  console.log('H5 构建资源同步完成。')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

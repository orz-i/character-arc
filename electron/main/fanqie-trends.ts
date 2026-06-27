import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { getWorkspaceDirPath } from './workspace-store'

/**
 * 番茄风向标数据抓取 + 本地缓存层。
 *
 * 数据来源于 fork 仓库 uu201/FanqieRankTracker，原型（fanqie-trends-prototype.html）
 * 直接在渲染层用 fetch 走多镜像。这里把抓取搬到主进程：
 *   1. 统一缓存到 <userData>/data/fanqie-trends-cache/ ，避免每次切榜单/周期都打网络；
 *   2. 绕开渲染层 CSP / 跨域限制；
 *   3. 抓取失败时回退到旧缓存，弱网下仍可用。
 */

/** fork 仓库与分支 */
const REPO = 'uu201/FanqieRankTracker'
const BRANCH = 'main'

/** 镜像通道：jsDelivr(国内CDN) → fastly → ghproxy → raw.githubusercontent(直连兜底) */
const MIRRORS: Array<(path: string) => string> = [
  (p) => `https://cdn.jsdelivr.net/gh/${REPO}@${BRANCH}/${p}`,
  (p) => `https://fastly.jsdelivr.net/gh/${REPO}@${BRANCH}/${p}`,
  (p) => `https://ghproxy.net/https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p}`,
  (p) => `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${p}`
]

const MIRROR_NAMES = ['jsDelivr', 'jsDelivr(fastly)', 'ghproxy', 'GitHub raw']

/** 缓存有效期：榜单数据每日更新，默认 6 小时内复用缓存 */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** 单次镜像请求超时 */
const FETCH_TIMEOUT_MS = 12000

/** 上次命中的镜像，下次优先尝试 */
let activeMirror = 0

type CacheEnvelope = {
  /** 缓存写入时间戳（毫秒） */
  fetchedAt: number
  /** 命中的镜像名 */
  mirror: string
  /** 原始 JSON 数据 */
  data: unknown
}

export type FanqieTrendsFetchResult = {
  success: boolean
  /** 榜单数据（成功时存在） */
  data?: unknown
  /** 是否来自本地缓存（未走网络） */
  fromCache?: boolean
  /** 数据抓取/缓存写入时间戳（毫秒） */
  fetchedAt?: number
  /** 命中的镜像名 */
  mirror?: string
  /** 失败原因 */
  error?: string
}

function getCacheDir(): string {
  return join(getWorkspaceDirPath(), 'fanqie-trends-cache')
}

/** 把远程路径映射成扁平的缓存文件名（hash + 可读后缀） */
function getCacheFilePath(remotePath: string): string {
  const hash = createHash('sha1').update(remotePath).digest('hex').slice(0, 16)
  return join(getCacheDir(), `${hash}.json`)
}

async function readCache(remotePath: string): Promise<CacheEnvelope | null> {
  try {
    const raw = await readFile(getCacheFilePath(remotePath), 'utf-8')
    const parsed = JSON.parse(raw) as CacheEnvelope
    if (parsed && typeof parsed.fetchedAt === 'number' && 'data' in parsed) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

async function writeCache(remotePath: string, envelope: CacheEnvelope): Promise<void> {
  try {
    await mkdir(getCacheDir(), { recursive: true })
    await writeFile(getCacheFilePath(remotePath), JSON.stringify(envelope), 'utf-8')
  } catch {
    // 缓存写入失败不影响本次返回，忽略
  }
}

/** 按镜像顺序抓取一个 JSON 路径，命中即返回；优先复用上次成功的镜像 */
async function fetchJsonFromMirrors(remotePath: string): Promise<{ data: unknown; mirror: string }> {
  let lastErr: unknown
  const order = [activeMirror, ...MIRRORS.map((_, i) => i).filter((i) => i !== activeMirror)]

  for (const idx of order) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      const url = MIRRORS[idx](remotePath) + (remotePath.includes('?') ? '' : `?t=${Date.now()}`)
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { 'User-Agent': 'CharacterArc-Desktop' },
        signal: controller.signal
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      activeMirror = idx
      return { data, mirror: MIRROR_NAMES[idx] ?? `mirror#${idx}` }
    } catch (error) {
      lastErr = error
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('全部镜像通道均失败')
}

/**
 * 抓取番茄风向标某个数据文件，带本地缓存。
 * @param remotePath 仓库内相对路径，如 `api/boards.json`、`api/female-new/lastest/all.json`
 * @param force      为 true 时跳过缓存强制走网络（用于「刷新」按钮）
 */
export async function fetchFanqieTrends(remotePath: string, force = false): Promise<FanqieTrendsFetchResult> {
  const path = String(remotePath ?? '').replace(/^\/+/, '').trim()
  if (!path) {
    return { success: false, error: '缺少数据路径' }
  }

  const cached = await readCache(path)

  // 非强制刷新且缓存仍新鲜 → 直接复用
  if (!force && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      success: true,
      data: cached.data,
      fromCache: true,
      fetchedAt: cached.fetchedAt,
      mirror: cached.mirror
    }
  }

  try {
    const { data, mirror } = await fetchJsonFromMirrors(path)
    const fetchedAt = Date.now()
    await writeCache(path, { fetchedAt, mirror, data })
    return { success: true, data, fromCache: false, fetchedAt, mirror }
  } catch (error) {
    // 网络失败：能回退到旧缓存就回退（哪怕已过期），让弱网下仍可浏览
    if (cached) {
      return {
        success: true,
        data: cached.data,
        fromCache: true,
        fetchedAt: cached.fetchedAt,
        mirror: cached.mirror
      }
    }
    return { success: false, error: error instanceof Error ? error.message : '抓取失败' }
  }
}

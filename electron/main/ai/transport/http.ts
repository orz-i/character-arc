import { AI_REQUEST_TIMEOUT_MS } from '../shared-types'

async function readErrorMessage(response: Response, fallbackLabel: string): Promise<string> {
  const fallback = `${fallbackLabel} 请求失败：${response.status} ${response.statusText}`
  try {
    const data = (await response.json()) as Record<string, unknown>
    const error = (data.error ?? data) as Record<string, unknown>
    const message =
      (typeof error.message === 'string' && error.message) ||
      (typeof error.error === 'string' && error.error) ||
      (typeof data.message === 'string' && data.message)
    return message ? `${fallbackLabel} 请求失败：${message}` : fallback
  } catch {
    return fallback
  }
}

async function performAiRequest(url: string, init: RequestInit, providerLabel: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, providerLabel))
    }
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`${providerLabel} 请求超时，请检查网络、代理或模型服务状态。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export { performAiRequest, readErrorMessage }

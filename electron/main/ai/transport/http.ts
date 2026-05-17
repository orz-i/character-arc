import { AI_REQUEST_TIMEOUT_MS } from '../shared-types'

/** 从错误响应体中提取可读的错误信息 */
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

/**
 * 发送 AI 请求的通用函数，自带超时控制和错误处理。
 *
 * @param url - 请求地址
 * @param init - fetch 请求配置
 * @param providerLabel - 供应商名称，用于错误提示
 * @param externalSignal - 外部中止信号
 * @returns 成功的 Response 对象
 * @throws 请求失败或超时时抛出错误
 */
async function performAiRequest(
  url: string,
  init: RequestInit,
  providerLabel: string,
  externalSignal?: AbortSignal
): Promise<Response> {
  const timeoutCtl = new AbortController()
  const timer = setTimeout(() => timeoutCtl.abort(), AI_REQUEST_TIMEOUT_MS)
  const signal = externalSignal
    ? AbortSignal.any([externalSignal, timeoutCtl.signal])
    : timeoutCtl.signal
  try {
    const response = await fetch(url, { ...init, signal })
    if (!response.ok) {
      throw new Error(await readErrorMessage(response, providerLabel))
    }
    return response
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      if (externalSignal?.aborted) throw error
      throw new Error(`${providerLabel} 请求超时，请检查网络、代理或模型服务状态。`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

export { performAiRequest, readErrorMessage }

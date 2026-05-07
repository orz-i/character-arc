import type { AppSettings, AiStreamHandlers, PromptPair } from '../shared-types'
import type { StructuredOutputOptions } from './index'
import { performAiRequest, readErrorMessage } from './http'
import { consumeSseResponse, extractOpenAiCompatibleDelta } from './sse'

export async function requestOpenAiCompatible(
  settings: AppSettings,
  prompt: PromptPair,
  maxTokens?: number,
  structured?: StructuredOutputOptions
): Promise<string> {
  const body: Record<string, unknown> = {
    model: settings.model,
    temperature: 0.8,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ]
  }
  if (maxTokens) body.max_tokens = maxTokens
  if (structured?.mode === 'json_object') {
    body.response_format = { type: 'json_object' }
  }
  const response = await performAiRequest(
    `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {})
      },
      body: JSON.stringify(body)
    },
    'OpenAI 兼容接口'
  )
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('AI 返回内容为空')
  return content
}

export async function requestOpenAiCompatibleStream(
  settings: AppSettings,
  prompt: PromptPair,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
  maxTokens?: number
): Promise<string> {
  const response = await fetch(
    `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {})
      },
      signal,
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.8,
        stream: true,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ]
      })
    }
  )
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'OpenAI 兼容接口'))
  }
  let content = ''
  await consumeSseResponse(response, (_eventName, data) => {
    if (!data || data === '[DONE]') return
    const payload = JSON.parse(data) as Record<string, unknown>
    const delta = extractOpenAiCompatibleDelta(payload)
    if (!delta) return
    content += delta
    handlers.onTextDelta(delta)
  })
  return content
}

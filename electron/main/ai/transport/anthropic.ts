import type { AppSettings, AiStreamHandlers, PromptPair } from '../shared-types'
import { performAiRequest, readErrorMessage } from './http'
import { consumeSseResponse, extractAnthropicDelta } from './sse'

export async function requestAnthropic(
  settings: AppSettings,
  prompt: PromptPair,
  maxTokens?: number
): Promise<string> {
  const response = await performAiRequest(
    `${settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: settings.model,
        max_tokens: maxTokens ?? 600,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      })
    },
    'Anthropic'
  )
  const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> }
  const content = data.content?.find((item) => item.type === 'text')?.text
  if (!content) throw new Error('Anthropic 返回内容为空')
  return content
}

export async function requestAnthropicStream(
  settings: AppSettings,
  prompt: PromptPair,
  handlers: AiStreamHandlers,
  signal: AbortSignal,
  maxTokens?: number
): Promise<string> {
  const response = await fetch(
    `${settings.baseUrl.replace(/\/$/, '')}/v1/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      signal,
      body: JSON.stringify({
        model: settings.model,
        stream: true,
        max_tokens: maxTokens ?? 600,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }]
      })
    }
  )
  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Anthropic'))
  }
  let content = ''
  await consumeSseResponse(response, (eventName, data) => {
    if (!data) return
    const payload = JSON.parse(data) as Record<string, unknown>
    const delta = extractAnthropicDelta(eventName, payload)
    if (!delta) return
    content += delta
    handlers.onTextDelta(delta)
  })
  return content
}

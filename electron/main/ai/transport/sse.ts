export async function consumeSseResponse(
  response: Response,
  onEvent: (eventName: string, data: string) => void | Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error('模型响应不支持流式读取。')
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })
    let separatorIndex = buffer.indexOf('\n\n')
    while (separatorIndex >= 0) {
      const rawEvent = buffer.slice(0, separatorIndex).trim()
      buffer = buffer.slice(separatorIndex + 2)
      if (rawEvent) {
        let eventName = 'message'
        const dataLines: string[] = []
        for (const line of rawEvent.split(/\r?\n/)) {
          if (line.startsWith('event:')) { eventName = line.slice(6).trim() || eventName; continue }
          if (line.startsWith('data:')) { dataLines.push(line.slice(5).trimStart()) }
        }
        await onEvent(eventName, dataLines.join('\n'))
      }
      separatorIndex = buffer.indexOf('\n\n')
    }
    if (done) {
      const trailingEvent = buffer.trim()
      if (trailingEvent) {
        let eventName = 'message'
        const dataLines: string[] = []
        for (const line of trailingEvent.split(/\r?\n/)) {
          if (line.startsWith('event:')) { eventName = line.slice(6).trim() || eventName; continue }
          if (line.startsWith('data:')) { dataLines.push(line.slice(5).trimStart()) }
        }
        await onEvent(eventName, dataLines.join('\n'))
      }
      break
    }
  }
}

export function extractOpenAiCompatibleDelta(payload: Record<string, unknown>): string {
  const choice = Array.isArray(payload.choices) ? (payload.choices[0] as Record<string, unknown> | undefined) : undefined
  const delta = choice?.delta as Record<string, unknown> | undefined
  if (typeof delta?.content === 'string') return delta.content as string
  const contentParts = delta?.content
  if (Array.isArray(contentParts)) {
    return contentParts
      .map((part) => {
        const record = part as Record<string, unknown>
        if (typeof record.text === 'string') return record.text
        return typeof record.content === 'string' ? record.content : ''
      })
      .join('')
  }
  return ''
}

export function extractAnthropicDelta(eventName: string, payload: Record<string, unknown>): string {
  const payloadType = String(payload.type ?? '')
  if (eventName === 'content_block_delta' || payloadType === 'content_block_delta') {
    const delta = payload.delta as Record<string, unknown> | undefined
    return typeof delta?.text === 'string' ? delta.text : ''
  }
  return ''
}

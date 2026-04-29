const query = new URLSearchParams(window.location.search)

export type CharacterArcWindowKind = 'main' | 'assistant'

export const characterArcWindowKind: CharacterArcWindowKind =
  query.get('window') === 'assistant' ? 'assistant' : 'main'

export const isAssistantWindow = characterArcWindowKind === 'assistant'

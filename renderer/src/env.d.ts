/// <reference types="vite/client" />

declare global {
  interface Window {
    characterArc: {
      platform: string
      version: string
      exportJson: (payload: unknown) => Promise<{
        success: boolean
        canceled: boolean
        filePath?: string
      }>
      exportText: (payload: unknown) => Promise<{
        success: boolean
        canceled: boolean
        filePath?: string
      }>
      importJson: () => Promise<{
        success: boolean
        canceled: boolean
        payload?: unknown
      }>
    }
  }
}

export {}

import { basename, extname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { Jieba, TfIdf } from '@node-rs/jieba'
import { dict, idf } from '@node-rs/jieba/dict'

export type ReferenceFileType = 'txt' | 'md' | 'docx'

export type ReferenceStyleMetric = {
  label: string
  value: string
}

export type ReferenceNovelLocalContext = {
  title: string
  fileName: string
  fileType: ReferenceFileType
  excerpt: string
  analysisSample: string
  characterCount: number
  chapterCount: number
  topKeywords: string[]
  metrics: ReferenceStyleMetric[]
}

const jieba = Jieba.withDict(dict)
const tfidf = TfIdf.withDict(idf)
const CHAPTER_HEADING_RE = /^(第[0-9零一二三四五六七八九十百千万两]+[章节回卷部集][^\n]{0,40})$/gm
const STOP_WORDS = new Set([
  '一个',
  '一种',
  '一些',
  '没有',
  '他们',
  '自己',
  '这个',
  '那个',
  '这里',
  '那里',
  '我们',
  '你们',
  '不是',
  '然后',
  '已经',
  '可以',
  '因为',
  '所以',
  '而且',
  '只是',
  '还是',
  '如果',
  '但是',
  '开始',
  '时候',
  '东西',
  '什么',
  '怎么',
  '一个人',
  '一下',
  '出来',
  '进去',
  '之后',
  '之前',
  '起来',
  '下来',
  '现在',
  '真的',
  '有些',
  '这种',
  '那种'
])

function resolveFileType(filePath: string): ReferenceFileType {
  const extension = extname(filePath).toLowerCase()
  if (extension === '.docx') {
    return 'docx'
  }

  if (extension === '.md' || extension === '.markdown') {
    return 'md'
  }

  return 'txt'
}

function normalizeNovelText(rawText: string): string {
  return rawText
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

async function readNovelText(filePath: string, fileType: ReferenceFileType): Promise<string> {
  if (fileType === 'docx') {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ path: filePath })
    return normalizeNovelText(result.value)
  }

  const buffer = await readFile(filePath)
  return normalizeNovelText(buffer.toString('utf-8'))
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

function splitChapters(text: string): string[] {
  const matches = Array.from(text.matchAll(CHAPTER_HEADING_RE))
  if (matches.length >= 3) {
    return matches
      .map((match, index) => {
        const start = match.index ?? 0
        const end = matches[index + 1]?.index ?? text.length
        return text.slice(start, end).trim()
      })
      .filter(Boolean)
  }

  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) {
    return []
  }

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if ((current + '\n\n' + paragraph).length > 2600 && current.trim()) {
      chunks.push(current.trim())
      current = paragraph
      continue
    }

    current = current ? `${current}\n\n${paragraph}` : paragraph
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

function clipText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text
  }

  return `${text.slice(0, maxLength).trim()}……`
}

function buildAnalysisSample(chapters: string[], text: string): string {
  const sourceSections = chapters.length >= 3
    ? [chapters[0], chapters[Math.floor(chapters.length / 2)], chapters[chapters.length - 1]]
    : [text.slice(0, 2200), text.slice(Math.max(0, Math.floor(text.length / 2) - 1100), Math.max(0, Math.floor(text.length / 2) - 1100) + 2200), text.slice(Math.max(0, text.length - 2200))]

  return sourceSections
    .map((section, index) => {
      const label = index === 0 ? '开篇样本' : index === 1 ? '中段样本' : '后段样本'
      return `【${label}】\n${clipText(section.trim(), 2200)}`
    })
    .join('\n\n')
}

function computeMetrics(text: string, chapters: string[]): ReferenceStyleMetric[] {
  const plainText = text.replace(/\s+/g, '')
  const characterCount = plainText.length
  const paragraphs = splitParagraphs(text)
  const sentences = text
    .split(/[。！？!?；;]+/)
    .map((sentence) => sentence.replace(/\s+/g, '').trim())
    .filter(Boolean)
  const dialogueParagraphCount = paragraphs.filter((paragraph) => /[“”「」『』"']/u.test(paragraph)).length
  const shortSentenceCount = sentences.filter((sentence) => sentence.length <= 18).length
  const emotionMarkCount = (text.match(/[!?！？]/g) ?? []).length
  const avgSentenceLength = sentences.length ? plainText.length / sentences.length : 0
  const dialogueParagraphRatio = paragraphs.length ? dialogueParagraphCount / paragraphs.length : 0
  const shortSentenceRatio = sentences.length ? shortSentenceCount / sentences.length : 0
  const emotionMarksPerThousand = characterCount ? (emotionMarkCount / characterCount) * 1000 : 0

  return [
    { label: '总字数', value: `${characterCount.toLocaleString('zh-CN')} 字` },
    { label: '章节估计', value: `${Math.max(chapters.length, 1)} 段/章` },
    { label: '平均句长', value: `${avgSentenceLength.toFixed(1)} 字/句` },
    { label: '对白段落占比', value: `${(dialogueParagraphRatio * 100).toFixed(0)}%` },
    { label: '短句比例', value: `${(shortSentenceRatio * 100).toFixed(0)}%` },
    { label: '情绪标点密度', value: `每千字 ${emotionMarksPerThousand.toFixed(1)} 个` }
  ]
}

function extractKeywords(text: string): string[] {
  const keywords = tfidf.extractKeywords(jieba, clipText(text, 36_000), 18)
  return keywords
    .map((entry) => entry.keyword.trim())
    .filter((keyword) => keyword.length >= 2 && !STOP_WORDS.has(keyword))
    .slice(0, 10)
}

export async function extractReferenceNovelContext(filePath: string): Promise<ReferenceNovelLocalContext> {
  const fileType = resolveFileType(filePath)
  const fileName = basename(filePath)
  const title = basename(filePath, extname(filePath)).trim() || '未命名参考作品'
  const text = await readNovelText(filePath, fileType)

  if (!text.trim()) {
    throw new Error('导入的文件没有可用正文，请确认文件内容不是空白。')
  }

  const chapters = splitChapters(text)
  const excerpt = clipText(chapters[0] ?? text, 800)

  return {
    title,
    fileName,
    fileType,
    excerpt,
    analysisSample: buildAnalysisSample(chapters, text),
    characterCount: text.replace(/\s+/g, '').length,
    chapterCount: Math.max(chapters.length, 1),
    topKeywords: extractKeywords(text),
    metrics: computeMetrics(text, chapters)
  }
}

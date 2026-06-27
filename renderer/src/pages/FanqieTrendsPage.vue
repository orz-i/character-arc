<script setup lang="ts">
import { ChevronLeft, Flame, RefreshCw } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { NButton } from 'naive-ui'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()

function backToProjectCenter(): void {
  appStore.backToProjects()
}

// ===== 频道标签与展示顺序 =====
const BOARD_ORDER = ['female-new', 'male-new']
const CHANNEL_LABEL: Record<string, string> = { female: '女频', male: '男频', mixed: '综合' }

type BoardItem = {
  slug: string
  name: string
  channel?: string
  has_genres?: boolean
  _empty?: boolean
}

type AnyRecord = Record<string, any>

// ===== 状态 =====
const loading = ref(true)
const errorMsg = ref('')
const boardsList = ref<BoardItem[]>([])
const curBoard = ref<string | null>(null)
const summaryData = ref<AnyRecord | null>(null)
const allData = ref<AnyRecord | null>(null)
const curPeriod = ref('7')
const curCat = ref<string | null>(null)
const dataDate = ref('—')
const dataPrev = ref('')
const srcNote = ref('')
const boardEmptyName = ref('')
const boardEmpty = ref(false)

// ===== 工具 =====
function fmtScore(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + '万'
  return String(n)
}

async function fetchJson(path: string, force = false): Promise<AnyRecord> {
  const res = await window.characterArc.fetchFanqieTrends(path, force)
  if (!res.success || res.data == null) {
    throw new Error(res.error || '加载失败')
  }
  if (res.mirror) {
    srcNote.value = (res.fromCache ? '缓存 · ' : '镜像 · ') + res.mirror
  }
  return res.data as AnyRecord
}

// ===== 切换榜单 =====
async function switchBoard(slug: string, force = false): Promise<void> {
  const board = boardsList.value.find((b) => b.slug === slug)
  if (!board) return
  curBoard.value = slug
  curCat.value = null
  curPeriod.value = '7'

  if (board._empty) {
    boardEmpty.value = true
    boardEmptyName.value = board.name
    summaryData.value = null
    allData.value = null
    loading.value = false
    return
  }
  boardEmpty.value = false
  loading.value = true
  errorMsg.value = ''
  try {
    const [summary, all] = await Promise.all([
      fetchJson(`data/${slug}/market_summary.json`, force),
      fetchJson(`api/${slug}/lastest/all.json`, force)
    ])
    summaryData.value = summary
    allData.value = all
    dataDate.value = '数据日期 ' + (all.date || summary.date || '—')
    dataPrev.value = summary.prev_date ? `对比 ${summary.prev_date}` : ''
    const cats = (all.categories || []) as AnyRecord[]
    if (cats.length) curCat.value = cats[0].name
    loading.value = false
  } catch (e) {
    loading.value = false
    errorMsg.value = `加载榜单「${board.name}」失败：` + (e instanceof Error ? e.message : String(e))
  }
}

// ===== 主加载 =====
async function loadAll(force = false): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    let known: BoardItem[] = []
    try {
      known = ((await fetchJson('api/boards.json', force)).boards || []) as BoardItem[]
    } catch {
      known = []
    }
    const knownMap: Record<string, BoardItem> = {}
    known.forEach((b) => { knownMap[b.slug] = b })

    const defaults: Record<string, BoardItem> = {
      'female-new': { slug: 'female-new', name: '女频新书榜', channel: 'female', has_genres: true },
      'male-new': { slug: 'male-new', name: '男频新书榜', channel: 'male', has_genres: true }
    }
    boardsList.value = BOARD_ORDER.map((slug) => {
      if (knownMap[slug]) return { ...knownMap[slug], _empty: false }
      return { ...defaults[slug], _empty: true }
    })
    known.forEach((b) => {
      if (!BOARD_ORDER.includes(b.slug)) boardsList.value.push({ ...b, _empty: false })
    })

    const firstReady = boardsList.value.find((b) => !b._empty) || boardsList.value[0]
    if (firstReady) {
      await switchBoard(firstReady.slug, force)
    } else {
      loading.value = false
    }
  } catch (e) {
    loading.value = false
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
}

function selectPeriod(p: string): void {
  curPeriod.value = p
}

function selectCat(name: string): void {
  curCat.value = name
}

function channelLabel(b: BoardItem): string {
  return CHANNEL_LABEL[b.channel || ''] || b.channel || ''
}

// ===== 派生数据 =====
const curBoardItem = computed(() => boardsList.value.find((b) => b.slug === curBoard.value) || null)

const periodTabs = computed<Array<{ key: string; label: string }>>(() => {
  const periods = summaryData.value?.periods
  if (!periods) return []
  return ['7', '14', '30', 'all']
    .filter((k) => periods[k])
    .map((k) => ({ key: k, label: periods[k].period as string }))
})

const curPeriodData = computed<AnyRecord | null>(() => summaryData.value?.periods?.[curPeriod.value] ?? null)

const summaryText = computed(() => {
  const p = curPeriodData.value
  return p ? (p.summary || p.fallback_summary || '暂无速评') : ''
})
const summarySrc = computed(() => (curPeriodData.value?.source === 'ai' ? 'AI 生成' : '规则统计'))

const hotGenres = computed<AnyRecord[]>(() => curPeriodData.value?.hot_genres || [])

const hotTypes = computed<Array<AnyRecord & { _pct: number; _val: number }>>(() => {
  const types: AnyRecord[] = curPeriodData.value?.hot_types || []
  const maxScore = Math.max(...types.map((t) => Number(t.score) || 0), 1)
  return types.map((t) => ({
    ...t,
    _pct: Math.max(8, ((Number(t.score) || 0) / maxScore) * 100),
    _val: Number(t.read_growth_total ?? t.score) || 0
  }))
})

const hotThemes = computed<Array<AnyRecord & { _size: number }>>(() => {
  const themes: AnyRecord[] = curPeriodData.value?.hot_themes || []
  const maxCount = Math.max(...themes.map((t) => Number(t.count) || 0), 1)
  return themes.map((t) => ({
    ...t,
    _size: Number((((0.86 + ((Number(t.count) || 0) / maxCount) * 0.6) * 14).toFixed(1)))
  }))
})

const categories = computed<AnyRecord[]>(() => allData.value?.categories || [])

const curCatData = computed<AnyRecord | null>(() => categories.value.find((c) => c.name === curCat.value) ?? null)

const curCatTrend = computed<AnyRecord>(() => curCatData.value?.trend || {})

const curCatSummaryHtml = computed(() =>
  String(curCatTrend.value.summary || '暂无该分类速评')
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
)

const curCatBooks = computed<AnyRecord[]>(() => (curCatData.value?.books || []).slice(0, 15))

function isNewBook(title: string): boolean {
  return (curCatTrend.value.new_books || []).includes(title)
}

function fmt(n: unknown): string {
  return fmtScore(Number(n) || 0)
}

onMounted(() => {
  void loadAll()
})
</script>

<template>
  <section class="fanqie-page arc-scrollbar">
    <div class="fanqie-shell">
      <div class="topbar">
        <div class="topbar-lead">
          <n-button quaternary size="small" class="back-btn" @click="backToProjectCenter">
            <template #icon><ChevronLeft :size="16" /></template>
            返回项目中心
          </n-button>
          <h1><span class="flame"><Flame :size="24" /></span> 番茄风向标</h1>
          <p class="sub">番茄小说榜单 · 每日趋势与题材风向</p>
          <p class="sub">数据来源于https://github.com/uu201/FanqieRankTracker</p>
        </div>
        <div class="meta">
          <div class="date num">{{ dataDate }}</div>
          <div v-if="dataPrev" class="prev">{{ dataPrev }}</div>
          <button class="refresh-btn" :disabled="loading" @click="loadAll(true)">
            <RefreshCw :size="13" /> 刷新
          </button>
          <div v-if="srcNote" class="src-note">{{ srcNote }}</div>
        </div>
      </div>

      <div v-if="loading" class="state">
        <div class="spinner" aria-hidden="true"></div>
        正在加载榜单数据…
      </div>

      <div v-else-if="errorMsg" class="state">
        <div>数据加载失败</div>
        <div class="err-detail">{{ errorMsg }}</div>
        <button class="refresh-btn" style="margin-top:16px" @click="loadAll(true)">重试</button>
      </div>

      <div v-else class="content">
        <div class="board-tabs">
          <button
            v-for="b in boardsList"
            :key="b.slug"
            class="board-tab"
            :class="{ active: b.slug === curBoard, empty: b._empty }"
            :title="b._empty ? '该榜单暂无数据' : ''"
            @click="switchBoard(b.slug)"
          >
            {{ b.name }}<span class="ch">{{ channelLabel(b) }}</span>
          </button>
        </div>

        <div v-if="boardEmpty" class="state">
          <div>「{{ boardEmptyName }}」榜单暂无数据</div>
          <div class="src-note" style="margin-top:10px;max-width:460px;line-height:1.7">
            该榜单需在 fork 仓库里配置榜单 ID 并跑过一次抓取后才有数据。
          </div>
        </div>

        <template v-else>
          <div class="period-tabs">
            <button
              v-for="p in periodTabs"
              :key="p.key"
              class="period-tab"
              :class="{ active: p.key === curPeriod }"
              @click="selectPeriod(p.key)"
            >{{ p.label }}</button>
          </div>

          <div class="summary-card">
            <div class="label">AI 风向速评 <span class="badge-src">{{ summarySrc }}</span></div>
            <p class="text">{{ summaryText }}</p>
          </div>

          <div v-if="curBoardItem?.has_genres && hotGenres.length" class="section">
            <h3 class="section-title">热门综合赛道 <span class="hint">按阅读增长加权</span></h3>
            <div class="grid">
              <div v-for="(g, i) in hotGenres" :key="g.name" class="genre-card" :class="{ top1: i === 0 }">
                <div class="rank-no num">{{ i + 1 }}</div>
                <div class="name">{{ g.name }}</div>
                <div class="lead">领涨分类 · <b>{{ g.lead_category || '—' }}</b></div>
                <div class="score num">+{{ fmt(g.read_growth_total ?? g.score) }}<small>在读增长</small></div>
                <div class="cats">
                  <span v-for="c in (g.categories || [])" :key="c" class="chip">{{ c }}</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="hotTypes.length" class="section">
            <h3 class="section-title">热门具体分类</h3>
            <div class="type-list">
              <div v-for="t in hotTypes" :key="t.name" class="type-row">
                <div class="t-label">{{ t.name }}</div>
                <div class="t-bar-wrap"><div class="t-bar" :style="{ width: t._pct + '%' }"></div></div>
                <div class="t-val num">+{{ fmt(t._val) }}</div>
              </div>
            </div>
          </div>

          <div v-if="hotThemes.length" class="section">
            <h3 class="section-title">高频题材标签 <span class="hint">新书简介命中次数</span></h3>
            <div class="themes">
              <span v-for="t in hotThemes" :key="t.name" class="theme-tag" :style="{ fontSize: t._size + 'px' }">
                <span class="t-name">{{ t.name }}</span><span class="t-count num">×{{ t.count }}</span>
              </span>
            </div>
          </div>

          <div v-if="categories.length" class="section">
            <h3 class="section-title">分类榜单 &amp; 趋势</h3>
            <div class="cat-selector">
              <button
                v-for="c in categories"
                :key="c.name"
                class="cat-btn"
                :class="{ active: c.name === curCat }"
                @click="selectCat(c.name)"
              >{{ c.name }}</button>
            </div>
            <div class="cat-summary" v-html="curCatSummaryHtml"></div>
            <div class="cat-detail">
              <div class="book-list">
                <div v-for="(b, i) in curCatBooks" :key="b.title + i" class="book-card">
                  <div class="bk-rank num">{{ i + 1 }}</div>
                  <img v-if="b.cover" loading="lazy" :src="b.cover" :alt="`${b.title} 封面`" @error="(e) => ((e.target as HTMLImageElement).style.visibility = 'hidden')" />
                  <div class="bk-info">
                    <div class="bk-title">{{ b.title }} <span v-if="isNewBook(b.title)" class="tag-new">NEW</span></div>
                    <div class="bk-meta">{{ b.author }} · <span class="bk-reads num">{{ b.reads }} 在读</span></div>
                    <div class="bk-intro">{{ b.intro }}</div>
                  </div>
                </div>
              </div>
              <div class="trend-side">
                <div v-if="(curCatTrend.top_risers || []).length" class="trend-box">
                  <h4>排名上升 <span class="badge-src num">{{ curCatTrend.top_risers.length }}</span></h4>
                  <div v-for="x in curCatTrend.top_risers" :key="x.title" class="trend-item">
                    <span class="ti-title">{{ x.title }}</span><span class="up num">{{ x.change }}</span>
                  </div>
                </div>
                <div v-if="(curCatTrend.top_fallers || []).length" class="trend-box">
                  <h4>排名下降</h4>
                  <div v-for="x in curCatTrend.top_fallers" :key="x.title" class="trend-item">
                    <span class="ti-title">{{ x.title }}</span><span class="down num">{{ x.change }}</span>
                  </div>
                </div>
                <div v-if="(curCatTrend.reads_growth || []).length" class="trend-box">
                  <h4>阅读增长</h4>
                  <div v-for="x in curCatTrend.reads_growth" :key="x.title" class="trend-item">
                    <span class="ti-title">{{ x.title }}</span><span class="growth num">{{ x.growth }}</span>
                  </div>
                </div>
                <div v-if="(curCatTrend.new_books || []).length" class="trend-box">
                  <h4>新上榜 <span class="badge-src num">{{ curCatTrend.new_books.length }}</span></h4>
                  <div v-for="t in curCatTrend.new_books" :key="t" class="trend-item">
                    <span class="ti-title">{{ t }}</span><span class="tag-new">NEW</span>
                  </div>
                </div>
                <div v-if="(curCatTrend.dropped_books || []).length" class="trend-box">
                  <h4>掉出榜单 <span class="badge-src num">{{ curCatTrend.dropped_books.length }}</span></h4>
                  <div v-for="(x, i) in curCatTrend.dropped_books" :key="i" class="trend-item">
                    <span class="ti-title">{{ typeof x === 'string' ? x : x.title }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.fanqie-page {
  display: flex;
  flex: 1;
  width: 100%;
  min-height: 100%;
  overflow-y: auto;
  background: var(--arc-bg-body);
  color: var(--arc-text-primary);
}
.fanqie-shell {
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: calc(var(--arc-titlebar-height) + 24px) clamp(16px, 2.6vw, 28px) 64px;
}
.num { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

.topbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 20px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--arc-border);
}
.topbar-lead { min-width: 0; }
.back-btn { margin-bottom: 8px; }
.topbar h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 760;
  letter-spacing: -0.02em;
  display: flex;
  align-items: center;
  gap: 10px;
}
.topbar h1 .flame { display: inline-flex; color: var(--arc-primary); }
.topbar .sub { margin: 6px 0 0; color: var(--arc-text-hint); font-size: 13px; }
.meta { text-align: right; font-size: 12px; color: var(--arc-text-hint); flex-shrink: 0; }
.meta .date { color: var(--arc-text-secondary); font-weight: 600; font-size: 13px; }
.refresh-btn {
  margin-top: 8px;
  border: 1px solid var(--arc-border-strong);
  background: var(--arc-bg-surface);
  color: var(--arc-text-secondary);
  border-radius: var(--arc-radius-md);
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.18s, color 0.18s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.refresh-btn:hover:not(:disabled) { border-color: var(--arc-primary); color: var(--arc-primary); }
.refresh-btn:disabled { opacity: 0.5; cursor: default; }
.src-note { font-size: 11px; color: var(--arc-text-hint); margin-top: 6px; }

.board-tabs { display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap; }
.board-tab {
  border: 1px solid var(--arc-border);
  background: var(--arc-bg-surface);
  color: var(--arc-text-secondary);
  padding: 9px 20px;
  border-radius: var(--arc-radius-md);
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 8px;
}
.board-tab:hover { border-color: var(--arc-border-strong); color: var(--arc-text-primary); }
.board-tab.active { background: var(--arc-primary); border-color: var(--arc-primary); color: #fff; box-shadow: var(--arc-shadow-sm); }
.board-tab.empty { opacity: 0.5; }
.board-tab .ch {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--arc-bg-surface-hover);
  color: var(--arc-text-hint);
  font-weight: 600;
}
.board-tab.active .ch { background: rgba(255,255,255,0.22); color: #fff; }

.period-tabs {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  background: var(--arc-bg-weak);
  border: 1px solid var(--arc-border);
  border-radius: 999px;
  margin-bottom: 22px;
}
.period-tab {
  border: none;
  background: transparent;
  color: var(--arc-text-secondary);
  padding: 7px 18px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.18s;
}
.period-tab:hover { color: var(--arc-text-primary); }
.period-tab.active { background: var(--arc-primary); color: #fff; box-shadow: var(--arc-shadow-sm); }
.summary-card {
  background: linear-gradient(135deg, var(--arc-primary-soft), transparent 80%);
  border: 1px solid var(--arc-border);
  border-left: 3px solid var(--arc-primary);
  border-radius: var(--arc-radius-lg);
  padding: 16px 20px;
  margin-bottom: 24px;
}
.summary-card .label {
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--arc-primary);
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.summary-card .text { font-size: 14.5px; color: var(--arc-text-primary); margin: 0; }
.badge-src {
  font-size: 10px;
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid var(--arc-border-strong);
  color: var(--arc-text-hint);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.section { margin-bottom: 30px; }
.section-title {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--arc-text-primary);
}
.section-title .hint { font-size: 12px; color: var(--arc-text-hint); font-weight: 400; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 14px; }
.genre-card {
  background: var(--arc-bg-surface);
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-lg);
  padding: 16px;
  transition: all 0.18s;
  position: relative;
  overflow: hidden;
}
.genre-card:hover { border-color: var(--arc-border-strong); transform: translateY(-2px); }
.genre-card .rank-no {
  position: absolute;
  top: 10px;
  right: 14px;
  font-size: 30px;
  font-weight: 800;
  color: var(--arc-bg-surface-hover);
  line-height: 1;
}
.genre-card.top1 .rank-no { color: color-mix(in srgb, var(--arc-primary) 22%, transparent); }
.genre-card .name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.genre-card .lead { font-size: 12px; color: var(--arc-text-hint); margin-bottom: 12px; }
.genre-card .lead b { color: var(--arc-primary); font-weight: 600; }
.genre-card .score { font-size: 22px; font-weight: 800; color: var(--arc-success, #15803d); letter-spacing: -0.02em; }
.genre-card .score small { font-size: 12px; color: var(--arc-text-hint); font-weight: 500; margin-left: 4px; }
.genre-card .cats { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 12px; }
.chip {
  font-size: 11px;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--arc-bg-weak);
  border: 1px solid var(--arc-border);
  color: var(--arc-text-secondary);
}

.themes { display: flex; flex-wrap: wrap; gap: 9px; }
.theme-tag {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--arc-bg-surface);
  border: 1px solid var(--arc-border);
  transition: all 0.18s;
}
.theme-tag:hover { border-color: var(--arc-primary); background: var(--arc-primary-soft); }
.theme-tag .t-name { font-weight: 600; }
.theme-tag .t-count { font-size: 11px; color: var(--arc-text-hint); }

.type-list { display: flex; flex-direction: column; gap: 9px; }
.type-row { display: grid; grid-template-columns: 90px 1fr 80px; align-items: center; gap: 12px; }
.type-row .t-label { font-size: 13px; font-weight: 600; text-align: right; }
.type-row .t-bar-wrap { height: 22px; background: var(--arc-bg-weak); border-radius: 6px; overflow: hidden; }
.type-row .t-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--arc-primary), #ff9466);
  border-radius: 6px;
  transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}
.type-row .t-val { font-size: 12px; color: var(--arc-text-secondary); }

.cat-selector { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 18px; }
.cat-btn {
  border: 1px solid var(--arc-border);
  background: var(--arc-bg-surface);
  color: var(--arc-text-secondary);
  padding: 5px 13px;
  border-radius: 999px;
  font-size: 12.5px;
  cursor: pointer;
  transition: all 0.16s;
}
.cat-btn:hover { border-color: var(--arc-border-strong); color: var(--arc-text-primary); }
.cat-btn.active { background: var(--arc-primary-soft); border-color: var(--arc-primary); color: var(--arc-primary); font-weight: 600; }

.cat-detail { display: grid; grid-template-columns: 1fr 320px; gap: 20px; }
@media (max-width: 880px) { .cat-detail { grid-template-columns: 1fr; } }

.book-list { display: flex; flex-direction: column; gap: 10px; }
.book-card {
  display: flex;
  gap: 12px;
  background: var(--arc-bg-surface);
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-md);
  padding: 12px;
  transition: all 0.16s;
}
.book-card:hover { border-color: var(--arc-border-strong); }
.book-card .bk-rank { flex-shrink: 0; width: 26px; font-size: 17px; font-weight: 800; color: var(--arc-text-hint); text-align: center; }
.book-card:nth-child(-n+3) .bk-rank { color: var(--arc-primary); }
.book-card img { width: 52px; height: 70px; object-fit: cover; border-radius: 5px; flex-shrink: 0; background: var(--arc-bg-weak); }
.book-card .bk-info { min-width: 0; flex: 1; }
.book-card .bk-title { font-size: 14px; font-weight: 700; margin-bottom: 2px; display: flex; align-items: center; gap: 7px; }
.book-card .bk-meta { font-size: 12px; color: var(--arc-text-hint); margin-bottom: 5px; }
.book-card .bk-reads { color: var(--arc-success, #15803d); font-weight: 600; }
.book-card .bk-intro {
  font-size: 12px;
  color: var(--arc-text-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.trend-side { display: flex; flex-direction: column; gap: 14px; }
.trend-box { background: var(--arc-bg-surface); border: 1px solid var(--arc-border); border-radius: var(--arc-radius-md); padding: 14px; }
.trend-box h4 { margin: 0 0 10px; font-size: 13px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
.trend-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12.5px;
  padding: 4px 0;
  border-bottom: 1px dashed var(--arc-border);
}
.trend-item:last-child { border-bottom: none; }
.trend-item .ti-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--arc-text-secondary); }
.trend-item .up { color: var(--arc-success, #15803d); font-weight: 700; flex-shrink: 0; }
.trend-item .down { color: var(--arc-danger, #dc2626); font-weight: 700; flex-shrink: 0; }
.trend-item .growth { color: var(--arc-warning, #a16207); font-weight: 700; flex-shrink: 0; }
.tag-new { font-size: 10px; padding: 0 6px; border-radius: 4px; background: var(--arc-success, #15803d); color: #fff; font-weight: 700; }

.cat-summary {
  background: var(--arc-bg-weak);
  border: 1px solid var(--arc-border);
  border-radius: var(--arc-radius-md);
  padding: 14px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--arc-text-secondary);
  margin-bottom: 18px;
}
.cat-summary :deep(strong) { color: var(--arc-text-primary); }

.state { text-align: center; padding: 80px 20px; color: var(--arc-text-hint); }
.state .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--arc-border);
  border-top-color: var(--arc-primary);
  border-radius: 50%;
  margin: 0 auto 16px;
  animation: fanqie-spin 0.8s linear infinite;
}
@keyframes fanqie-spin { to { transform: rotate(360deg); } }
.state .err-detail { font-size: 12px; margin-top: 10px; color: var(--arc-danger, #dc2626); }
</style>


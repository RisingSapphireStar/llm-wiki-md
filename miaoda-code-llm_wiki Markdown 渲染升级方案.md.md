# llm_wiki Markdown 渲染升级方案

> 基于 md-view Plus 渲染能力，对 llm_wiki 的 Markdown 渲染进行渐进式增强
> 方案原则：不替换现有 react-markdown 架构，通过插件增补和样式优化达到同等渲染质量

## 参考仓库

| 项目 | 仓库地址 |
|---|---|
| llm_wiki（改造目标） | <https://github.com/nashsu/llm_wiki> |
| md-view（渲染参考） | <https://github.com/T-meow/md-view> |

## 目录

- [一、现状与问题分析](#一现状与问题分析)
- [二、总体改造策略](#二总体改造策略)
- [三、分模块详细改造方案](#三分模块详细改造方案)
  - [3.1 表格渲染优化](#31-表格渲染优化)
  - [3.2 数学公式（KaTeX）优化](#32-数学公式katex优化)
  - [3.3 代码块语法高亮](#33-代码块语法高亮)
  - [3.4 GitHub 风格 Alert 告警块](#34-github-风格-alert-告警块)
  - [3.5 TOC 目录自动生成](#35-toc-目录自动生成)
  - [3.6 Frontmatter 属性卡片化](#36-frontmatter-属性卡片化)
  - [3.7 内联扩展语法（高亮/下标/上标）](#37-内联扩展语法高亮下标上标)
  - [3.8 Mermaid 图表增强](#38-mermaid-图表增强)
- [四、涉及改动的文件清单](#四涉及改动的文件清单)
- [五、实施步骤与排期](#五实施步骤与排期)
- [六、风险与注意事项](#六风险与注意事项)

---

## 一、现状与问题分析

### 1.1 当前技术栈

llm_wiki 的 Markdown 渲染存在两条链路：

| 渲染场景 | 使用组件 | 底层方案 |
|---|---|---|
| Wiki 页面阅读 | `WikiReader` | react-markdown + remark-gfm + remark-math + rehype-katex |
| Wiki 页面编辑 | `WikiEditor`（Milkdown） | @milkdown/kit + @milkdown/plugin-math |
| 聊天消息 | `ChatMessage` | react-markdown + remark-gfm + remark-math + rehype-katex |

### 1.2 核心问题清单

| 模块 | 问题描述 | 严重程度 |
|---|---|---|
| **表格** | 字号过小（text-xs）、边框简陋、无斑马纹、表头区分度弱 | 高 |
| **公式** | KaTeX 默认 strict 模式，异常语法直接报错不渲染 | 高 |
| **代码块** | 无语法高亮、无语言标签、无复制按钮 | 中高 |
| **Alert 块** | 不支持 `[!NOTE]` / `[!WARNING]` 等 GitHub 风格告警语法 | 中 |
| **TOC** | 不支持 `[toc]` 自动生成目录 | 中 |
| **Frontmatter** | 仅侧边面板展示，正文内无渲染 | 低 |
| **内联扩展** | 不支持 ==高亮==、~下标~、^上标^ 等扩展语法 | 低 |
| **Mermaid** | 基础渲染可用，但缺少缩放、复制源码等交互 | 低 |

### 1.3 与 md-view Plus 的差距本质

md-view Plus 底层同样使用 `remark-gfm + remark-math + rehype-katex`，核心差异不在于渲染引擎，而在于：
1. **插件更全**：多了 rehype-highlight、remark-frontmatter 等
2. **后处理更丰富**：DOM 层面增强（alert 块、代码工具栏、TOC 注入）
3. **样式更精细**：完整的设计 token 体系，表格/代码块/引用样式打磨更细
4. **容错配置**：KaTeX 开启 `strict: false`

---

## 二、总体改造策略

### 2.1 方案选型

**❌ 不推荐：完整移植 md-view-pro 渲染器**
- 框架差异（Svelte → React）导致组件层需要完全重写
- Wikilink 体系冲突（llm_wiki 已有完整的 slug 解析 + 页面跳转逻辑）
- Milkdown 编辑模式与新阅读模式渲染一致性难保证
- 预估工作量：7 人天以上，风险高

**✅ 推荐：基于 react-markdown 渐进增强**
- 保留现有 React 架构，零框架迁移成本
- 通过 remark/rehype 插件补齐能力缺口
- 样式层面参考 md-view 的设计 token 进行优化
- 预估工作量：3-4 人天，风险可控

### 2.2 改造范围

优先改造 `WikiReader`（wiki-reader.tsx），验证效果后同步到 `ChatMessage`（chat-message.tsx）。
Milkdown 编辑器链路暂不动，避免影响编辑功能稳定性。

---

## 三、分模块详细改造方案

### 3.1 表格渲染优化

#### 问题
当前表格使用 `text-xs` 字号，视觉上拥挤；边框和表头样式简陋，可读性差。

#### 改造内容

**文件：`src/components/editor/wiki-reader.tsx`**

修改 `components` 中的 table / thead / th / td 配置：

```tsx
// 替换现有 table 组件
table: ({ children, ...props }) => (
  <div className="my-4 overflow-x-auto rounded-lg border border-border/60 shadow-sm">
    <table className="w-full border-collapse text-sm" {...props}>
      {children}
    </table>
  </div>
),

// thead 加深背景
thead: ({ children, ...props }) => (
  <thead className="bg-muted/80" {...props}>
    {children}
  </thead>
),

// th 加粗 + 加重边框
th: ({ node, children, ...props }) => (
  <th
    {...sourceAttrs(node)}
    className="border border-border/70 bg-muted/90 px-4 py-2.5 text-left font-semibold text-foreground"
    {...props}
  >
    {children}
  </th>
),

// td 增加内边距
td: ({ node, children, ...props }) => (
  <td
    {...sourceAttrs(node)}
    className="border border-border/50 px-4 py-2 text-foreground/90"
    {...props}
  >
    {children}
  </td>
),
```

**新增：全局 CSS 斑马纹（src/index.css）**

```css
/* 表格斑马纹 */
.prose tbody tr:nth-child(even) {
  background-color: color-mix(in srgb, var(--muted) 30%, transparent);
}

.prose tbody tr:hover {
  background-color: color-mix(in srgb, var(--muted) 50%, transparent);
}
```

#### 验收标准
- 表头背景清晰可辨
- 奇偶行斑马纹提升可读性
- 字号从 xs 提升到 sm，阅读舒适
- 超长表格横向滚动不溢出

---

### 3.2 数学公式（KaTeX）优化

#### 问题
rehype-katex 默认 strict 模式，遇到不标准的 LaTeX 语法（如未定义命令、多余花括号）会直接抛出错误导致整段公式不渲染。

#### 改造内容

**文件：`src/components/editor/wiki-reader.tsx`**

```tsx
// 修改前
rehypePlugins={[rehypeKatex]}

// 修改后
rehypePlugins={[
  [rehypeKatex, {
    strict: false,           // 容错模式，不标准语法降级显示而非报错
    throwOnError: false,     // 渲染失败不抛异常
    trust: true,             // 允许 \href 等命令（按需开启）
  }]
]}
```

**同步修改：`src/components/chat/chat-message.tsx` 中的同名配置**

#### 可选增强：补充 KaTeX 宏包

如果遇到特定数学环境（如 `\begin{cases}`、矩阵等）渲染异常，检查 katex 版本是否支持。当前 0.16.x 已覆盖大部分常用环境，一般无需额外配置。

#### 验收标准
- 语法有瑕疵的公式也能降级渲染，不会整块空白
- 标准 LaTeX 公式渲染效果不变

---

### 3.3 代码块语法高亮

#### 问题
当前代码块无语法高亮，纯单色显示，可读性差；缺少语言标签和一键复制功能。

#### 改造内容

**步骤 1：安装依赖**

```bash
npm install rehype-highlight highlight.js
```

**步骤 2：WikiReader 组件引入**

**文件：`src/components/editor/wiki-reader.tsx`**

```tsx
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'  // 按需选择主题，暗色模式用 github-dark
```

```tsx
// 添加到 rehypePlugins
rehypePlugins={[
  [rehypeKatex, { strict: false, throwOnError: false }],
  rehypeHighlight,  // 新增
]}
```

**步骤 3：自定义代码块工具栏组件**

新增文件 `src/components/code-block-toolbar.tsx`：

```tsx
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface CodeBlockToolbarProps {
  language?: string
  code: string
}

export function CodeBlockToolbar({ language, code }: CodeBlockToolbarProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex items-center justify-between border-b border-border/40 bg-muted/30 px-3 py-1.5 text-xs">
      <span className="font-mono text-muted-foreground">{language || 'code'}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  )
}
```

**步骤 4：在 WikiReader 的 pre 组件中接入**

```tsx
pre: ({ children, ...props }) => {
  const mermaid = unwrapMermaidPre(children)
  if (mermaid) return <>{mermaid}</>
  
  // 提取代码语言和内容
  const codeChild = Array.isArray(children) 
    ? children.find(c => c?.type === 'code') 
    : children?.type === 'code' ? children : null
  const lang = codeChild?.props?.className?.replace('language-', '')
  const codeText = codeChild ? String(codeChild.props?.children ?? '').replace(/\n$/, '') : ''

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border/60">
      {lang && lang !== 'mermaid' && (
        <CodeBlockToolbar language={lang} code={codeText} />
      )}
      <pre dir="ltr" style={{ textAlign: 'left', margin: 0 }} {...props}>
        {children}
      </pre>
    </div>
  )
},
```

#### 验收标准
- 主流语言（Python/JS/TS/JSON/Bash 等）代码正确高亮
- 代码块顶部显示语言标签
- 点击复制按钮可复制完整代码，带复制成功反馈

---

### 3.4 GitHub 风格 Alert 告警块

#### 问题
不支持 Obsidian / GitHub 文档中常见的 `[!NOTE]`、`[!WARNING]` 等告警块语法。

#### 改造内容

实现方式：写一个轻量 rehype 插件，在 DOM 生成后扫描 blockquote，识别首行的 `[!TYPE]` 标记并转换。

新增文件 `src/lib/rehype-alerts.ts`：

```ts
import type { Plugin } from 'unified'
import type { Element, Root } from 'hast'

const ALERT_TYPES = [
  'note', 'tip', 'important', 'warning', 'caution',
  'info', 'success', 'question', 'failure', 'danger',
  'bug', 'example', 'quote'
]

const ALERT_TITLES: Record<string, string> = {
  note: '备注', tip: '提示', important: '重要',
  warning: '警告', caution: '注意', info: '信息',
  success: '成功', question: '疑问', failure: '失败',
  danger: '危险', bug: 'Bug', example: '示例', quote: '引用'
}

export const rehypeAlerts: Plugin<[], Root> = () => {
  return (tree) => {
    const visit = (node: any) => {
      if (node.tagName === 'blockquote') {
        const firstChild = node.children?.[0]
        if (firstChild?.tagName === 'p') {
          const firstText = firstChild.children?.[0]
          if (firstText?.type === 'text') {
            const match = firstText.value.match(/^\[!([A-Za-z]+)\]([^\n]*)/)
            if (match) {
              const type = match[1].toLowerCase()
              const titleText = match[2].trim()
              if (ALERT_TYPES.includes(type)) {
                // 移除标记文本
                firstText.value = firstText.value.slice(match[0].length).replace(/^\s+/, '')
                
                // 添加 class
                node.properties = node.properties || {}
                node.properties.className = [
                  ...(node.properties.className || []),
                  'md-alert',
                  `md-alert-${type}`
                ]
                
                // 插入标题行
                const titleNode: Element = {
                  type: 'element',
                  tagName: 'div',
                  properties: { className: ['md-alert-title'] },
                  children: [{ type: 'text', value: titleText || ALERT_TITLES[type] || type }]
                }
                node.children.unshift(titleNode)
              }
            }
          }
        }
      }
      node.children?.forEach(visit)
    }
    tree.children.forEach(visit)
  }
}
```

**注册到 WikiReader：**

```tsx
import { rehypeAlerts } from '@/lib/rehype-alerts'

// rehypePlugins 中追加
rehypePlugins={[
  [rehypeKatex, { strict: false, throwOnError: false }],
  rehypeHighlight,
  rehypeAlerts,  // 新增
]}
```

**新增样式（src/index.css）：**

```css
/* Alert 告警块 */
.md-alert {
  border-left: 4px solid;
  padding: 0.75rem 1rem;
  margin: 1rem 0;
  border-radius: 0 0.375rem 0.375rem 0;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
}

.md-alert-title {
  font-weight: 600;
  margin-bottom: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.md-alert-note { border-color: #3b82f6; color: #2563eb; }
.md-alert-tip { border-color: #10b981; color: #059669; }
.md-alert-warning { border-color: #f59e0b; color: #d97706; }
.md-alert-danger, .md-alert-caution { border-color: #ef4444; color: #dc2626; }
.md-alert-info { border-color: #06b6d4; color: #0891b2; }
.md-alert-success { border-color: #22c55e; color: #16a34a; }
```

#### 验收标准
- `> [!NOTE]` 语法正确渲染为带颜色左边框的提示块
- 支持自定义标题：`> [!WARNING] 自定义标题`
- 13 种告警类型颜色区分清晰

---

### 3.5 TOC 目录自动生成

#### 改造内容

**方案：使用 remark-toc 插件**

```bash
npm install remark-toc
```

```tsx
import remarkToc from 'remark-toc'

// remarkPlugins 中追加（在 remarkGfm 之后）
remarkPlugins={[remarkGfm, remarkMath, [remarkToc, { heading: 'toc|目录', tight: true }]]}
```

使用方式：在 Markdown 中写 `## 目录` 或 `## TOC`，其下方会自动插入目录列表。

#### 验收标准
- 文档中 `## 目录` 标题下自动生成带锚点链接的目录
- 目录层级正确对应 h1~h6

---

### 3.6 Frontmatter 属性卡片化

#### 问题
当前 frontmatter 仅在侧边面板展示，正文阅读时看不到元信息。

#### 改造内容

参考 md-view 的 properties 模式，在 WikiReader 正文顶部渲染属性卡片。

**新增组件 `src/components/editor/frontmatter-properties.tsx`：**

```tsx
interface FrontmatterProps {
  data: Record<string, any>
}

export function FrontmatterProperties({ data }: FrontmatterProps) {
  const entries = Object.entries(data).filter(([_, v]) => v !== undefined && v !== null)
  if (entries.length === 0) return null

  return (
    <section className="mb-6 rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 text-xs font-medium text-muted-foreground">页面属性</div>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <dt className="shrink-0 font-medium text-muted-foreground min-w-[4rem]">{key}:</dt>
            <dd className="text-foreground">
              {Array.isArray(value)
                ? value.map((v, i) => (
                    <span key={i} className="mr-1.5 inline-block rounded bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {String(v)}
                    </span>
                  ))
                : String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
```

**在 WikiReader 中接入：**

```tsx
// 从 content 解析 frontmatter（复用已有的 parseFrontmatter）
const { frontmatter } = useMemo(() => parseFrontmatter(body), [body])

return (
  <div className="prose prose-invert min-w-0 max-w-none" ...>
    {frontmatter && Object.keys(frontmatter).length > 0 && (
      <FrontmatterProperties data={frontmatter} />
    )}
    <ReactMarkdown ...>
```

#### 验收标准
- 页面顶部以卡片形式展示 tags / date / author 等元数据
- 数组类型值（如 tags）渲染为标签样式

---

### 3.7 内联扩展语法（高亮/下标/上标）

#### 改造内容

支持 `==高亮文本==`、`~下标~`、`^上标^` 语法，写一个轻量 remark 插件。

新增文件 `src/lib/remark-inline-extensions.ts`：

```ts
import type { Plugin } from 'unified'
import type { Root } from 'mdast'

export const remarkInlineExtensions: Plugin<[], Root> = () => {
  return (tree) => {
    // 遍历所有文本节点，替换 ==mark== / ~sub~ / ^sup^
    const visit = (node: any, parent: any, index: number) => {
      if (node.type === 'text') {
        const patterns = [
          { regex: /==([^=\n]+)==/g, tag: 'mark' },
          { regex: /\^([^\^\n]+)\^/g, tag: 'sup' },
          { regex: /~([^~\n]+)~/g, tag: 'sub' },
        ]
        
        let newChildren: any[] = [node]
        for (const { regex, tag } of patterns) {
          const result: any[] = []
          for (const item of newChildren) {
            if (item.type !== 'text') {
              result.push(item)
              continue
            }
            let lastIndex = 0
            let match
            regex.lastIndex = 0
            while ((match = regex.exec(item.value)) !== null) {
              if (match.index > lastIndex) {
                result.push({ type: 'text', value: item.value.slice(lastIndex, match.index) })
              }
              result.push({
                type: 'html',
                value: `<${tag}>${match[1]}</${tag}>`
              })
              lastIndex = match.index + match[0].length
            }
            if (lastIndex < item.value.length) {
              result.push({ type: 'text', value: item.value.slice(lastIndex) })
            }
          }
          newChildren = result
        }
        
        if (newChildren.length > 1) {
          parent.children.splice(index, 1, ...newChildren)
          return newChildren.length - 1
        }
      }
      
      if (node.children) {
        let i = 0
        while (i < node.children.length) {
          const skip = visit(node.children[i], node, i)
          i += skip ? skip : 1
        }
      }
      return 0
    }
    
    tree.children.forEach((child: any, i: number) => visit(child, tree, i))
  }
}
```

注册到 `remarkPlugins` 中即可。

---

### 3.8 Mermaid 图表增强

#### 改造内容
当前已有基础 Mermaid 渲染，参考 md-view 增加缩放工具栏：

- 放大 / 缩小 / 重置 / 适合宽度 四个按钮
- 复制源码按钮

在现有 `MermaidDiagram` 组件基础上增加工具栏包裹层即可，改动较小。

---

## 四、涉及改动的文件清单

### 新增文件
| 文件路径 | 说明 |
|---|---|
| `src/lib/rehype-alerts.ts` | Alert 告警块 rehype 插件 |
| `src/lib/remark-inline-extensions.ts` | 内联扩展 remark 插件 |
| `src/components/code-block-toolbar.tsx` | 代码块工具栏组件 |
| `src/components/editor/frontmatter-properties.tsx` | Frontmatter 属性卡片 |

### 修改文件
| 文件路径 | 改动内容 |
|---|---|
| `src/components/editor/wiki-reader.tsx` | 表格样式、KaTeX 配置、新增插件注册、代码块包装 |
| `src/components/chat/chat-message.tsx` | 同步 WikiReader 的核心优化（表格/公式/高亮） |
| `src/index.css` | 新增 Alert 样式、表格斑马纹样式等 |
| `package.json` | 新增依赖：rehype-highlight、highlight.js、remark-toc |

### 不动的文件
- `wiki-editor.tsx`（Milkdown 编辑模式）—— 避免影响编辑稳定性
- Milkdown 相关配置 —— 保持现状

---

## 五、实施步骤与排期

### 阶段一：核心痛点修复（1 天）

| 任务 | 预估工时 | 优先级 |
|---|---|---|
| 表格样式优化 | 2h | P0 |
| KaTeX 容错配置 | 0.5h | P0 |
| 同步到 ChatMessage 组件 | 1h | P0 |
| 联调验证 | 0.5h | P0 |

### 阶段二：代码高亮增强（1 天）

| 任务 | 预估工时 | 优先级 |
|---|---|---|
| 接入 rehype-highlight | 1h | P1 |
| 实现代码块工具栏（语言标签 + 复制） | 4h | P1 |
| 主题适配（亮暗模式） | 1h | P1 |
| 联调验证 | 1h | P1 |

### 阶段三：扩展功能增补（1-2 天）

| 任务 | 预估工时 | 优先级 |
|---|---|---|
| Alert 告警块插件 + 样式 | 3h | P2 |
| TOC 目录支持 | 1h | P2 |
| Frontmatter 属性卡片 | 2h | P2 |
| 内联扩展语法 | 2h | P3 |
| Mermaid 工具栏增强 | 2h | P3 |

**总工期：3-4 人天**

---

## 六、风险与注意事项

### 6.1 技术风险

| 风险 | 影响 | 应对措施 |
|---|---|---|
| rehype-highlight 包体积较大 | 首屏加载变慢 | highlight.js 按需引入语言包，不全部加载 |
| 插件顺序导致渲染异常 | 部分格式错乱 | 严格按 remark → rehype 顺序注册，逐项验证 |
| Tailwind prose 与自定义样式冲突 | 样式覆盖异常 | 自定义样式提高选择器优先级，用 `.prose .md-alert` 嵌套 |

### 6.2 兼容性注意事项

1. **Milkdown 一致性**：阅读模式升级后，编辑模式（Milkdown）渲染效果会有差异，属于可接受范围。若后续需要统一，再考虑 Milkdown 侧同步样式。

2. **Wikilink 逻辑**：保留 llm_wiki 原有的 `transformWikilinks` + `resolveRelatedSlug` 体系，不引入 md-view 的 wikilink 实现，避免页面跳转逻辑冲突。

3. **DOMPurify**：llm_wiki 走 React 组件渲染，自动转义 HTML，无需额外引入 DOMPurify。若后续开启 `allowDangerousHtml`，再考虑接入。

### 6.3 回滚方案

所有改动均在 react-markdown 的 `components` 和 `plugins` 配置范围内，如遇问题：
- 移除对应插件即可回退
- 样式改动集中在新增的 CSS 类，不影响原有 prose 样式
- 不涉及核心数据流和存储格式变更，零数据风险

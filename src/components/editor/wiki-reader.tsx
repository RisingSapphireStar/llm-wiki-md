import { useMemo, isValidElement, type ReactElement } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import rehypeHighlight from "rehype-highlight"
import remarkToc from "remark-toc"
import "katex/dist/katex.min.css"
import "highlight.js/styles/github-dark.css"
import { transformImageEmbeds, transformWikilinks } from "@/lib/wikilink-transform"
import { resolveRelatedSlug } from "@/lib/wiki-page-resolver"
import { resolveMarkdownImageSrc } from "@/lib/markdown-image-resolver"
import { normalizePath } from "@/lib/path-utils"
import { detectLanguage } from "@/lib/detect-language"
import { getHtmlLang, getTextDirection } from "@/lib/language-metadata"
import { parseFrontmatter } from "@/lib/frontmatter"
import { rehypeAlerts } from "@/lib/rehype-alerts"
import { remarkInlineExtensions } from "@/lib/remark-inline-extensions"
import { useWikiStore } from "@/stores/wiki-store"
import { MermaidDiagram, unwrapMermaidPre } from "@/components/mermaid-diagram"
import { CodeBlockToolbar } from "@/components/code-block-toolbar"
import { FrontmatterProperties } from "@/components/editor/frontmatter-properties"

interface WikiReaderProps {
  body: string
  /** Original, untransformed Markdown body used for DOM-to-source mapping. */
  sourceBody?: string
  /** Character offset where sourceBody begins in the full Markdown file. */
  sourceOffset?: number
  /**
   * Absolute path of the markdown file being rendered. Used to
   * resolve relative image references against the file's own
   * directory (Obsidian-style), so e.g. `../assets/x.png` works.
   * Optional — when omitted, image paths fall back to wiki-root
   * resolution.
   */
  filePath?: string
}

/**
 * Read-only render of a wiki page body. Distinct from WikiEditor
 * (Milkdown WYSIWYG) because Milkdown round-trips the markdown
 * through prosemirror — applying our wikilink → markdown-link
 * pre-processing there would mean the user's saves overwrite the
 * original `[[…]]` source with `[label](#slug)`. Here, since we
 * never serialize back to disk, transforming for display is safe.
 *
 * Wikilink anchor clicks are intercepted: `#slug` is resolved
 * against the project's wiki tree and routed to the wiki preview,
 * giving the user single-click navigation between pages.
 */
export function WikiReader({ body, sourceBody, sourceOffset = 0, filePath }: WikiReaderProps) {
  const project = useWikiStore((s) => s.project)
  const projectPathIndex = useWikiStore((s) => s.projectPathIndex)
  const openPathInPreview = useWikiStore((s) => s.openPathInPreview)

  // Parse frontmatter for display
  const { frontmatter, body: bodyWithoutFrontmatter } = useMemo(
    () => parseFrontmatter(body),
    [body],
  )

  // Image embeds (`![[…]]`) must be rewritten BEFORE the generic
  // wikilink pass, otherwise the embed target gets mangled into a
  // `#fragment` link.
  const transformed = useMemo(
    () => transformWikilinks(transformImageEmbeds(bodyWithoutFrontmatter)),
    [bodyWithoutFrontmatter],
  )
  const sourceLineStarts = useMemo(() => {
    if (sourceBody === undefined) return null
    const starts = [0]
    for (let index = 0; index < sourceBody.length; index += 1) {
      if (sourceBody.charCodeAt(index) === 10) starts.push(index + 1)
    }
    return starts
  }, [sourceBody])

  const sourceAttrs = (node: unknown): Record<string, number> => {
    if (!sourceLineStarts) return {}
    const position = (node as { position?: { start?: { line?: number }; end?: { line?: number } } } | undefined)?.position
    const startLine = position?.start?.line
    const endLine = position?.end?.line
    if (!startLine || !endLine) return {}
    const start = sourceLineStarts[startLine - 1]
    const end = sourceLineStarts[endLine] ?? sourceBody?.length
    if (start === undefined || end === undefined) return {}
    return { "data-source-start": sourceOffset + start, "data-source-end": sourceOffset + end }
  }
  const renderLanguage = detectLanguage(bodyWithoutFrontmatter)
  const direction = getTextDirection(renderLanguage)
  const htmlLang = getHtmlLang(renderLanguage)
  const projectPath = project ? normalizePath(project.path) : null
  const wikiRoot = projectPath ? `${projectPath}/wiki` : null
  // Directory of the file being rendered (project-absolute), so
  // relative image srcs resolve against it like Obsidian does.
  const currentFileDir = useMemo(() => {
    if (!filePath) return null
    const norm = normalizePath(filePath)
    const dir = norm.slice(0, norm.lastIndexOf("/"))
    return dir || null
  }, [filePath])

  function handleAnchorClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("#")) return
    e.preventDefault()
    if (!wikiRoot) return
    const slug = (() => {
      try {
        return decodeURIComponent(href.slice(1))
      } catch {
        return href.slice(1)
      }
    })()
    const path = resolveRelatedSlug(projectPathIndex, slug, wikiRoot)
    if (path) openPathInPreview(path)
  }

  return (
    <div
      className="prose prose-invert min-w-0 max-w-none"
      dir={direction}
      lang={htmlLang}
      style={{ textAlign: "start" }}
    >
      {frontmatter && Object.keys(frontmatter).length > 0 && (
        <FrontmatterProperties data={frontmatter} />
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkInlineExtensions, [remarkToc, { heading: 'toc|目录', tight: true }]]}
        rehypePlugins={[
          [rehypeKatex, { strict: false, throwOnError: false }],
          rehypeHighlight,
          rehypeAlerts,
        ]}
        components={{
          p: ({ node, children, ...props }) => <p {...sourceAttrs(node)} {...props}>{children}</p>,
          li: ({ node, children, ...props }) => <li {...sourceAttrs(node)} {...props}>{children}</li>,
          blockquote: ({ node, children, ...props }) => <blockquote {...sourceAttrs(node)} {...props}>{children}</blockquote>,
          a: ({ href, children, ...props }) => {
            const h = typeof href === "string" ? href : ""
            const isWikilink = h.startsWith("#")
            return (
              <a
                href={h || undefined}
                onClick={(e) => isWikilink && handleAnchorClick(e, h)}
                className={
                  isWikilink
                    ? "cursor-pointer text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
                    : "text-primary underline underline-offset-2"
                }
                {...props}
              >
                {children}
              </a>
            )
          },
          h1: ({ node, children, ...props }) => (
            <h1
              {...sourceAttrs(node)}
              className="mb-4 mt-0 border-b border-border/60 pb-3 text-3xl font-semibold leading-tight tracking-normal text-foreground"
              {...props}
            >
              {children}
            </h1>
          ),
          h2: ({ node, children, ...props }) => (
            <h2
              {...sourceAttrs(node)}
              className="mb-3 mt-8 border-b border-border/40 pb-2 text-2xl font-semibold leading-tight tracking-normal text-foreground"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ node, children, ...props }) => (
            <h3
              {...sourceAttrs(node)}
              className="mb-2 mt-6 text-xl font-semibold leading-snug tracking-normal text-foreground"
              {...props}
            >
              {children}
            </h3>
          ),
          img: ({ src, alt, ...props }) => (
            <img
              src={
                typeof src === "string"
                  ? resolveMarkdownImageSrc(src, projectPath, currentFileDir)
                  : undefined
              }
              data-mdsrc={typeof src === "string" ? src : undefined}
              alt={alt ?? ""}
              className="max-w-full rounded border border-border/40"
              loading="lazy"
              {...props}
            />
          ),
          table: ({ children, ...props }) => (
            <div className="my-4 overflow-x-auto rounded-lg border border-border/60 shadow-sm">
              <table className="w-full border-collapse text-sm" {...props}>
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...props }) => (
            <thead className="bg-muted/80" {...props}>
              {children}
            </thead>
          ),
          th: ({ node, children, ...props }) => (
            <th
              {...sourceAttrs(node)}
              className="border border-border/70 bg-muted/90 px-4 py-2.5 text-left font-semibold text-foreground"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ node, children, ...props }) => (
            <td
              {...sourceAttrs(node)}
              className="border border-border/50 px-4 py-2 text-foreground/90"
              {...props}
            >
              {children}
            </td>
          ),
          pre: ({ children, ...props }) => {
            const mermaid = unwrapMermaidPre(children)
            if (mermaid) return <>{mermaid}</>
            
            // Extract code language and content for toolbar.
            // ReactMarkdown renders <pre><code>...</code></pre>, so the code
            // element is either the single child or the first element child.
            type CodeElProps = { className?: string; children?: unknown }
            const isCodeEl = (c: unknown): c is ReactElement<CodeElProps> =>
              isValidElement(c) && c.type === 'code'
            const findCodeEl = (): ReactElement<CodeElProps> | null => {
              if (Array.isArray(children)) {
                return children.find(isCodeEl) ?? null
              }
              return isCodeEl(children) ? children : null
            }
            const codeChild = findCodeEl()
            const lang = codeChild?.props?.className?.replace('language-', '')
            const codeText = codeChild ? String(codeChild.props?.children ?? '').replace(/\n$/, '') : ''

            return (
              <div className="my-3 overflow-hidden rounded-lg border border-border/60">
                {lang && lang !== 'mermaid' && (
                  <CodeBlockToolbar language={lang} code={codeText} />
                )}
                <pre dir="ltr" style={{ textAlign: "left", margin: 0 }} {...props}>
                  {children}
                </pre>
              </div>
            )
          },
          code: ({ className, children, ...props }) => {
            const lang = className?.replace("language-", "")
            const codeText = String(children).replace(/\n$/, "")
            if (lang === "mermaid") return <MermaidDiagram code={codeText} />
            return <code dir="ltr" className={className} {...props}>{children}</code>
          },
        }}
      >
        {transformed}
      </ReactMarkdown>
    </div>
  )
}

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

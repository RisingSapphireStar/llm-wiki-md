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

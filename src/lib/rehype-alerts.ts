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

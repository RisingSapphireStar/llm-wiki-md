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

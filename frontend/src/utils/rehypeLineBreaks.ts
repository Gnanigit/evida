// Minimal hast node shape; avoids a type-only dependency.
type HastNode = {
  type: string
  value?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

const BR_TAG = /^<br\s*\/?>$/i

// Models often put <br> inside Markdown table cells, where real newlines are
// not allowed. react-markdown shows raw HTML as plain text (it never renders
// it), so convert exactly these tags into line breaks and leave every other
// HTML snippet as text.
function convertBreaks(node: HastNode) {
  if (!node.children) return
  node.children = node.children.map((child) => {
    if (child.type === 'raw' && child.value !== undefined && BR_TAG.test(child.value.trim())) {
      return { type: 'element', tagName: 'br', properties: {}, children: [] }
    }
    convertBreaks(child)
    return child
  })
}

export default function rehypeLineBreaks() {
  return (tree: HastNode) => {
    convertBreaks(tree)
  }
}

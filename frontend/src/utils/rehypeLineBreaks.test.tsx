import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeLineBreaks from './rehypeLineBreaks'

function render(markdown: string) {
  return renderToStaticMarkup(
    <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeLineBreaks]}>
      {markdown}
    </Markdown>,
  )
}

describe('rehypeLineBreaks', () => {
  it('turns <br> variants inside table cells into line breaks', () => {
    const html = render(
      ['| Section | Content |', '|---|---|', '| Meta | • One <br>• Two<br/>• Three <BR /> • Four |'].join(
        '\n',
      ),
    )

    expect(html).toContain('<td>• One <br/>• Two<br/>• Three <br/> • Four</td>')
    expect(html).not.toContain('&lt;br')
  })

  it('turns <br> in normal text into a line break', () => {
    expect(render('First line<br>second line')).toBe('<p>First line<br/>second line</p>')
  })

  it('keeps every other HTML tag as plain text', () => {
    const html = render('Hello <script>alert(1)</script> <b>bold</b>')

    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;script&gt;')
  })
})

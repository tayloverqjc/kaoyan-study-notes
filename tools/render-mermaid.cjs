'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const MERMAID_PATTERN = /<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

function decodeHtmlEntities(str) {
  return str
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function findExecutablePath() {
  if (process.env.PLAYWRIGHT_CHROME_PATH && fs.existsSync(process.env.PLAYWRIGHT_CHROME_PATH)) {
    return process.env.PLAYWRIGHT_CHROME_PATH;
  }
  const winFallback = path.join(
    process.env.LOCALAPPDATA || '',
    'ms-playwright', 'chromium_headless_shell-1194', 'chrome-win', 'headless_shell.exe'
  );
  if (process.env.LOCALAPPDATA && fs.existsSync(winFallback)) {
    return winFallback;
  }
  return undefined;
}

async function main() {
  const files = process.argv.slice(2);
  if (!files.length) {
    console.error('Usage: node tools/render-mermaid.cjs <html-file> [...]');
    process.exit(1);
  }

  const launchOpts = { headless: true };
  const execPath = findExecutablePath();
  if (execPath) launchOpts.executablePath = execPath;
  if (process.platform === 'linux') {
    launchOpts.args = ['--no-sandbox', '--disable-setuid-sandbox'];
  }

  const browser = await chromium.launch(launchOpts);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    await page.addScriptTag({ path: require.resolve('mermaid/dist/mermaid.min.js') });
    await page.evaluate(() => {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' }
      });
    });

    let totalRendered = 0;
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = [...content.matchAll(MERMAID_PATTERN)];
      if (!matches.length) continue;

      let out = '';
      let lastIndex = 0;
      let idx = 0;
      for (const m of matches) {
        out += content.slice(lastIndex, m.index);
        const code = decodeHtmlEntities(m[1]).trim();
        const diagramId = `diagram-${idx}`;
        const svg = await page.evaluate(async ({ id, src }) => {
          const { svg: rendered } = await window.mermaid.render(id, src);
          return rendered;
        }, { id: diagramId, src: code });
        idx++;
        totalRendered++;
        out += `<div class="diagram-scroll" role="img" aria-label="流程图 ${idx}">${svg}</div>`;
        lastIndex = m.index + m[0].length;
      }
      out += content.slice(lastIndex);
      fs.writeFileSync(filePath, out, 'utf8');
      console.log(`Rendered ${idx} mermaid diagram(s) in ${path.basename(filePath)}`);
    }

    console.log(`Total mermaid diagrams rendered: ${totalRendered}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

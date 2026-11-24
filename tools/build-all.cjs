'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const reportDir = path.join(distDir, '.build-reports');
const buildNoteScript = path.join(__dirname, 'build-note.cjs');
const renderMermaidScript = path.join(__dirname, 'render-mermaid.cjs');
const upgradeScript = path.join(__dirname, 'upgrade-readers-and-index.cjs');

const SUBJECTS = [
  { key: 'os', title: '操作系统', dir: path.join(root, 'notes', 'os', '复盘') },
  { key: 'network', title: '计算机网络', dir: path.join(root, 'notes', 'network', '复盘') },
  { key: 'architecture', title: '计算机组成原理', dir: path.join(root, 'notes', 'architecture', '复盘') },
  { key: 'ds', title: '数据结构', dir: path.join(root, 'notes', 'ds', '复盘') },
  { key: 'math', title: '高等数学 · 强化', dir: path.join(root, 'notes', 'math', '知识点与考点整理') },
  { key: 'linear', title: '线性代数 · 强化', dir: path.join(root, 'notes', 'linear') }
];

const LINEAR_TITLES = {
  1: '第1～2讲 · 行列式与余子式',
  2: '第3—4讲 · 矩阵运算与矩阵的秩',
  3: '第5—6讲 · 线性方程组与向量组',
  4: '第7—8讲 · 特征值与相似理论',
  5: '第9讲 · 二次型'
};

const PREFERRED_TITLES = {
  math: {
    9: '一元函数积分学的计算｜二轮强化复盘',
    10: '一元函数积分学的应用（一）——几何应用｜二轮强化复盘',
    13: '多元函数微分学｜二轮强化复盘',
    14: '二重积分｜二轮强化复盘',
    15: '微分方程｜二轮强化复盘'
  }
};

function cleanShelfTitle(subjKey, num, shortTitle) {
  if (num === 0) return '考前急救红线与真题落点总控';
  if (subjKey === 'linear' && LINEAR_TITLES[num]) return LINEAR_TITLES[num];
  return shortTitle.replace(/｜二轮强化复盘$/, '').replace(/知识点整理$/, '').trim();
}

function copyDirSync(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDirSync(s, d);
    else fs.copyFileSync(s, d);
  }
}

const MINDMAP_ASSET_DIRS = [
  ['notes/network/复盘/assets/chapter1', 'study/mm-assets/network/ch1'],
  ['notes/network/复盘/assets/第2章-物理层', 'study/mm-assets/network/ch2'],
  ['notes/network/复盘/assets/第3章-数据链路层', 'study/mm-assets/network/ch3'],
  ['notes/network/复盘/assets/第4章-网络层', 'study/mm-assets/network/ch4'],
  ['notes/network/复盘/assets/第5章-传输层', 'study/mm-assets/network/ch5'],
  ['notes/network/复盘/assets/第6章-应用层', 'study/mm-assets/network/ch6']
];

function main() {
  fs.rmSync(distDir, { recursive: true, force: true });
  copyDirSync(publicDir, distDir);
  for (const [relSrc, relDst] of MINDMAP_ASSET_DIRS) {
    const src = path.join(root, ...relSrc.split('/'));
    if (fs.existsSync(src)) {
      copyDirSync(src, path.join(distDir, ...relDst.split('/')));
    }
  }

  const reportsBySubject = new Map();
  const mermaidFiles = [];
  let builtCount = 0;

  for (const subj of SUBJECTS) {
    const mdFiles = fs.readdirSync(subj.dir)
      .filter(f => f.endsWith('.md'))
      .sort((a, b) => a.localeCompare(b, 'zh-CN'));

    const subjectReports = [];
    for (const fileName of mdFiles) {
      const fullPath = path.join(subj.dir, fileName);
      process.stdout.write(`Building [${subj.key}] ${fileName} ... `);
      const out = execFileSync(
        process.execPath,
        ['--max-old-space-size=4096', buildNoteScript, fullPath, subj.key],
        { cwd: root, encoding: 'utf8' }
      );
      const parsed = JSON.parse(out);
      const report = JSON.parse(fs.readFileSync(parsed.reportPath, 'utf8'));
      subjectReports.push(report);
      builtCount++;
      console.log(`OK (${parsed.MB} MB, imgs=${parsed.images}, tbls=${parsed.tables})`);

      const html = fs.readFileSync(report.output, 'utf8');
      if (html.includes('language-mermaid')) {
        mermaidFiles.push(report.output);
      }
    }
    subjectReports.sort((a, b) => a.chapterNumber - b.chapterNumber);
    reportsBySubject.set(subj.key, subjectReports);
  }

  if (mermaidFiles.length) {
    console.log(`\nPre-rendering Mermaid diagrams across ${mermaidFiles.length} HTML file(s)...`);
    const mermaidOut = execFileSync(
      process.execPath,
      [renderMermaidScript, ...mermaidFiles],
      { cwd: root, encoding: 'utf8' }
    );
    process.stdout.write(mermaidOut);
    for (const file of mermaidFiles) {
      const html = fs.readFileSync(file, 'utf8');
      if (html.includes('language-mermaid')) {
        throw new Error(`Unrendered mermaid block left in ${file}`);
      }
      if (/Syntax error in text/i.test(html)) {
        throw new Error(`Mermaid syntax error in rendered SVG of ${file}`);
      }
    }
    console.log('Mermaid validation passed: 0 errors.');
  }

  const catalog = SUBJECTS.map(subj => {
    const reports = reportsBySubject.get(subj.key) || [];
    return {
      key: subj.key,
      title: subj.title,
      chapters: reports.map(r => ({
        number: r.chapterNumber,
        title: (PREFERRED_TITLES[subj.key] && PREFERRED_TITLES[subj.key][r.chapterNumber])
          || cleanShelfTitle(subj.key, r.chapterNumber, r.shortTitle),
        images: r.images,
        tables: r.tables,
        url: r.fileName
      }))
    };
  });
  const notesJsonPath = path.join(distDir, 'study', 'notes.json');
  fs.writeFileSync(notesJsonPath, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`\nUpdated ${notesJsonPath} with ${catalog.length} subjects / ${builtCount} chapters.`);

  const upgOut = execFileSync(
    process.execPath,
    ['--max-old-space-size=4096', upgradeScript],
    { cwd: root, encoding: 'utf8' }
  );
  process.stdout.write(upgOut);

  fs.rmSync(reportDir, { recursive: true, force: true });
  console.log(JSON.stringify({ status: 'ok', builtCount, mermaidFiles: mermaidFiles.length }));
}

main();

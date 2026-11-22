# Kaoyan Study Notes · 考研复习阅读站

考研 408（操作系统、计算机网络、计算机组成原理、数据结构）与数学二（高等数学强化、线性代数强化）+ 英语作文结构的纯静态阅读站点，由 GitHub Actions 自动构建并部署到 GitHub Pages。

## 在线地址

- GitHub Pages：`https://tayloverqjc.github.io/kaoyan-study-notes/`

## 目录结构

```text
notes/           # 全部笔记 Markdown 原文与引用图片（唯一内容真源）
  os/复盘/
  network/复盘/
  architecture/
  ds/复盘/
  math/知识点与考点整理/
  linear/
public/          # 入口页与前端静态资源（css / js / wallpapers / essays / sentences）
tools/           # Node.js 构建脚本与阅读器模板（build-all.cjs / build-note.cjs / reader.*）
.github/workflows/deploy-pages.yml  # 推送 main 分支后自动构建并发布到 GitHub Pages
```

## 日常更新方式

1. **直接更新笔记**：编辑 `notes/` 下的对应 `.md` 文件（新增图片请放在对应科目 `notes/<科目>/` 目录内，使用相对路径或 Obsidian `![[...]]` 引用）。
2. **提交并推送到 `main` 分支**（可在网页端直接编辑提交，也可本地/Agent 推送）。
3. GitHub Actions 会自动安装依赖、`npm run build` 生成全部 HTML、MathJax SVG 公式、Mermaid 流程图与全文索引，并发布到 GitHub Pages。

> 注意：`dist/` 与 `node_modules/` 均由构建脚本自动生成，不提交到 Git 仓库。

## 本地构建与子路径预览

```bash
npm ci
npm run build
npm run preview
# 访问 http://127.0.0.1:8799/kaoyan-study-notes/
```

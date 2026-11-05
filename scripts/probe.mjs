#!/usr/bin/env node
/* =============================================================================
 * handoff probe — 交接探针（零依赖，Node >= 16）
 * =============================================================================
 * 用法：
 *   node probe.mjs status   [projectRoot]   # git 现状 + 事实源文件定位
 *   node probe.mjs residue  [projectRoot]   # 散乱文件 / 会话残留候选
 *   node probe.mjs opening  [projectRoot]   # 生成 3 行新会话开场白
 *   node probe.mjs init     [projectRoot]   # 把交接看板脚手架进目标项目
 *
 * 输出全部是纯文本（人读 + Agent 读都用它），退出码 0。
 * 脚本除 init（写入脚手架文件）外只读不写；其他修改动作由 Agent 按权限规则执行。
 * init 拒绝覆盖任何已存在的目标文件，已存在即跳过并列出。
 * =============================================================================
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const cmd = process.argv[2] || "status";
const root = resolve(process.argv[3] || ".");
const require = createRequire(import.meta.url);

/* ── 工具 ─────────────────────────────────────────────── */
let GIT_BLOCKED = false;
function git(args) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      timeout: 15000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    if (e.code === "EPERM") { GIT_BLOCKED = true; return null; } // 宿主沙箱禁子进程
    return null; // git 缺失 / 非仓库 / 命令失败
  }
}
function isRepo() {
  return git(["rev-parse", "--is-inside-work-tree"]) === "true";
}
function walk(dir, depth, maxDepth, out, skip) {
  if (depth > maxDepth) return;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1, maxDepth, out, skip);
    else if (e.isFile()) out.push(p);
  }
}

/* ── status：git 现状 + 事实源 ────────────────────────── */
const FACT_FILES = [
  "state.js", "HANDOFF.md", "CURRENT-STATE.md", "ROADMAP.md",
  "AGENTS.md", "CLAUDE.md", "README.md",
];

function cmdStatus() {
  const L = [];
  L.push(`# 现状快照 · ${root}`);
  L.push("");
  const repo = isRepo(); // 先跑一次，沙箱禁子进程时会置 GIT_BLOCKED
  if (GIT_BLOCKED) {
    L.push(`- git：Node 子进程被宿主沙箱禁用（EPERM）→ 请 Agent 直接在 shell 执行：`);
    L.push("  ```");
    L.push(`  git -C "${root}" branch --show-current; git -C "${root}" status --porcelain; git -C "${root}" log --oneline -5`);
    L.push("  ```");
  } else if (!repo) {
    L.push("- git：不是 git 仓库（或 git 不可用）→ 文件现状即全部事实");
  } else {
    const branch = git(["branch", "--show-current"]) || "(detached)";
    const dirty = (git(["status", "--porcelain"]) || "").split("\n").filter(Boolean);
    const last = (git(["log", "--oneline", "-5", "--no-decorate"]) || "(无提交)")
      .split("\n").map(s => "  " + s).join("\n");
    const stash = (git(["stash", "list"]) || "").split("\n").filter(Boolean);
    const ahead = git(["rev-list", "--count", "@{upstream}..HEAD", "--"]) || "";
    L.push(`- git 分支：${branch}${ahead ? `（领先远端 ${ahead} 个提交未推）` : "（无远端或已同步）"}`);
    L.push(`- 工作区：${dirty.length ? `${dirty.length} 个变更未提交` : "干净"}`);
    if (dirty.length) L.push("```\n" + dirty.slice(0, 30).join("\n") + (dirty.length > 30 ? `\n… 共 ${dirty.length} 条` : "") + "\n```");
    L.push(`- stash：${stash.length ? `${stash.length} 条未处理` : "无"}`);
    L.push(`- 最近提交：\n${last}`);
  }
  L.push("");
  L.push("## 事实源文件（新会话先读这些，冲突以排前者为准）");
  let found = 0;
  for (const f of FACT_FILES) {
    const p = join(root, f);
    if (!existsSync(p)) continue;
    found++;
    const st = statSync(p);
    const kb = (st.size / 1024).toFixed(1);
    const day = st.mtime.toISOString().slice(0, 10);
    L.push(`- ${f} — ${kb} KB，改于 ${day}`);
  }
  if (!found) L.push("- （未找到任何事实源文件 → 交接前需要先建 AGENTS.md）");
  return L.join("\n");
}

/* ── residue：残留候选 ────────────────────────────────── */
const RESIDUE_NAME = /(_old|_backup|_v2|_v3|_copy|-copy|_bak|tmp|temp|debug|scratch|备份|旧版|草稿)/i;
const RESIDUE_EXACT = new Set([
  "plan.md", "todo.md", "notes.md", "implementation-notes.md",
  "implementation_notes.md", "session-notes.md", "debug.js", "test-tmp.js",
]);
const SKIP_DIRS = new Set([
  "node_modules", ".git", ".hg", ".svn", "dist", "build", "out", ".next",
  "coverage", ".venv", "venv", "__pycache__", ".idea", ".vscode", "target",
]);

function cmdResidue() {
  const L = [`# 残留候选 · ${root}`, ""];
  const files = [];
  walk(root, 0, 3, files, SKIP_DIRS);

  const named = files.filter(p =>
    RESIDUE_EXACT.has(basename(p).toLowerCase()) || RESIDUE_NAME.test(basename(p)));
  const media = files.filter(p =>
    [".png", ".jpg", ".jpeg", ".webp", ".gif", ".mp4", ".webm"].includes(extname(p).toLowerCase()));

  L.push("## 命名可疑（旧副本 / 临时 / 调试）");
  if (!named.length) L.push("- 无");
  for (const p of named) L.push(`- ${p.slice(root.length + 1)}`);

  L.push("");
  L.push("## 根目录截图 / 临时媒体（交接看板用不到的）");
  const rootMedia = media.filter(p => dirname(p) === root);
  if (!rootMedia.length) L.push("- 无");
  for (const p of rootMedia) L.push(`- ${basename(p)}`);

  if (isRepo()) {
    const untracked = (git(["status", "--porcelain"]) || "")
      .split("\n").filter(s => s.startsWith("??")).map(s => s.slice(3).trim());
    L.push("");
    L.push("## git 未跟踪文件");
    if (!untracked.length) L.push("- 无");
    for (const u of untracked.slice(0, 30)) L.push(`- ${u}`);
  }
  L.push("");
  L.push("> 以上是候选不是结论：Agent 逐个判断「删 / 归位 / 并入正式文档」，删除需用户确认。");
  return L.join("\n");
}

/* ── opening：3 行开场白 ──────────────────────────────── */
function fromStateJs() {
  const p = join(root, "state.js");
  if (!existsSync(p)) return null;
  try {
    const S = require(p);
    const h = S.handover, m = S.meta;
    if (!h || !m) return null;
    const read = (h.readFirst || ["state.js"]).join("、");
    const L = [];
    L.push(`继续 ${m.project}（${m.path || root}）。`);
    L.push(`先读 ${read}——目标/看板/日志都在里面，冲突以它为准。`);
    L.push(`唯一下一步：${h.nextStep || "读完后向用户确认当前目标。"}`);
    if (h.frozen && h.frozen.length) L.push(`冻结：${h.frozen.join("；")}。`);
    return L.join("\n");
  } catch { return null; }
}
function fromHandoffMd() {
  const p = join(root, "HANDOFF.md");
  if (!existsSync(p)) return null;
  const m = readFileSync(p, "utf8").match(/```text\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}
function cmdOpening() {
  const text = fromStateJs() || fromHandoffMd();
  const name = basename(root);
  if (text) {
    return text + "\n\n（以上即开场白，直接整段复制到新对话。）";
  }
  const hasAgents = existsSync(join(root, "AGENTS.md")) || existsSync(join(root, "CLAUDE.md"));
  const L = [];
  L.push(`继续 ${name}（${root}）。`);
  L.push(hasAgents
    ? `先读 AGENTS.md——项目约定与现状入口，冲突以它为准。`
    : `项目还没有事实源文件，先让我读目录结构和入口代码，再向你确认当前目标。`);
  L.push(`唯一下一步：向用户确认当前唯一目标后开工。`);
  return L.join("\n");
}

/* ── init：把交接看板脚手架进目标项目 ─────────────────── */
const TPL_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "templates");

function cmdInit() {
  const L = [`# 初始化交接看板 · ${root}`, ""];
  const name = basename(root);
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  const vars = {
    "{{PROJECT}}": name,
    "{{PATH}}": root.replace(/\\/g, "\\\\"),
    "{{DATE}}": `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    "{{TIME}}": `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    "{{DATETIME}}": `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
  const fill = s => { for (const [k, v] of Object.entries(vars)) s = s.split(k).join(v); return s; };

  const targets = [
    { src: join(TPL_DIR, "state.js"), dst: join(root, "state.js"), render: true },
    { src: join(TPL_DIR, "board.html"), dst: join(root, "board.html"), render: true },
    { src: join(TPL_DIR, "tools", "gen-handoff.mjs"), dst: join(root, "tools", "gen-handoff.mjs"), render: false },
  ];
  for (const t of targets) {
    if (!existsSync(t.src)) { L.push(`- ✗ 模板缺失：${t.src}（skill 安装不完整）`); continue; }
    if (existsSync(t.dst)) { L.push(`- 跳过（已存在，不覆盖）：${t.dst}`); continue; }
    mkdirSync(dirname(t.dst), { recursive: true });
    if (t.render) writeFileSync(t.dst, fill(readFileSync(t.src, "utf8")), "utf8");
    else copyFileSync(t.src, t.dst);
    L.push(`- ✓ 已创建：${t.dst}`);
  }
  L.push("");
  L.push("> 下一步：把项目的真实目标/任务填进 state.js（占位符都换成实义内容），");
  L.push("> 双击 board.html 验证渲染；收尾时跑 node tools/gen-handoff.mjs 生成 HANDOFF.md。");
  return L.join("\n");
}

/* ── 分发 ─────────────────────────────────────────────── */
const out = cmd === "residue" ? cmdResidue()
  : cmd === "opening" ? cmdOpening()
  : cmd === "init" ? cmdInit()
  : cmdStatus();
console.log(out);

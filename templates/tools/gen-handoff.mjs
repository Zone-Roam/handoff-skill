// 由 state.js 生成 HANDOFF.md（纯文本交接稿）。
// 用法：node tools/gen-handoff.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const S = require(join(root, "state.js"));

const COLS = [
  { key: "todo", label: "待办" },
  { key: "doing", label: "进行中" },
  { key: "frozen", label: "冻结" },
  { key: "done", label: "已完成" }
];

function opening(S) {
  // 指针式开场白：≤5 行，细节靠新会话读事实源恢复（与 board.html / probe.mjs opening 同口径）
  const h = S.handover || {}, m = S.meta || {};
  const L = [];
  L.push("继续 " + (m.project || "项目") + "（" + (m.path || "") + "）。");
  L.push("先读 " + (h.readFirst || ["state.js"]).join("、") + "——目标/看板/日志都在里面，冲突以它为准。");
  L.push("唯一下一步：" + (h.nextStep || "读完后向用户确认当前目标。"));
  if ((h.frozen || []).length) L.push("冻结：" + h.frozen.join("；") + "。");
  return L.join("\n");
}

const out = [];
out.push("# HANDOFF — " + S.meta.project);
out.push("");
out.push("> 本文件由 `state.js` 经 `node tools/gen-handoff.mjs` 生成，**勿手改**。权威事实源是 `state.js`。");
out.push("");
out.push("```text");
out.push(opening(S));
out.push("```");
out.push("");

out.push("## 看板快照");
for (const c of COLS) {
  const items = (S.board && S.board[c.key]) || [];
  out.push(`- **${c.label}**（${items.length}）`);
  for (const t of items) out.push(`  - ${t.title || "未命名"}${t.next ? " ｜ 下一步：" + t.next : ""}`);
}
out.push("");

out.push("## 最近日志");
for (const L of (S.log || []).slice(0, 10)) {
  out.push(`- ${L.date} ${L.time} [${L.type}] ${L.title}${L.body ? " — " + L.body : ""}`);
}
out.push("");

writeFileSync(join(root, "HANDOFF.md"), out.join("\n") + "\n", "utf8");
console.log("已生成 HANDOFF.md（" + (S.log || []).length + " 条日志，版本 " + S.meta.version + "）");

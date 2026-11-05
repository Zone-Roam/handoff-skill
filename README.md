# handoff — 交接探针（Agent 交接技能）

给 AI Agent 和人共用的**项目交接探针**：开工核查、看板初始化、工作区归位、新会话开场白，四个功能共用一个零依赖脚本（Node ≥ 16）。

针对的问题：跨会话/跨 Agent 交接项目时，新对话常常基于**旧进度**开发。本 skill 把「当前唯一目标、下一步、冻结项」收敛进 `state.js` 唯一事实源，交接只传 4 行指针式开场白，细节靠新会话读文件恢复。

## 安装

```bash
git clone <本仓库> ~/.agents/skills/handoff
```

DSH（DeepSeek Harness）会自动从 `~/.agents/skills/` 加载；其他宿主把它放进对应技能目录即可。

## 四个子命令

```bash
node scripts/probe.mjs status   [项目根]   # git 现状 + 事实源文件定位（防旧进度开发）
node scripts/probe.mjs init     [项目根]   # 把交接看板脚手架进任意项目
node scripts/probe.mjs residue  [项目根]   # 残留文件候选清单（收尾归位）
node scripts/probe.mjs opening  [项目根]   # 4 行指针式新会话开场白
```

## init 会生成什么

目标项目得到三件套（已存在的一律跳过不覆盖）：

- `state.js` — 唯一事实源：handover 交接面板 + 四列看板（todo/doing/frozen/done）+ PRD + 倒序日志；浏览器 `window.STATE` 与 Node `module.exports` 双兼容
- `board.html` — 零依赖渲染器，**离线双击即开**（锚点导航 + 长日志折叠 + 一键复制开场白）
- `tools/gen-handoff.mjs` — 由 state.js 生成 HANDOFF.md 纯文本投影

之后每完成一个功能，按增量四步更新 state.js（移卡片 → 更新 handover → 插日志 → 升版本）。

## 设计哲学

- **开场白只做指针 + 唯一下一步**：新会话反正要读文件，不在开场白里复述细节。超过 5 行就是写坏了。
- **脚本只读红线**：除 init（拒绝覆盖）外探针不写不删；删除/移动由 Agent 按权限执行且必须用户确认。
- **同一事实只留一个权威解释**：state.js 是唯一事实源，board.html 和 HANDOFF.md 都是它的投影。

## 兼容性

已在 Windows（含中文路径、空格/括号目录名）实测；无 npm 依赖，无网络请求。

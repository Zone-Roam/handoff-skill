/* =============================================================================
 * 项目状态 · 唯一事实源（交接看板的数据）
 * =============================================================================
 * 本文件只存数据。board.html 负责渲染成交接看板；tools/gen-handoff.mjs 用它生成
 * HANDOFF.md。
 *
 * ── 谁在什么时候改 ─────────────────────────────────────────────
 *  · Agent 每次完成一个 feat 后做「增量四步」：
 *      1) 把 board 里的卡片在 待办→进行中→已完成 之间移动（改归属列）
 *      2) 更新 handover（objective / order / nextStep / frozen / done）
 *      3) 在 log 最前面插一条日志
 *      4) 更新 meta.updatedAt / lastVerified / version
 *  · 人想改就直接编辑这个文件（结构就是 JS 对象）
 *  · 改完刷新 board.html 即看到最新
 *
 * ── 字段约定 ────────────────────────────────────────────────────
 *  · 看板列 board 只有四个：todo / doing / frozen / done（frozen = 明确冻结）
 *  · 卡片 card = { id, title, desc?, next?, type?, doneAt? }
 *  · type 可取 feature | fix | docs | plan | chore（与 log.type 一致）
 *  · handover 字段与开场白一一对应：
 *    objective / order / nextStep / frozen / done / permission / readFirst
 * =============================================================================
 */

const STATE = {
  /* ── 元信息 ────────────────────────────────────────────────── */
  meta: {
    project: "{{PROJECT}}",
    path: "{{PATH}}",
    tagline: "（一句话定位：这个项目是做什么的）",
    version: "0.1.0",
    updatedAt: "{{DATETIME}}",
    lastVerified: "{{DATE}}" // 最后一次对运行态做真实验证的日期
  },

  /* ── 交接面板（= 新会话开场白的内容） ────────────────────────── */
  handover: {
    objective: "（当前唯一目标：一句话，只保留一个现役答案）",
    order: [
      "（执行顺序第 1 步）",
      "（执行顺序第 2 步）"
    ],
    nextStep: "（唯一下一步：一个可验证的动作）",
    frozen: [
      "（明确不做什么 1）"
    ],
    done: [
      "（已完成 1）"
    ],
    permission: "（权限边界：可以做什么、什么要先问）",
    readFirst: ["state.js", "AGENTS.md", "README.md"]
  },

  /* ── 看板：四列卡片 ─────────────────────────────────────────── */
  board: {
    todo: [
      // { id: "t-xxx", title: "任务名", desc: "说明", type: "feature" }
    ],
    doing: [],
    frozen: [],
    done: []
  },

  /* ── PRD ───────────────────────────────────────────────────── */
  prd: {
    summary: "（一段话：项目是什么、给谁用、解决什么问题）",
    goals: [
      "（目标 1）"
    ],
    users: [
      "（用户/角色 1）"
    ],
    scopeIn: [
      "（范围内 1）"
    ],
    scopeOut: [
      "（范围外 1）"
    ]
  },

  /* ── 开发日志（新的写最上面） ────────────────────────────────── */
  log: [
    {
      date: "{{DATE}}",
      time: "{{TIME}}",
      type: "chore",
      title: "初始化交接看板",
      body: "由 handoff skill init 生成脚手架；待填入项目真实目标与任务。"
    }
  ]
};

// 双兼容：浏览器挂到 window，Node 用 module.exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = STATE;
} else {
  window.STATE = STATE;
}

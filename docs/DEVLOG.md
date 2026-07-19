# LPL 自建选手模拟器 — 开发日志

> 最后更新：2026-07-19 | 版本状态：24 测试通过 / 构建通过 / 可玩

---

## 更新与问题日志（按日期倒序，最新在最上）

**维护约定**：
- 每次开发结束，在本节**最顶部**加一条当日条目：做了什么、遇到什么问题、根因、怎么修、怎么验证的。保持在 5–15 行。
- 如果某个问题排查过程较长，单独建 `docs/debug-log-<问题名>.md` 写完整复盘，条目里只留一段摘要 + 链接。
- 本文档其余章节（结构地图、公式、修改手册）是“现状文档”：改代码时**就地更新为最新状态**，不留历史；历史只留在本节。

### 2026-07-19 — 继承页卡死：三轮排查，根因是头像色哈希负数

- **做了什么**：修复「点击继承属性后有概率无法跳出下一个界面」。
- **过程**：第一轮按旧调试日志的思路修了 `createPlayer` 非原子 set 和 `done` 判定颠倒等 4 个残留问题；用户反馈仍卡死后，用 puppeteer-core + 本机 Chrome 自动化跑 30 轮完整流程复现，抓到页面报错 `Cannot read properties of undefined (reading 'replace')`。
- **根因**：`teams.ts` 的 `colorFor` 用 `Math.imul`（有符号 int32）算哈希，负数取模得负索引 → **105 名选手中 56 名（53%）的 `avatarColor` 为 undefined** → `Avatar` 渲染 `color.replace` 抛错 → 无 error boundary → React 卸载整棵树白屏。每位候选 ~53% 概率触发，与“约 50% 概率卡死”吻合。
- **修复**：`(h >>> 0) % AVATAR_COLORS.length`（根修）+ `Avatar` 灰色兜底（防御）+ 数据完整性测试。
- **验证**：自动化 30 轮 0 卡死；24/24 测试通过；dist 已重建。
- **详细复盘**：`docs/debug-log-inheritance-freeze.md`（含前两次误诊记录）。
- **教训**：有概率的 UI 卡死，优先怀疑“渲染期抛异常 + 无 error boundary”，而非性能问题；静态分析查不出时，尽早用浏览器自动化复现抓现场。

---

## 一、项目速览

**一句话**：玩家自建一名 LPL 选手 → 从真实职业选手处继承属性 → 加入真实战队 → 征战春季赛/MSI/夏季赛/世界赛 → 夺冠。

**部署**：`npm run dev` 后打开 `http://localhost:5173`

**技术栈**：React 19 + TypeScript 6 + Vite 8 + TailwindCSS 3 + Zustand 5 + Vitest 4
持久化：localStorage / 图表：纯 SVG 自绘 / CSV 是唯一数据源

---

## 二、项目结构地图

```
src/
├── types/index.ts              # ★ 所有类型定义（修改数据结构从这里开始）
├── constants/index.ts          # ★ 所有数值参数（改游戏平衡从这里开始）
├── data/
│   ├── roster.csv              # ★★★ 唯一数据源：105 位选手的 9 维属性
│   └── teams.ts                # 读取 CSV → 构建 Team[]；teamwork 从阵容推导
│   ├── pool.ts                 # 继承候选池随机抽取
├── engine/                     # 纯逻辑，不依赖 React
│   ├── power.ts                # 单人战力 / 战队战力 / 协同 / 风格契合
│   ├── breakthrough.ts         # 亮剑·奉献 策略系统 / 单线击穿·团战游龙判定
│   ├── match.ts                # 单局模拟 / KDA/评分 / BO 系列赛
│   ├── season.ts               # 赛季编排（春/MSI/夏/世界）+ 积分 + 抽签 + 奖项
│   ├── inheritance.ts          # 继承 v2：槽位混合 / 最弱项查找
│   ├── customPlayer.ts         # 自建选手基础属性 / 赛季成长
│   ├── events.ts               # 事件文字模板（播报用）
│   └── __tests__/engine.test.ts
├── store/gameStore.ts          # ★ Zustand：游戏阶段 FSM + 全局状态
├── components/                 # 可复用 UI
│   ├── Avatar.tsx              # 程序生成几何头像（无真人照片）
│   ├── AttrBar.tsx             # 9 维属性进度条（三组三色）
│   ├── AttrRadar.tsx           # 9 维雷达图（纯 SVG，自动适应 9 轴）
│   ├── PlayerCard.tsx          # 选手卡片（头像+属性条+雷达）
│   ├── TeamCard.tsx            # 战队卡片（含 5 位置球员）
│   ├── SeriesResultCard.tsx    # 单场/系列赛结果卡
│   └── StandingsTable.tsx      # 积分榜表格
├── pages/                      # 页面组件（每个对应一个游戏阶段）
│   ├── Menu.tsx                # 主菜单（新游戏/继续/版权声明）
│   ├── CreatePlayer.tsx        # 创建选手（ID+位置+预览）
│   ├── Inheritance.tsx         # ★ 继承 v2（9 位选手顺序抽取+锁定+替换惩罚）
│   ├── SelectTeam.tsx          # 选战队（顶替该位置选手）
│   ├── SeasonHub.tsx           # 赛季中心（含四赛事驱动+策略选择器）
│   └── Result.tsx              # 结局页（成绩单+荣誉榜）
└── utils/                      # 工具（随机 高斯 / 钳制 / 格式化 / 存储）
```

**带 ★ 的文件是修改最频繁的入口。**

---

## 三、数据层

### 3.1 CSV 格式（`src/data/roster.csv`）

唯一数据源。用 Excel 打开直接编辑，保存后刷新浏览器生效。

**列顺序**（18 列）：
```
战队ID,战队,全名,赛区,风格,队徽色,选手,位置,操作,反应,发育,配合,意识,开团,英雄池,心态,沟通,综合
```

- `战队ID`：小写英文，如 `blg`、`t1`。新增队伍时保持唯一。
- `赛区`：LPL / LCK / LEC / LCS / PCS / VCS。大小写敏感。
- `风格`：打架队 / 运营流 / 快节奏。影响战术契合判定（见 §4.C）。
- `队徽色`：CSS 色值（十六进制），用于头像和 UI 配色。
- `位置`：上单 / 打野 / 中单 / 下路 / 辅助。必须用这 5 个中文词。
- `操作` ~ `沟通`：9 维属性（0–99 整数）。
- `综合`：纯粹参考列（9 项均值），**不参与任何计算**。

### 3.2 团队配合度（无需填写）

每队的 `teamwork` 值 = 该队 5 名球员 `配合` 属性的平均值（在 `teams.ts` 中自动计算）。改球员的 `配合` 就会间接调整团队配合度。

### 3.3 如何新增/删除队伍

1. 用 Excel 打开 `roster.csv`
2. 新增一行：写新队的 8 个元数据列，再写 5 名球员 × 9 属性 + 综合
3. 删除一行：直接删整行
4. 保存 → 刷新浏览器

**注意事项**：
- LPL 必须保持 ≥6 队（夏季季后赛 Top6 双败赛制要求）
- LCK 必须保持 ≥4 队（世界赛抽签要求）
- LEC/LCS 各需 ≥3 队
- 每队必须恰好 5 人，按上/野/中/下/辅顺序

---

## 四、核心公式速查（附文件:行号）

> 所有可调数值参数在 `src/constants/index.ts`。

### A. 属性体系

```
对线组 Laning (3):   操作  mechanics / 反应  reaction / 发育  farming
团战组 Teamfight (3): 配合  teamwork / 意识  macro / 开团  engage
深度组 Depth (3):     英雄池 championPool / 心态 mentality / 沟通 communication
```
每项 0–99。位置权重见 `constants.ts:67`。

### B. 单人战力 — `power.ts:8`
```
laning    = (操作+反应+发育) / 3
teamfight = (配合+意识+开团) / 3
depth     = (英雄池+心态+沟通) / 3
战力       = laning×W_l + teamfight×W_t + depth×W_d
```
位置权重 W（`constants:67`）：
|位置|W_l|W_t|W_d|
|-|-|-|-|
|上单|1.2|0.9|0.9|
|打野|0.8|1.2|1.0|
|中单|1.15|1.0|0.85|
|下路|1.1|0.95|0.95|
|辅助|0.7|1.25|1.05|

### C. 战队战力 — `power.ts:81`
```
base    = Σ₅人 calcPlayerPower
avgTf   = Σ₅人(配合+意识+开团) / 5
synergy = 0.85 + (teamwork/100)×0.15 + (avgTf/99)×0.1    (0.85~1.10)
styleFit = 玩家最强组契合战队风格 ? 1.05 : 1.0             (运营流→团战契合; 打架队/快节奏→对线契合)
teamPower = base × synergy × styleFit
```

### D. 对局胜负判定 — `match.ts:65`
```
myRoll  = myPower  × N(1, 0.12)      (高斯扰动, 标准差 RANDOM_VARIANCE=0.12)
enRoll  = enPower × N(1, 0.12)
胜利   = myRoll > enRoll
```
> 玩家对局使用高斯比值法。AI 对 AI 对局仍使用 Sigmoid（`season.ts:27` `1/(1+exp(.../60))`）——这是待统一的遗留不一致。

### E. 亮剑 / 奉献 策略（MSI/世界赛 BO5 赛点局，玩家主动选）

**判定**（基于基础属性，策略不帮凑阈值）— `breakthrough.ts`：

| 策略 | 乘数（本人/队友） | 额外触发 | 阈值 |
|------|--------------------|-----------|------|
| 稳健 none | 1.0 / 1.0 | — | — |
| 亮剑 challenge | 1.1 / 0.9 | **单线击穿** solokill | 本人 vs 对位 `对线和 ≥ 18` |
| 奉献 sacrifice | 0.8 / 1.1 | **团战游龙** teamfightCarry | 4队友 vs 敌4 `团战和 ≥ 60` |

**触发效果**：
- 单线击穿：本人 ×1.3（替换 ×1.1），队友 ×1.0（惩罚解除）
- 团战游龙：队友 ×1.2（替换 ×1.1），本人仍 ×0.8

**常量位置**：`constants.ts:78-87`（`CHALLENGE_SELF_MULT / SOLOKILL_THRESHOLD / SACRIFICE_SELF_MULT / TEAMFIGHTCARRY_THRESHOLD` 等）

### F. 个人 KDA / 评分 — `match.ts:96`

```
skill    = clamp((战力−45)/55, 0, 1.4)
kills    = round(skill×5 + random(0~4))   [+单线击穿: +random(2~4)]
assists  = random(2~10) + round(skill×4)  [+奉献: +random(1~4)]
deaths   = 胜? random(0~3) : random(2~6)  [单线击穿: -2; 亮剑未击穿 40%概率 +1; 奉献: kills −random(1~3)]
ratio    = deaths==0 ? kills+assists : (kills+assists)/deaths
评分     = clamp(5 + ratio×0.8 + (胜?1.2:−1.2), 1, 10)  [+solokill: +1.5; +teamfightCarry: +0.8; 奉献: -0.5]
```
最终评分四舍五入到 1 位小数。

### G. 继承 v2 混合 — `inheritance.ts`
```
final(attr) = clamp( round(base×(1−0.72) + source×0.72), 0, 99 )
替换(override): 覆盖目标属性 + 强制继承 sourceWeakest（排除所选属性）
```

### H. 赛季成长 — `customPlayer.ts:59`
```
baseGrowth = max(0, (avgRating−5)×0.6)
gain(attr) = baseGrowth×weight + random(0~0.5)
weights: 操作1.2 / 反应1.0 / 发育1.0 / 配合0.8 / 意识0.8 / 开团0.7 / 心态0.9 / 沟通0.9 / 英雄池0.9
new = clamp(round((old+gain)×10)/10, 0, 99)
```

### I. 年度积分 / 世界赛名额 — `season.ts:498`
```
春季常规赛积分 = max(0, n−rank)×1.0        (n=队伍数, rank=排名)
夏季常规赛积分 = max(0, n−rank)×1.3
MSI 名次积分: 冠军8 / 亚军6 / 四强4 / 八强2
世界赛 LPL 4 队 = 春+MSI+夏 总积分 Top4
```

### J. 奖项（MVP / FMVP）— `season.ts:finalsMvp / seasonMvp`
- FMVP（春/MSI/夏/世界赛总决赛）：你夺冠 + 决赛均分≥**6.5** → 你拿；否则颁给冠军队最强队友
- MVP（春/夏常规赛）：你均分≥**7.5** + 队伍前三 → 你拿；否则颁给联赛前四队最强选手
- 阈值位置：`constants.ts:103-104`

---

## 五、状态管理（Zustand）

### 5.1 游戏阶段 FSM

```
menu → create → inherit → select-team → season-hub → result
                                                 ↑  ↓
                                           ← 回到 menu（重开）
```

阶段由 `phase: Phase` 控制（`App.tsx` 按 phase 渲染对应页面组件）。

### 5.2 核心状态字段（`gameStore.ts`）

| 字段 | 类型 | 用途 |
|------|------|------|
| `save` | GameSave\|null | 游戏存档（含 career 全程比赛结果） |
| `draftPlayer` | Player\|null | 创建阶段的临时玩家（存档时写入 `save.customPlayer`） |
| `pool` | PoolEntry[] | 继承池（9 位候选） |
| `idx` | number | 当前第几位候选（0~9） |
| `slots` | Record<AttrKey, SlotValue> | 已锁定属性槽 |
| `decisiveStrat` | Strat | MSI/世界赛关键局策略选择 |
| `rerollsLeft` | number | 继承池重抽剩余次数 |

### 5.3 存档结构（Types `GameSave`）

```typescript
interface GameSave {
  customPlayer: Player;           // 最终自建选手
  teamId: string;                 // 加入的战队 ID
  inheritedFrom: string[];        // 继承自哪些选手
  career: CareerProgress;         // { spring?, msi?, summer?, worlds? } 每届 SeasonResult
  achievements: string[];         // 成就（预留）
  createdAt: number;
}
```
- 存档键：`lpl-game-save-v1`（localStorage）
- 持久化时机：每次打完一个赛段后自动存储
- 读档：主菜单“继续游戏”

---

## 六、如何修改

### 6.1 改数值平衡

**改公式参数**：编辑 `src/constants/index.ts`，修改后刷新浏览器。常见项：
- `SOLOKILL_THRESHOLD = 18` → 调大 = 单线击穿更难（需要更大对线优势）
- `FMVP_PLAYER_RATING = 6.5` → 调大 = FMVP 更难拿
- `RANDOM_VARIANCE = 0.12` → 调大 = 爆冷更多（弱队更可能赢）
- `CUSTOM_PLAYER_TOTAL = 340` → 调大 = 自建选手更强

**改位置权重**：编辑 `constants.ts:67` 的 `POSITION_WEIGHTS`。

**改选手属性**：用 Excel 编辑 `roster.csv`，刷新即可。

### 6.2 改赛制

- **LPL 队伍数变了？**：在 CSV 增删队伍后，检查 `season.ts:simulateSpring` 的 Top4 和 `simulateSummer` 的 Top6 是否还适用。
- **MSI/世界赛参赛名额变了？**：修改 `season.ts:simulateMsi` / `simulateWorlds` 里的 `topNByRegion` 调用参数。
- **赛制格式变了？**：`runSingleElim` 是通用单败淘汰（支持 2/4/8 队），`runDoubleElim6` 硬编码 6 队（如需通用化需重写）。

### 6.3 改 UI

- **颜色/主题**：`tailwind.config.js` 中 `colors` 和 `index.css` 中的 `@layer components`。
- **页面布局**：`src/pages/` 对应的 `.tsx` 文件。
- **组件样式**：`src/components/` 的 Tailwind class。

### 6.4 加新属性（如再加一维）

1. `types/index.ts`：在 `Attributes` 加新字段；加到对应组的 `*_KEYS` 数组。
2. `constants/index.ts`：在 `ATTR_META` 加新条目。
3. `roster.csv`：给所有玩家加新列。（可写脚本批量加，参考 `scripts/build-roster.ts`）
4. `data/teams.ts`：在 `ATTR_MAP` 加新映射。
5. `engine/power.ts`：深度/对线/团战均值公式可能需要调整 N 值。
6. `engine/customPlayer.ts`：`genCustomBaseAttrs` 和 `growPlayer` 加新属性。
7. `components/AttrRadar.tsx` 自动适应（基于 `ATTR_META.length`）。
8. `store/gameStore.ts`：`POOL_SIZE` 设为新属性数。
9. `pages/Inheritance.tsx`：无需改（自动适应 ATTR_META）。

### 6.5 改继承机制（如改每人数、改惩罚规则）

- **每位选几项/每项能选几次**：`gameStore.ts:pickAttr` 里的锁定逻辑。
- **继承混合比例**：`inheritance.ts:INHERIT_RATIO = 0.72`。
- **候选池大小**：`gameStore.ts:POOL_SIZE`（同时改 `pages/Inheritance.tsx` 里的显示文案）。
- **替换惩罚是否加重**：`inheritance.ts:weakestAttr` 和 `gameStore.ts:pickAttr` 里的惩罚逻辑。

### 6.6 加新页面/功能

1. 在 `Phase` 类型（`types/index.ts`）里加新阶段。
2. 在 `App.tsx` 里加对应的页面渲染。
3. 在 `gameStore.ts` 里加对应的 action 和状态字段。
4. 新建 `src/pages/Xxx.tsx`。

---

## 七、现存问题（按优先级排列）

### P0 — 需关注

1. **胜率公式双轨**：玩家对局用高斯扰动法（`match.ts:65`），AI 对局仍用 Sigmoid（`season.ts:27`）。统一步骤：改 `simAiGame` 为同样的 `战力×N(1,0.12)` 比大小。

2. **`runDoubleElim6` 硬编码 6 队**（`season.ts:401`）。若 LPL 队数变化会崩溃。方案：重写为通用双败淘汰。

### P1 — 设计一致

3. **继承池不保证位置多样性**：`pool.ts` 纯随机抽，可能 9 位都是辅助。方案：加入位置分布策略或加权。
4. **年度积分只算常规赛排名**（`season.ts:computeYearlyPoints`），与“靠季后赛选拔”的设计不完全一致。方案：纳入季后赛排名权重。
5. **世界赛小组仅单循环**（3 场/队），真实是双循环/瑞士轮。方案：`season.ts:simulateWorlds` 增加一个循环。
6. **`scripts/build-roster.ts` 未更新**：仍是旧 9 维（含 `适应`）逻辑，应清理或重写为 9 维新格式。

### P2 — 增强体验

7. 事件文字模板偏少（`events.ts`，~20 条），多局重复感强。
8. 测试覆盖薄：缺少继承 v2、MSI/世界赛新赛制、策略触发率的专项测试。
9. `match.ts` 末尾 `export { pick }` 冗余（无调用者）。

---

## 八、调试技巧

### 8.1 快速检查

```bash
npm run test       # 跑全部 17 个测试（覆盖引擎核心逻辑）
npm run build      # 生产构建（检查是否有编译/打包错误）
npx tsc -b --noEmit  # 仅类型检查（比 build 快）
```

### 8.2 常见卡死原因速查

| 症状 | 可能原因 | 排查方向 |
|------|----------|----------|
| 继承页面空白/卡住 | 池子为空（`pool=[]`）或 `done` 误判 | 查 `createPlayer` 中 `rollPool` 是否失败；查 CSV 是否被锁/格式错误；详见 `docs/debug-log-inheritance-freeze.md` |
| 点击按钮无反应 | 状态未更新或 render 卡死 | 在 `pickAttr` 中加 `console.log`；打开 React DevTools 看 state 是否变化 |
| 赛季模拟报错 `Team not found: undefined` | 抽到不存在的队伍 ID | 查 `runDoubleElim6`/`runSingleElim` 的种子数组是否有 undefined |
| 页面白屏 | React 运行时抛错（无 error boundary 会卸载整棵树） | 打开浏览器控制台（F12）→ Console 标签看红色报错信息；如 `reading 'replace'` 之类多半是组件收到 undefined 数据（参考头像色哈希 bug） |

### 8.3 查看生成的实际选手战力

用 `vite-node` 跑内联脚本：
```bash
npx vite-node -e "
import { TEAMS } from './src/data/teams';
import { calcPlayerPower } from './src/engine/power';
for (const t of TEAMS) for (const p of t.roster) {
  console.log(t.name, p.name, Math.round(calcPlayerPower(p.attributes, p.position)));
}
"
```

### 8.4 重置存档

- 浏览器控制台：`localStorage.removeItem('lpl-game-save-v1')`
- 或：在浏览器中打开游戏 → 开发者工具 → Application → Local Storage → 删除该键

---

## 九、部署

- **Vercel**：`npm run build` 后把 `dist/` 部署，或导入 GitHub 仓库由 Vercel 自动构建
- **GitHub Pages**：把 `dist/` 推到 gh-pages 分支
- **生产预览**：`npm run preview` 本地预览构建产物

---

## 十、数据规模（当前）

| 赛区 | 队伍数 | 选手数 |
|------|--------|--------|
| LPL | 8 | 40 |
| LCK | 5 | 25 |
| LEC | 3 | 15 |
| LCS | 3 | 15 |
| PCS | 1 | 5 |
| VCS | 1 | 5 |
| **合计** | **21** | **105** |

---

> 本文档与 `DESIGN.md`（设计文档 v4）互补。DESIGN.md 侧重"设计意图"，本文档侧重"实现现状和修改操作手册"。

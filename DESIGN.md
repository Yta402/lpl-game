# LPL 自建选手模拟器 — 开发指南 v4

> 本文档反映**当前代码的真实状态**（截至 2026 赛季数据 / 8 维属性 / 继承 v2）。
> v1–v3 的旧设计已废弃，以本文为准。文末附【现存问题】与【数学公式总表】。

---

## 一、项目概述

玩家自建一名选手（选位置），从 8 位真实职业选手处**逐位顺序继承属性**，加入一支真实 LPL 战队补齐该位置（队友 = 该队 2026 真实 4 人），随队征战**春季赛 → MSI → 夏季赛 → 世界赛**，最终目标夺取世界冠军。

### 核心数据规模
- LPL **8 队**、LCK **5 队**、LEC 3、LCS 3、PCS 1、VCS 1，共 21 队 105 名真实选手
- 数据源单一文件 `src/data/roster.csv`（Excel 可直接编辑）

---

## 二、技术栈

React 19 + TypeScript 6 + Vite 8 + TailwindCSS 3 + Zustand 5 + Vitest 4
持久化：localStorage · 图表：纯 SVG 自绘 · 部署：Vercel / GitHub Pages

---

## 三、实际实现的玩法

### 3.1 属性系统（8 维 3 组）

```
对线组 Laning (3): 操作 / 反应 / 发育
团战组 Teamfight (3): 配合 / 意识 / 开团
深度组 Depth (2): 英雄池 / 心态      ← v3 是 3 项(含适应)，现已删除适应
```
每项 0–99。位置权重决定各组对战力的贡献（见公式 §B）。

### 3.2 全年赛程（FSM 驱动）

```
创建角色 → 继承属性(v2) → 加入战队(补位置)
   → LPL春季赛(常规赛+Top4单败BO5) → MSI(若Top2)
   → LPL夏季赛(常规赛+Top6胜败组双败BO5) → 世界赛(若年度Top4)
        世界赛: 16队 4组循环 → 8强淘汰BO5
```

| 赛事 | 赛制 | 晋级条件 |
|------|------|----------|
| 春季常规赛 | 8队单循环 BO1 | Top4 进季后赛 |
| 春季季后赛 | Top4 单败 BO5 | 冠/亚军 = LPL MSI 两席 |
| MSI | **8队单败 BO5**：LPL2+LCK2+LEC1+LCS1+PCS1+VCS1 | 玩家在春季 Top2 才参赛 |
| 夏季常规赛 | 8队单循环 BO1 | Top6 进季后赛 |
| 夏季季后赛 | Top6 胜败组双败 BO5 | 影响世界赛种子 |
| 世界赛 | **16队**：LPL4+LCK4+LEC3+LCS3+PCS1+VCS1；4组循环 BO1 → Top2 出线 → 8强 BO5 | 玩家在年度 Top4 才参赛 |

> 其他赛区**不模拟国内赛**，直接按基础战力抽签进入 MSI/世界赛。仅 LPL 靠季后赛选拔。

### 3.3 属性继承 v2（核心玩法）

- 抽 **8 位**真实选手，**逐位顺序**选择（看完一位才看下一位）
- 每位选 1 项属性（或跳过/提前完成）
- **每项属性全局只能正常选一次**（选过即锁定，后续同属性只剩"替换"）
- **替换惩罚**：想替换已锁定属性 → 覆盖原值，但**强制连带继承该选手最弱的一项**（占一槽，标红⚠）
- 8 槽最终各按 72% 比例混合进基础属性
- 重抽仅在选择开始前可用（初始 1 次）

### 3.4 对线突破 / 亮剑（局内机制）

- **对线突破（被动）**：玩家对线组合计 − 对位选手对线组合计 ≥ 15 → 玩家本局全属性 ×1.2
- **亮剑（主动·世界赛 BO5）**：对线组每项 +15、玩家团战组 ×0.95、队友团战组 ×0.95；每系列最多 1 次
- 亮剑会让对线突破更易达成（先加 +15 再判突破）

---

## 四、项目结构（实际）

```
src/
├── types/index.ts              # 类型（8维Attributes、Team含teamwork）
├── constants/index.ts          # 位置权重、属性元数据、数值参数
├── data/
│   ├── roster.csv              # ★唯一数据源（Excel可编辑）
│   └── teams.ts                # 读CSV→Team对象；teamwork从阵容推导
├── engine/
│   ├── power.ts                # 单人/战队战力、协同、风格契合
│   ├── breakthrough.ts         # 对线突破判定、亮剑、有效属性
│   ├── match.ts                # 单局模拟、KDA/评分、BO系列赛
│   ├── season.ts               # 赛季编排(春/MSI/夏/世界)、积分、抽签
│   ├── inheritance.ts          # 继承v2：slots混合、最弱项、替换
│   ├── customPlayer.ts         # 自建选手基础属性、赛季成长
│   ├── events.ts               # 事件文字模板
│   └── __tests__/engine.test.ts
├── store/gameStore.ts          # Zustand：FSM + 继承v2状态(pickAttr/skip)
├── components/                 # Avatar/AttrBar/AttrRadar/PlayerCard/...
├── pages/                      # Menu/CreatePlayer/Inheritance/SelectTeam/SeasonHub/Result
└── utils/                      # random(高斯)/clamp/format/storage
scripts/build-roster.ts         # 一次性：overall→9维生成CSV（已弃用8维，待清理）
```

---

## 五、数据维护

- **改选手数值/名单**：Excel 打开 `src/data/roster.csv` → 改单元格 → 保存 → 刷新浏览器
- 表头：`战队ID,战队,全名,赛区,风格,队徽色,选手,位置,操作,反应,发育,配合,意识,开团,英雄池,心态,综合`
- `综合`列仅参考（=8项均值），**不参与计算**
- **团队配合度**无需填写，自动 = 阵容 5 人「配合」属性均值

---

## 六、现存问题与不一致（对比分析）

> 这是当前代码与"理想设计"的差距，按严重度排序。

### 🔴 严重（数值 bug）

1. **自建选手深度组属性偏低（9→8 转换遗留）**
   `customPlayer.ts:16` 的 `groupBase` 仍按"每组 3 项"除以 3，但深度组现在只有 2 项（英雄池/心态）。导致深度组基准偏低，自建选手实际总分 ≈308 而非设定的 340。注释还写"9 项"。
   **修法**：groupBase 应按实际组大小（3/3/2）分摊。

2. **胜率公式仍未统一**（你曾要求统一为高斯法，但未完成）
   - 玩家比赛（`match.ts:65`）：`myRoll = 战力×高斯(1,0.12)`，比大小
   - AI 比赛（`season.ts:27`）：仍是 Sigmoid `1/(1+exp((pb-pa)/60))` 掷硬币
   - 两套并存，曲线/敏感度不同。`calcWinRate`（match.ts:17）定义了却**根本没用于判胜负**。

### 🟡 设计缺口

3. **MSI/世界赛在玩家未晋级时整届不模拟**
   玩家不在 Top2/Top4 时，MSI/世界赛直接跳过（`career.msi` 为空），结果页不显示该届冠军。缺少"世界仍在运转"的叙事。

4. **亮剑仍是自动触发**，玩家无手动选择
   `match.ts:179` 默认 `isEliminationRisk || isDecisive` 自动亮剑。设计文档承诺"关键局玩家主动选"，交互弹窗未做。

5. **年度积分只算常规赛**，与"靠季后赛选拔"不符
   `worldsLplSeeds` 用春/夏常规赛排名积分，没纳入季后赛成绩。

### 🟢 健壮性 / 通用性

6. **`runDoubleElim6` 硬编码 6 队**，LPL 队数变化会崩（已靠 8 队暂时规避，但不通用）。
7. **继承池不保证位置多样性**，可能 8 位都是辅助（继承选项受限）。
8. **世界赛小组仅单循环（3场/队）**，真实是双循环/瑞士轮。
9. **`topNByRegion` 不校验赛区队伍数**，若 CSV 删队伍使某赛区不足 n 会静默返回偏少。
10. **`match.ts` 末尾 `export { pick }` 冗余**，无人使用。
11. **事件文字模板偏少**（events.ts ~20 条），多局重复感强。
12. **WE/IG/LGD 选手名是占位**，需核对 2026 真名单；`scripts/build-roster.ts` 仍是旧 9 维逻辑，应清理或重写。

### 🔵 测试薄
13. 缺继承 v2、MSI/世界赛新赛制、突破/亮剑触发率的专项测试。

---

## 七、数学公式总表（每处都列，含代码位置与当前数值）

> 常量集中在 `src/constants/index.ts`。`U(a,b)`=均匀随机，`N(μ,σ)`=高斯。

### A. CSV 属性生成（已固化为静态值，公式见 `scripts/build-roster.ts`，仅存档）
```
groupTarget(w) = overall + (w − 1) × 12
attr = clamp( round(groupTarget + N(0, regionVariance)), 25, 99 )
regionVariance: LCK=8, LPL=10, LEC=10, LCS=10, PCS=12, VCS=12
```

### B. 位置权重 `POSITION_WEIGHTS`（constants:67）
| 位置 | 对线 W_l | 团战 W_t | 深度 W_d | 和 |
|------|--------|--------|--------|----|
| 上单 | 1.2 | 0.9 | 0.9 | 3.0 |
| 打野 | 0.8 | 1.2 | 1.0 | 3.0 |
| 中单 | 1.15 | 1.0 | 0.85 | 3.0 |
| 下路 | 1.1 | 0.95 | 0.95 | 3.0 |
| 辅助 | 0.7 | 1.25 | 1.05 | 3.0 |

### C. 自建选手基础属性 `genCustomBaseAttrs`（customPlayer:12）
```
groupBase(w) = (CUSTOM_PLAYER_TOTAL × w) / totalWeight / 3     ← totalWeight=3.0
jitter(avg) = clamp( round(avg + U(−6,6)), 10, 60 )
CUSTOM_PLAYER_TOTAL = 340
⚠ 深度组应除以 2 而非 3（见问题 1）
```

### D. 团队配合度 `teamwork`（teams.ts，从阵容推导）
```
teamwork = round( avg(5 名选手的「配合」属性) )
```

### E. 单人战力 `calcPlayerPower`（power:8）
```
laning    = (操作 + 反应 + 发育) / 3
teamfight = (配合 + 意识 + 开团) / 3
depth     = (英雄池 + 心态) / 2
power     = laning×W_l + teamfight×W_t + depth×W_d
```

### F. 对线突破判定（breakthrough.ts）
```
laningSum = 操作 + 反应 + 发育
触发: myLaningSum − enemyLaningSum ≥ 15      (BREAKTHROUGH_THRESHOLD)
效果: 玩家本局所有属性 × 1.2，clamp[0,99]      (BREAKTHROUGH_MULT)
```

### G. 亮剑 `effectiveAttrs`（breakthrough.ts，应用顺序：先亮剑→判突破→突破×1.2）
```
玩家本人:  对线组每项 +15                    (CHALLENGE_LANING_BOOST)
          团战组每项 × 0.95                  (CHALLENGE_TEAMFIGHT_PENALTY)
队友:      团战组每项 × 0.95
（之后若触发突破，再对玩家全属性 ×1.2）
```

### H. 战队战力 `calcTeamPower`（power:81）
```
base    = Σ_{5人} calcPlayerPower
avgTf   = avg_{5人}( teamfightSum )          ; teamfightSum = 配合+意识+开团
synergy = 0.85 + (teamwork/100)×0.15 + (avgTf/99)×0.1     ≈ [0.85, 1.10]
styleFit= 玩家最强组契合战队风格 ? 1.05 : 1.0   (仅玩家所在队)
teamPower = base × synergy × styleFit
```

### I. 玩家比赛单局胜负 `simulateGame`（match:64）
```
myRoll = myPower  × N(1, 0.12)                ; N=高斯，RANDOM_VARIANCE=0.12
enRoll = enPower × N(1, 0.12)
isWin  = myRoll > enRoll
```

### J. AI 比赛单局胜负 `simAiGame`（season:27）⚠ 与 I 不一致
```
winA = 1 / (1 + exp((pb − pa) / 60))
胜  = random() < winA
```

### K. 胜率显示函数 `calcWinRate`（match:17）⚠ 当前未用于判胜负
```
winRate = 1 / (1 + exp((enemyPower − myPower) / 60))    ; WINRATE_SCALE=60
```

### L. 个人表现 `genPerformance`（match:111）
```
eff     = effectiveAttrs(玩家, mods)
power   = calcPlayerPower(eff)
skill   = clamp((power − 45) / 55, 0, 1.4)
kills   = round(skill×5 + U(0,4))              [+突破: +U(1,3)]
assists = U(2,10) + round(skill×4)             [+突破: +U(0,2)]
deaths  = 胜? U(0,3) : U(2,6)                  [突破 −1；亮剑未突破 40%概率 +1]
ratio   = deaths==0 ? kills+assists : (kills+assists)/deaths
rating  = clamp(5 + ratio×0.8 + (胜?1.2:−1.2) + (突破?1.5:0), 1, 10)   保留1位
```

### M. 系列赛 `simulateSeries`（match:184）
```
need = ceil(bestOf/2)，先到 need 胜结束
亮剑触发(默认): isEliminationRisk(对手赛点) ∨ isDecisive(决胜局)
亮剑限制: 每系列最多 1 次，仅 BO5
```

### N. 继承 v2 混合 `applySlots`（inheritance.ts）
```
final(attr) = clamp( round(base×(1−R) + source×R), 0, 99 )    ; R = INHERIT_RATIO = 0.72
替换惩罚: 覆盖目标属性 + 强制继承 weakestAttr(排除当前所选)
weakestAttr = argmin(attrs)（可排除一项）
```

### O. 赛季成长 `growPlayer`（customPlayer:59）
```
baseGrowth = max(0, (avgRating − 5) × 0.6)
gain(attr) = baseGrowth × weight(attr) + U(0,0.5)
weight: 操作1.2 / 反应1.0 / 发育1.0 / 配合0.8 / 意识0.8 / 开团0.7 / 心态0.9 / 英雄池0.9
new = clamp( round((old+gain)×10)/10, 0, 99 )
```

### P. 年度积分 / 世界赛 LPL 名额 `computeYearlyPoints`（season:498）
```
单场积分 = max(0, n − rank) × weight      ; n=standings长度, rank=该队名次
春季 weight = 1.0，夏季 weight = 1.3
世界赛 LPL 4 队 = 年度积分 Top4
```

### Q. 抽签 `topNByRegion`（season）
```
某赛区按 teamBasePower 降序取前 n（其他赛区直接凭战力进入 MSI/世界赛）
```

### R. 关键常量速查（constants:77）
```
ATTR_MAX=99 | BREAKTHROUGH_THRESHOLD=15 | BREAKTHROUGH_MULT=1.2
CHALLENGE_LANING_BOOST=15 | CHALLENGE_TEAMFIGHT_PENALTY=0.95
WINRATE_SCALE=60 | RANDOM_VARIANCE=0.12 | CUSTOM_PLAYER_TOTAL=340
INHERIT_RATIO=0.72 (在 inheritance.ts)
```

---

## 八、简历亮点（建议写法）

> **LPL 选手养成模拟器**（个人项目 · React + TypeScript）
> - 8 维 3 组属性体系 + 位置加权战力模型 + 高斯随机扰动的比赛模拟引擎
> - 实现"对线突破"被动（属性差阈值触发全属性加成）与"亮剑"主动博弈机制
> - 继承系统 v2：8 位选手顺序抽选 + 属性全局锁定 + 替换连带最弱项惩罚
> - FSM 管理全年 4 大赛事（春/MSI/夏/世界赛 16 队小组+淘汰），Zustand + localStorage 存档
> - 收录 2026 赛季 105 名真实选手，数据驱动（CSV 单一数据源）；Vitest 覆盖核心数值
> - 部署：[Vercel] / 源码：[GitHub]

---

## 九、后续待办（按优先级）

| 优先级 | 事项 |
|--------|------|
| P0 | 修自建选手深度组公式（问题 1） |
| P0 | 统一胜率公式为高斯法，删冗余 calcWinRate（问题 2） |
| P1 | 未晋级时仍模拟 MSI/世界赛冠军（叙事完整，问题 3） |
| P1 | 亮剑改为玩家手动选择（问题 4） |
| P1 | 年度积分纳入季后赛成绩（问题 5） |
| P2 | runDoubleElim 通用化、继承池位置多样性、世界赛双循环 |
| P2 | 核对 WE/IG/LGD 真名单；清理 build-roster.ts |
| P3 | 补测试、丰富事件文字、`export {pick}` 清理 |

---

## 十、版权声明

非商业性同人作品，仅作技术学习与简历展示。所有选手 ID/战队名/赛事名版权归 Riot Games 及各俱乐部所有。不使用真人照片，头像程序生成。数据为 2026 赛季公开名单近似快照，属性人工评估。如有异议联系移除。

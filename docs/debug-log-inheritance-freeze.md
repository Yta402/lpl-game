# 继承页面卡住问题 — 调试日志

> 日期：2026-07-19
> 相关文件：`src/store/gameStore.ts`、`src/pages/Inheritance.tsx`

---

## 一、用户报告的 Bug

1. **描述**：首次点击「下一步：继承属性」有概率卡住。
2. **再现步骤**：
   - 创建角色 → 点击进入属性继承
   - 偶尔页面不动，始终显示“X 位候选已全部处理完毕”，但实际上还没有选中任何选手
   - 即便进入选手界面，点击“继承”按钮后大约 50% 概率再次卡住（没有到下一个选手）

---

## 二、根因分析

### Bug 1：由于 `createPlayer` 之后异步写入导致前端访问空的 `pool`

**代码引子**（`src/store/gameStore.ts`, `createPlayer` 旧版本）：
```ts
createPlayer: (input) => {
  const player = createCustomPlayer(input);
  set({ draftPlayer: player, phase: 'inherit' });  // ① 先变更阶段，但 pool 仍为 []
  get().rollPool();                                  // ② 再异步获取池子
},
```
**问题所在**：
- 第 ① 步执行后，React 立刻重绘 `Inheritance` 组件。此时 `pool` 还是初始值 `[]`。
- `const done = pool.length === 0 || idx >= pool.length` → **idx===0 且 length===0** ⇒ 直接进入“已完成”状态。
- 如果第 ② 步因 CSV 解析或随机抽样等原因**内部抛出异常**，`set({ pool })` 不会执行 → 页面永久停在“候选已全部处理完毕”，用户以为卡住。
- 就算第 ② 步成功，父子组件也经历了一次中空状态，这也是偶发性 UI 闪动的根源。

**怎么修**：将 pool 和 idx 与 draftPlayer 在同一 `set()` 里写入：
```ts
const pool = rollInheritancePool(POOL_SIZE);
set({ draftPlayer: player, pool, idx: 0, slots: {}, phase: 'inherit' });
```
这样 Inheritance 首次渲染时 `pool` 已经有 9 条候选，不存在空池状态。

---

### Bug 2：“点击继承后卡住” — ~~渲染期间重复计算 `weakestAttr`~~（事后证明此诊断错误，真正根因见 §六-残留 Bug 5）

**代码引子**（旧版 `Inheritance.tsx`）：
```tsx
{ATTR_META.map((m) => {
  // ...渲染 9 个属性...
  const penaltyW = weakestAttr(currentSrc.attributes, m.key); // ← 每行调一次
  // ...
})}
```

**问题所在**：
- `weakestAttr` 内部会遍历全部 9 项属性：每个格子调一次 → 总共 9×9 = 81 次循环。
- React 重新渲染 `Inheritance` 时**整个 map 都会重新执行**，如果 React Strict Mode 触发双重挂载，计算量翻倍。
- 某些时候浏览器即使不会崩溃，也会在此处停顿几百毫秒。用户体感就是“点击继承后等了一会儿没反应”，然后连续点击可能导致**第三次触发 pickAttr**，最终把状态搞乱。
- 这并非“逻辑死锁”，而是**非必要的重复计算**导致 UI 线程被占用，给人一种“卡住”的感觉。

**怎么修**：
- 在组件渲染前**只计算一次**当前候选选手的最弱项：
```ts
const currentWeakest = ATTR_META.reduce(
  (worst, m) => (currentSrc.attributes[m.key] < currentSrc.attributes[worst] ? m.key : worst),
  ATTR_META[0].key,
) as AttrKey;
```
- 在 `ATTR_META.map(...)` 循环中直接复用 `currentWeakest`，不再每次调 `weakestAttr`。
- 同时去掉了对 `weakestAttr` 的外部调用依赖，减少了不必要的导入链。

---

## 三、额外防护措施

| 检查项 | 旧版 | 修复后 |
|--------|------|--------|
| 空 pool 时能否触发卡住 | ✅ 会 | ❌ 不再发生 |
| 空 pool 页面是否友好 | 显示“候选已全部处理完毕”（误导） | 新增提示“继承池为空，请重抽”+ 可点击重试 |
| 组件中硬编码数字 8 | `8 位候选已全部处理完毕` | 动态适应 `pool.length || 9` |
| 最终按钮文案 | 没有“完成标识” | 新增 `提前完成（已选 X 项）` vs `确认继承 → 选择战队` |

---

## 四、验证结果

| 项 | 结果 |
|----|------|
| TypeScript 编译 | ✅ 零错误 |
| 单元测试 | ✅ 17/17 通过 |
| 生产构建 | ✅ 成功 |
| 开发服务器 | ✅ 重启后 HTTP 200 运行 |

---

## 五、总结对你学习的帮助

- **Zustand/RxJS 的状态原子性**：永远不要先改状态再执行可能失败的操作。要么先准备好数据再 `set`，要么用 `immer` middleware 确保原子性。
- **React 渲染成本**：`Array.map` 里不要调用开销大的函数（尤其包含嵌套循环的），把计算结果提到 map 外面。
- **竞态 / 中间态**：UI 框架（React/Vue）在每次状态变化后都会立刻重新渲染。如果某个状态必须为真才能显示组件，就需要确保那个状态在组件首次渲染前就存在。

---

## 六、二次排查（2026-07-19 晚）：修复后仍"有概率卡住"的原因

### 排查结论

上一轮修复（原子化 set、预计算 currentWeakest）本身正确且已在源码中，但仍有 **4 个残留问题** 会让用户继续遇到"点击继承属性后无法跳出下一个界面"：

### 残留 Bug 1：`done` 判定颠倒，空池兜底是死代码（`Inheritance.tsx`）

```tsx
const done = idx >= pool.length;   // pool 为空时 0 >= 0 → done=true！
...
{pool.length === 0 && !done && (...空池警告...)}  // done 恒 true → 永远不渲染
```

- 一旦 `pool` 为空（如 `rollInheritancePool` 因 CSV 被 Excel 锁定/改坏而失败），页面走的是 done 分支：显示"9 位候选已全部处理完毕"，确认按钮因 `filledCount===0` 被 disabled → **硬卡死，无任何提示和出路**。这正是最初报告的症状。
- **修复**：`done = pool.length > 0 && idx >= pool.length`；空池警告条件去掉 `!done`，使兜底提示真正生效。

### 残留 Bug 2：跳过全部 9 位候选后硬卡死（`Inheritance.tsx`）

- 连点 9 次"跳过这位" → `done=true` 且 `filledCount=0` → 确认按钮 disabled、"重抽池"按钮 disabled（`idx !== 0`）、页面无返回按钮 → **只能刷新浏览器**。
- **修复**：done 卡片中当 `filledCount === 0` 时提示"你还没有继承任何属性"，并提供"重新抽池"按钮（走 `rollPool` 重置 `idx`/`slots`）。

### 残留 Bug 3：候选数据缺失时左栏渲染 `null`，无"跳过"按钮（`Inheritance.tsx`）

- 原 `!done && currentSrc ? 候选卡 : done ? 完成卡 : null` 中，若某候选在队伍中查找失败，左栏渲染 `null`，连"跳过这位"都没有 → 卡死。
- **修复**：增加兜底分支——候选缺失时显示错误卡片 + "跳过这位"按钮。

### 残留 Bug 4：`dist/` 构建产物过期

- `dist/` 构建于 21:34，而源码修复完成于 21:50。**若通过 `npm run preview` 或部署版本游玩，跑的还是修复前的旧代码**，自然 100% 复现旧 bug。
- **修复**：`npm run build` 重新构建。

### 验证

- 新增 `src/store/__tests__/gameStore.test.ts`（6 个回归测试）：覆盖 createPlayer 原子化、连续 100 次创建池子非空、每次 pickAttr 必推进 idx、override 推进+惩罚槽、全跳过后 rollPool 恢复、applyInheritance 进入 select-team。
- `npx vitest run`：23/23 通过；`npm run build`：类型检查 + 构建成功。

---

## 七、三次排查（2026-07-19 深夜）：浏览器自动化复现，抓到真正的根因

### 复现方法

用户在修复后仍反馈卡死。由于静态分析已无法找到问题，搭建了 puppeteer-core + 本机 Chrome 的自动化复现脚本（驱动完整流程：菜单 → 创建选手 → 连点 9 次「继承」，循环 30 轮，监听 `pageerror`）。

**第 1 轮第 2 步即复现**：点击「继承」后页面白屏，控制台报错：

```
[pageerror] Cannot read properties of undefined (reading 'replace')
```

### 残留 Bug 5（★ 真正的“约 50% 概率卡死”根因）：头像色哈希取模为负

**代码引子**（`src/data/teams.ts` `colorFor`，修复前）：

```ts
let h = 2166136261 >>> 0;
for (let i = 0; i < name.length; i++) {
  h ^= name.charCodeAt(i);
  h = Math.imul(h, 16777619);   // ← Math.imul 返回有符号 int32，h 可能为负
}
return AVATAR_COLORS[h % AVATAR_COLORS.length];  // ← 负数 % 13 仍为负 → 负索引 → undefined
```

**完整崩溃链**：

1. `colorFor` 哈希为负时 `avatarColor = AVATAR_COLORS[负索引] = undefined`。
   实测 **105 名选手中 56 名（53%）** 中招（Bin、Knight、Keria、Zeus 等）。
2. 继承页点「继承」→ `idx` 推进 → 渲染下一位候选 → `<Avatar color={undefined}>`。
3. `Avatar.tsx` 执行 `color.replace('#', '')` → **抛 TypeError**。
4. 应用**没有 error boundary**，React 卸载整棵组件树 → **白屏**。
5. 用户视角：点了继承，下一个选手没出来——“卡死”。每位候选约 53% 概率触发，与最初报告的“约 50% 概率”完全吻合。

> 这也说明 §二-Bug 2 的“`weakestAttr` 重复计算导致卡顿”诊断是**错误**的（81 次循环在现代浏览器上微不足道）。真正的 Bug 2 就是这个哈希崩溃。教训：**“有概率”的 UI 卡死，优先考虑渲染期抛异常 + 无 error boundary，而不是性能问题。**

**怎么修**（双保险）：

- 根修（`teams.ts`）：`(h >>> 0) % AVATAR_COLORS.length` —— 转无符号再取模，索引永不为负。
- 防御（`Avatar.tsx`）：`const safeColor = color || '#64748b'` —— 以后任何数据异常最多头像变灰，不再白屏。

### 验证

| 项 | 结果 |
|----|------|
| 浏览器自动化 30 轮完整流程 | ✅ 修复前 1 轮即崩 → 修复后 0 次卡死 |
| 新增数据完整性测试（所有选手 avatarColor 必须为合法 hex） | ✅ 通过 |
| `npx vitest run` | ✅ 24/24 通过 |
| `npm run build`（含 tsc） | ✅ 成功，dist/ 已重建 |

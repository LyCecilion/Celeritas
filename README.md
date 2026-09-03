<!-- markdownlint-disable MD033 MD036 MD041 -->

<div align="center">

![Celeritas Banner](./assets/banner.png)

# Celeritas

_**✨ On the Roche Limit. ⚡**_

[![CI](https://github.com/LyCecilion/Celeritas/actions/workflows/ci.yml/badge.svg)](https://github.com/LyCecilion/Celeritas/actions/workflows/ci.yml)

</div>

> [!WARNING]
>
> **Celeritas 仅供技术研究、学习交流与自动化编程实践使用。**
>
> 使用者应自行承担因使用 Celeritas 而产生的全部风险，包括但不限于账号异常、选课失效、IP 封锁等。开发者不对因使用、误用 Celeritas 导致的任何直接和间接损失负责。在使用时，请尊重学校的服务器资源、合理设置并发数和请求间隔。
>
> Celeritas 不包含任何针对系统漏洞的恶意攻击载荷，仅模拟正常的人工操作逻辑。

---

## 📖 About

Celeritas 是诞生于「洛希极限」边界的少女，负责在教务系统延迟的裂隙中捕捉一瞬的「空位」。

网速和手速不应成为通往心仪课程的阻隔。Celeritas 想要试图改变这一点，即使她的能力尚且微弱。

## ✨ Features

- 多线程并发请求、多课程逐门请求、智能退避。
- 真实验证、配置持久化、轻量零依赖。
- 多教学班支持、多批次支持、拖拽排序。

支持通识教育选修课（XGKC）、体育俱乐部（TYKC）和推荐班级课程（TJKC）。

## 🚀 Quick Start

将 [`celeritas.user.js`](celeritas.user.js) 导入到 Tampermonkey 即可（`celeritas.user.js` 为构建产物，改动源码后运行 `pnpm build`）。

## 📖 使用指南

面板出现在页面右侧，可拖拽、可最小化；关闭后点击右下角 ⚡ 随时唤回。

### 添加课程

1. 选择课程类型（通识选修 XGKC / 体育俱乐部 TYKC / 推荐班级课程 TJKC）。
2. 输入课程号或关键词搜索，从结果中「添加」具体教学班；也可以直接输入纯课程号快速添加。
3. 列表支持拖拽排序，点「×」删除。

- **指定教学班**：只跟随一个具体班次（结果标注 `[班号]`），命中精确。
- **任意班**：不加限定，任一教学班被选中即视为完成。
- 类型标签 `体` / `推` 对应体育俱乐部与推荐班级课程。

### 开始前看一眼

- **间隔**：请求的基准间隔；连续失败时自动退避（间隔 × 2^失败次数，上限 5s）。请合理设置，尊重服务器。
- **并发**：同时工作的请求数，默认 2。
- **志愿**：预选批次（第一批，摇号制）可指定 1~5 志愿；正选批次不生效。
- 配置与进度保存在浏览器本地，按批次隔离；重新打开页面依然在。

### 运行中

- 「开始」后逐门处理并查询已选列表验证；未命中会自动重试，多次失败后跳过该课程。
- 「跳过当前」手动放弃正在处理的课程。
- 页面隐藏会被浏览器降频影响速度——保持标签页可见，面板会提醒。
- 全部完成有提示音（部分浏览器要求先与页面交互一次才允许播放）。

### FAQ

- **面板没出现？** 确认当前页面地址在脚本声明的 `@match` 范围内（Tampermonkey 中可查看），且脚本已启用。
- **搜索无结果？** 确认类型与课程所在页面一致（通识选修是独立页面），或改用课程号精确搜索。
- **「服务端异常响应」？** 服务端偶发问题，会自动退避重试；持续出现请降低并发。
- **课程一直没完成？** 队列较长时耐心等待；也可手动刷新已选列表确认。
- **提示音不响？** 浏览器音频策略：先在页面上点击一次即可。

## 🔧 How It Works

选课系统的前端使用 Vue + Element UI。Celeritas 复用已有的 `axios` 实例，自带登录 token，直接调用后端 API。搜索课程、提交选课、验证结果——只在浏览器本地运行，不经过第三方服务器。

提交选课并进入选课队列后，Celeritas 查询已选列表，若找到该课程则继续提交下一门课程，否则重新提交。5 次均未查找到课程时会自动跳过。

## 📁 Project Structure

```text
Celeritas/
├── README.md
├── AGENTS.md               Agent 协作约定（流程与规范）
├── CHANGELOG.md
├── LICENSE
├── package.json            npm 元数据
├── eslint.config.mjs       ESLint 配置
├── jsconfig.json           JSDoc 类型检查配置
├── .prettierrc             Prettier 配置
├── .editorconfig           编辑器配置
├── .gitignore
├── src/                    源码（main.js + core.js）
├── tests/                  Vitest 单元测试
├── scripts/                构建脚本
├── .github/workflows/      CI 工作流
└── celeritas.user.js       构建产物（发布用）
```

## 🛠 Development

```bash
pnpm install             # 安装依赖
pnpm build               # 构建 celeritas.user.js（@version 取自 package.json）
pnpm test                # 单元测试
pnpm typecheck           # 类型检查（core.js 与测试）
pnpm lint                # ESLint
pnpm format              # 格式化
pnpm check               # 格式 + lint + 类型 + 测试
pnpm check:artifact      # 重建并校验产物未过期
```

### 🌿 Branching

开发遵循 [Git Flow](https://nvie.com/posts/a-successful-git-branching-model/)：

- `main` 仅接收 `release/*` 分支的 PR，永远是发布版本。
- `develop` 为集成主干，功能合入的目标。
- 新功能从 `develop` 分出 `feature/*` 分支，完成后 PR 回 `develop`。
- 发版时从 `develop` 分出 `release/vX.Y.Z`，合并进 `main` 并打 tag。

### 🏷 Releasing

1. 从 `develop` 分出 `release/vX.Y.Z`。
2. 更新 CHANGELOG：把 `[Unreleased]` 整理进 `[vX.Y.Z]` 并写上日期；提升 `package.json` 的 `version`，运行 `pnpm build` 重新生成产物（`@version` 自动跟随）。
3. PR 合并 `release/vX.Y.Z` 到 `main`。
4. 在 `main` 上打 tag `vX.Y.Z` 并推送——Release 工作流会自动校验版本、跑检查、构建并创建 GitHub Release（附件为 `celeritas.user.js`）。
5. 把 `release/vX.Y.Z` 合并回 `develop`，然后删除该分支。

## 📄 License

[MIT LICENSE](LICENSE).

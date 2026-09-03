# Changelog

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### Added

- Vitest 单元测试，覆盖核心纯函数（API 解析、退避计算、课程认领、旧数据兼容）。
- GitHub Actions CI：格式、lint、类型检查、测试、构建产物一致性校验。
- JSDoc 类型检查（`// @ts-check` + jsconfig）。

### Changed

- 源码拆分至 `src/`，`celeritas.user.js` 成为 esbuild 构建产物。
- `@version` 由构建时从 package.json 注入，版本号单一来源。
- ESLint 升级为 `@eslint/js` recommended + `globals`。
- package.json 补充 `repository` / `bugs` / `keywords` / `packageManager` 字段。
- 代码注释统一为英文。

## [0.1.0] - 2026-09-03

### Added

- 多线程并发抢课，多课程逐门处理，智能退避。
- 抢课结果真实验证（查询已选列表确认），未命中自动重试，多次失败后跳过。
- 支持通识教育选修（XGKC）、体育俱乐部（TYKC）、推荐班级课程（TJKC）。
- 预选批次志愿选择（摇号制）。
- 课程搜索、拖拽排序、多教学班指定，配置与进度本地持久化。
- 音频提醒、日志面板、可拖拽/最小化面板。

### Changed

- 项目由 CourseChooseBoom 更名为 Celeritas。
- 代码与 UI 命名统一为 `clrt-` 前缀；本地存储 key 从 `ccb_courses_*` 迁移至 `clrt_courses_*`（旧数据自动迁移）。

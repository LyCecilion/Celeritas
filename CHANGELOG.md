# Changelog

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

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

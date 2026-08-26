# Changelog

## v0.2.0 - 2026-08-26

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.5.1` to `1.6.3`.
- Adapted to Zhihu's latest question-page UI.
- Added support for individual answer pages (`/question/.../answer/...`).
- Moved the opportunity badge to a floating top-right position to avoid affecting Zhihu's original layout.

### Fixed

- Fixed incorrect "0 answers" detection after Zhihu UI changes.
- Fixed duplicate opportunity badges on question pages.
- Fixed page layout compression caused by injecting the badge into Zhihu's native action bar.

## v0.1.1 - 2026-06-17

### Changed

- Added userscript metadata for better update support:
  - `@homepageURL`
  - `@supportURL`
  - `@updateURL`
  - `@downloadURL`
- Bumped `Zhihu Question Opportunity Score` from `1.5` to `1.5.1`.
- Bumped `Zhihu Content Quality Score` from `1.3` to `1.3.1`.

### Notes

This update improves update detection in Tampermonkey / Violentmonkey.

No major feature changes.



## v0.1.0

首次发布。

### Added

* 新增知乎问题机会分脚本；
* 支持知乎创作中心推荐问题列表；
* 支持普通知乎问题页；
* 显示缺口值、答题分、机会等级；
* 新增知乎内容质量分脚本；
* 支持知乎创作中心内容管理页；
* 显示质效分、赞同率、收藏率；
* 所有计算均在本地浏览器完成。

## Planned

* 增加截图说明；
* 增加自定义权重配置；
* 增加一键复制数据功能；
* 增加 Greasy Fork 发布页。

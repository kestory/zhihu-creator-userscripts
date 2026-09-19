# Changelog

## v0.2.6 - 2026-09-19

### Changed

- Updated `Zhihu Content Quality Score` from `1.3.1` to `1.3.2`.
- Keep the content quality badge on one line with explicit labels for level, quality score, upvote rate, and bookmark rate.
- Keep the level-based background, border, and level text colors; use muted field names and dark numeric values.
- Allow horizontal scrolling within narrow badge rows without wrapping or widening the content card.
- Preserve scoring formulas, level thresholds, metric formatting, and the “待观察” label.

### 中文

- 将“知乎内容质量分”从 `1.3.1` 更新至 `1.3.2`。
- 保持单行展示，统一为“等级：…｜质效分：…｜赞同率：…｜收藏率：…”。
- 底色、边框和等级文字跟随质效等级，字段名使用灰色、数值使用深色。
- 窄窗口可在标签区域横向滚动，避免换行或撑宽内容卡片。
- 保留评分公式、等级阈值、数值格式和“待观察”文案。

## v0.2.5 - 2026-09-19

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.6.7` to `1.6.8`.
- Format the floating badge as labeled fields: opportunity level, gap value, and answer score.
- Tint the background and border by the overall opportunity level, independently color each rating, and keep numeric values dark.
- Show “无回答” without a gap rating when no answers exist, and explain this state in the tooltip.
- Tighten spacing and font sizes in narrow side gaps without changing the positioning calculations or scoring formulas.

### 中文

- 将“知乎问题机会分”从 `1.6.7` 更新至 `1.6.8`。
- 悬浮小框统一为“机会等级：… / 缺口值：… / 答题分：…”三项表述。
- 底色与边框跟随整体机会等级，标签使用灰色、数值使用深色；各项等级独立着色：极高紫、高绿、中琥珀、低灰。
- 没有回答时显示“缺口值：无回答”，隐藏缺口等级，并在悬浮提示中说明。
- 窄侧栏适当收紧内边距和字号，保留已确认的定位计算与评分公式。

## v0.2.4 - 2026-09-19

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.6.6` to `1.6.7`.
- Keep the badge fixed beneath the header avatar while scrolling, beside the follower/view statistics when space permits.
- Use a compact stacked layout in a narrow side gap; place it directly below the statistics when no side gap is available.
- Select the smallest statistics container when several ancestors contain identical text.
- Keep the badge visible even when the statistics scroll out of view or are removed.

### 中文

- 将“知乎问题机会分”从 `1.6.6` 更新至 `1.6.7`。
- 小框固定在右上角、头像下方，下滚时保持可见；页顶优先紧贴统计区右侧。
- 侧边空间较窄时分行展示；没有侧边空间时紧贴统计数字下方。
- 修正相同统计文字匹配到整列外层容器、导致小框离数字过远的问题。
- 统计区移出视野或被移除后，小框仍保持显示。

## v0.2.3 - 2026-09-19

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.6.5` to `1.6.6`.
- Anchor the question and answer detail badge 12px below the follower/view statistics, aligned with the statistics' right edge.
- Follow the statistics when scrolling or resizing, and hide the badge until its anchor is available.

### 中文

- 将“知乎问题机会分”从 `1.6.5` 更新至 `1.6.6`。
- 问题页和回答详情页的小框统一放在“关注者 / 被浏览”统计区下方 12px，右边缘与统计区对齐。
- 小框随统计区滚动和缩放；统计区未加载时暂不显示。

## v0.2.2 - 2026-09-19

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.6.4` to `1.6.5`.
- Fixed the floating badge to the same upper-left position on question and answer detail pages (24px from the left, 110px from the top).
- Removed avatar-dependent positioning and allowed the badge to wrap on narrow screens.

### 中文

- 将“知乎问题机会分”从 `1.6.4` 更新至 `1.6.5`。
- 问题页和回答详情页的小框统一固定在左上角（距左侧 24px、顶部 110px），不再随头像位置变化。
- 窄屏下允许小框内容换行，避免超出窗口。


## v0.2.1 - 2026-08-26

### Changed

- Updated `Zhihu Question Opportunity Score` from `1.6.3` to `1.6.4`.
- Restored opportunity-score badges on the Zhihu waiting-for-answer page (`/question/waiting`).
- Repositioned the floating opportunity badge below the profile avatar.
- Aligned the badge's right edge with the avatar for a cleaner layout.

### Fixed

- Fixed missing opportunity-score badges on the latest Zhihu waiting-for-answer page.

### 中文

- 将“知乎问题机会分”从 `1.6.3` 更新至 `1.6.4`。
- 恢复知乎待回答页面（`/question/waiting`）的问题机会分标签。
- 将问题页和回答详情页的悬浮标签移动至头像下方。
- 将标签右边缘与头像右边缘对齐，使页面布局更加整齐。
- 修复新版知乎待回答页面不显示机会分标签的问题。

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

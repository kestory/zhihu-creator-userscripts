# zhihu-creator-userscripts
Tampermonkey userscripts for Zhihu creators: question opportunity scoring and content quality scoring.

一组面向知乎创作者的油猴脚本：帮助判断哪些问题值得回答，以及评估自己回答的互动质量。


# 知乎创作效率工具箱

一组面向知乎创作者的 Tampermonkey / 油猴脚本，用来辅助判断：

1. 哪些知乎问题更值得回答；
2. 自己写过的回答互动质量如何。

项目目前包含两个脚本：

## 1. 知乎问题机会分

脚本文件：

```text
scripts/zhihu-question-opportunity-score.user.js
```

功能：

在知乎创作中心推荐问题列表、普通知乎问题页中，自动显示问题的“缺口值”和“答题分”。

核心指标：

```text
缺口值 = 浏览数 / 回答数
```

缺口值越高，说明这个问题可能存在“看的人多、回答相对少”的供需缺口。

```text
答题分 = 综合考虑浏览数、关注数、回答数、问题新鲜度、低流量池惩罚
```

答题分越高，说明这个问题更可能值得认真写一个新回答。

显示示例：

```text
高机会｜缺口 8,693 高｜答题分 115 高
```

## 2. 知乎内容质量分

脚本文件：

```text
scripts/zhihu-content-quality-score.user.js
```

功能：

在知乎创作中心内容管理页中，自动给自己写过的回答 / 文章显示“质效分”。

核心指标：

```text
加权互动 = 赞同 × 1 + 评论 × 2 + 收藏 × 1.5 + 喜欢 × 0.5
```

```text
质效分 = 1000 × 加权互动 / (阅读数 + 1000)
```

简单理解：

质效分衡量的是：一篇内容把阅读量转化成赞同、评论、收藏、喜欢的能力。

显示示例：

```text
高质｜质效 50｜赞 1.23%｜藏 2.06%
```

## 安装方法

1. 安装 Tampermonkey 浏览器扩展。
2. 打开本仓库中的 `.user.js` 脚本文件。
3. 点击 GitHub 页面右上角的 Raw。
4. Tampermonkey 会自动识别并弹出安装页面。
5. 点击安装。
6. 刷新知乎相关页面。

## 支持页面

### 知乎问题机会分

```text
https://www.zhihu.com/creator*
https://creator.zhihu.com/*
https://www.zhihu.com/question/*
```

### 知乎内容质量分

```text
https://www.zhihu.com/creator/manage/creation*
```

## 设计原则

本项目尽量保持简单、安全、透明：

* 不读取 Cookie；
* 不上传任何数据；
* 不调用外部服务器；
* 不批量爬取知乎内容；
* 只在本地解析当前页面已经展示的数据；
* 所有计算都在浏览器本地完成。

## 适用人群

适合经常在知乎写回答、做内容复盘、寻找选题灵感的创作者。

它不能保证一个问题一定会火，也不能判断内容的绝对质量，只是提供一个数据辅助视角。

## 免责声明

本项目仅用于个人学习、内容复盘和浏览器本地增强展示。

脚本不会替用户发布内容，不会自动点赞、评论、关注，也不会绕过知乎权限或限制。

请合理使用，并遵守知乎平台规则。

## License

MIT License

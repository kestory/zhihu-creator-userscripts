// ==UserScript==
// @name         知乎问题机会分 Pro
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.6.0
// @description  在知乎创作中心和普通问题页显示“缺口值”和“答题分”，兼容知乎新旧问题页布局
// @match        *://www.zhihu.com/creator*
// @match        *://creator.zhihu.com/*
// @match        *://www.zhihu.com/question/*
// @run-at       document-idle
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/kestory/zhihu-creator-userscripts
// @supportURL   https://github.com/kestory/zhihu-creator-userscripts/issues
// @updateURL    https://raw.githubusercontent.com/kestory/zhihu-creator-userscripts/main/scripts/zhihu-question-opportunity-score.user.js
// @downloadURL  https://raw.githubusercontent.com/kestory/zhihu-creator-userscripts/main/scripts/zhihu-question-opportunity-score.user.js
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    ANSWER_EXTREME: 120,
    ANSWER_HIGH: 75,
    ANSWER_MID: 40,

    GAP_EXTREME: 20000,
    GAP_HIGH: 5000,
    GAP_MID: 2000,

    VOLUME_BASE: 100000,
    FRESHNESS_BASE_DAYS: 365,

    SHOW_AGE_IN_BADGE: false
  };

  const BADGE_ID = 'zh-opportunity-question-page-badge';
  const STYLE_ID = 'zh-opportunity-style-pro';

  let lastQuestionPath = '';
  let timer = null;

  function isCreatorPage() {
    return (
      location.hostname === 'creator.zhihu.com' ||
      (
        location.hostname === 'www.zhihu.com' &&
        location.pathname.startsWith('/creator')
      )
    );
  }

  function isQuestionPage() {
    return (
      location.hostname === 'www.zhihu.com' &&
      location.pathname.startsWith('/question/')
    );
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      .zh-opportunity-badge,
      .zh-opportunity-question-badge {
        display: inline-flex;
        align-items: center;
        white-space: nowrap;
        border: 1px solid transparent;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        vertical-align: middle;
      }

      .zh-opportunity-badge {
        gap: 4px;
        margin-left: 8px;
        padding: 3px 8px;
        max-width: 280px;
      }

      .zh-opportunity-question-badge {
        gap: 5px;
        margin-left: 14px;
        padding: 4px 9px;
        flex-shrink: 0;
        align-self: center;
      }

      .zh-opportunity-sep {
        opacity: 0.55;
      }

      .zh-opportunity-strong {
        font-weight: 900;
      }

      .zh-opportunity-small {
        font-size: 11px;
        font-weight: 800;
        opacity: 0.9;
        margin-left: 2px;
      }

      .zh-opportunity-extreme {
        color: #6d28d9;
        background: #f5f3ff;
        border-color: #8b5cf655;
      }

      .zh-opportunity-high {
        color: #047857;
        background: #ecfdf5;
        border-color: #10b98155;
      }

      .zh-opportunity-mid {
        color: #b45309;
        background: #fffbeb;
        border-color: #f59e0b55;
      }

      .zh-opportunity-low {
        color: #64748b;
        background: #f8fafc;
        border-color: #94a3b855;
      }
    `;

    document.head.appendChild(style);
  }

  function escapeRegExp(s) {
    return String(s).replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&'
    );
  }

  function toNumber(num, unit = '') {
    if (
      num === null ||
      num === undefined ||
      num === ''
    ) {
      return null;
    }

    const n = Number.parseFloat(
      String(num)
        .replace(/,/g, '')
        .replace(/\s/g, '')
    );

    if (!Number.isFinite(n)) {
      return null;
    }

    if (unit === '万') {
      return n * 10000;
    }

    if (unit === '亿') {
      return n * 100000000;
    }

    return n;
  }

  /*
   * 同时兼容：
   *
   * 64回答
   * 64个回答
   * 64 个回答
   * 回答64
   *
   * 262关注
   * 262 关注
   * 关注者262
   *
   * 87.8万浏览
   * 87.8 万浏览
   * 被浏览87.8万
   */
  function extractMetric(text, labels) {
    if (!text) return null;

    for (const label of labels) {
      const escapedLabel = escapeRegExp(label);

      const patterns = [
        new RegExp(
          `([\\d,.]+)\\s*([万亿]?)\\s*(?:个|次|人)?\\s*${escapedLabel}`
        ),

        new RegExp(
          `${escapedLabel}\\s*[:：]?\\s*([\\d,.]+)\\s*([万亿]?)`
        )
      ];

      for (const re of patterns) {
        const match = text.match(re);

        if (!match) {
          continue;
        }

        const value = toNumber(
          match[1],
          match[2]
        );

        if (value !== null) {
          return value;
        }
      }
    }

    return null;
  }

  function parseAgeDays(text) {
    const match = String(text || '').match(
      /([\d.]+)\s*(分钟|小时|天|个月|月|年)前/
    );

    if (!match) {
      return null;
    }

    const n = Number.parseFloat(match[1]);

    if (!Number.isFinite(n)) {
      return null;
    }

    const unit = match[2];

    if (unit === '分钟') {
      return n / 1440;
    }

    if (unit === '小时') {
      return n / 24;
    }

    if (unit === '天') {
      return n;
    }

    if (
      unit === '个月' ||
      unit === '月'
    ) {
      return n * 30;
    }

    if (unit === '年') {
      return n * 365;
    }

    return null;
  }

  function daysFromTimestamp(ts) {
    let n = Number(ts);

    if (!Number.isFinite(n)) {
      return null;
    }

    if (n > 1000000000000) {
      n = Math.floor(n / 1000);
    }

    const min =
      new Date('2008-01-01').getTime() / 1000;

    const now =
      Date.now() / 1000;

    if (
      n < min ||
      n > now + 86400
    ) {
      return null;
    }

    const days =
      (Date.now() - n * 1000) /
      86400000;

    if (
      days < 0 ||
      days > 10000
    ) {
      return null;
    }

    return days;
  }

  function daysFromDateString(s) {
    if (!s) {
      return null;
    }

    const time =
      Date.parse(s);

    if (!Number.isFinite(time)) {
      return null;
    }

    const days =
      (Date.now() - time) /
      86400000;

    if (
      days < 0 ||
      days > 10000
    ) {
      return null;
    }

    return days;
  }

  function extractQuestionAgeDays() {
    const metaSelectors = [
      'meta[itemprop="dateCreated"]',
      'meta[itemprop="datePublished"]',
      'meta[property="article:published_time"]',
      'meta[name="date"]'
    ];

    for (const selector of metaSelectors) {
      const content =
        document
          .querySelector(selector)
          ?.getAttribute('content');

      const days =
        daysFromDateString(content);

      if (days !== null) {
        return {
          ageDays: days,
          source: '页面时间'
        };
      }
    }

    const qid =
      location.pathname
        .match(
          /^\/question\/([^/?#]+)/
        )?.[1] || '';

    if (qid) {
      const texts = [];

      const initialData =
        document.getElementById(
          'js-initialData'
        );

      if (
        initialData &&
        initialData.textContent
      ) {
        texts.push(
          initialData.textContent
        );
      }

      for (
        const script
        of Array.from(document.scripts)
      ) {
        const text =
          script.textContent || '';

        if (
          text.includes(qid) &&
          text.includes('created')
        ) {
          texts.push(text);
        }

        if (texts.length >= 4) {
          break;
        }
      }

      for (const text of texts) {
        const index =
          text.indexOf(qid);

        if (index < 0) {
          continue;
        }

        const segment =
          text.slice(
            Math.max(
              0,
              index - 10000
            ),
            index + 15000
          );

        const patterns = [
          /"created"\s*:\s*(\d{10,13})/g,
          /"createdTime"\s*:\s*(\d{10,13})/g,
          /"dateCreated"\s*:\s*"([^"]+)"/g,
          /"datePublished"\s*:\s*"([^"]+)"/g
        ];

        for (const re of patterns) {
          for (
            const match
            of segment.matchAll(re)
          ) {
            const days =
              /^\d{10,13}$/.test(
                match[1]
              )
                ? daysFromTimestamp(
                    match[1]
                  )
                : daysFromDateString(
                    match[1]
                  );

            if (days !== null) {
              return {
                ageDays: days,
                source: '隐藏数据'
              };
            }
          }
        }
      }
    }

    return {
      ageDays: 180,
      source: '默认估算'
    };
  }

  function trimZero(n, digits) {
    return n
      .toFixed(digits)
      .replace(
        /\.?0+$/,
        ''
      );
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) {
      return '-';
    }

    if (n >= 100000000) {
      return (
        trimZero(
          n / 100000000,
          2
        ) + '亿'
      );
    }

    if (n >= 10000) {
      return (
        trimZero(
          n / 10000,
          1
        ) + '万'
      );
    }

    if (n >= 1000) {
      return Math
        .round(n)
        .toLocaleString();
    }

    if (n >= 100) {
      return Math
        .round(n)
        .toString();
    }

    return trimZero(
      n,
      1
    );
  }

  function formatAge(
    ageDays,
    source
  ) {
    if (
      source === '默认估算'
    ) {
      return '默认';
    }

    if (ageDays < 1) {
      return '今天';
    }

    if (ageDays < 30) {
      return (
        `${Math.round(ageDays)}天`
      );
    }

    if (ageDays < 365) {
      return (
        `${trimZero(
          ageDays / 30,
          1
        )}月`
      );
    }

    return (
      `${trimZero(
        ageDays / 365,
        1
      )}年`
    );
  }

  function getAgeLevel(
    ageDays,
    source
  ) {
    if (
      source === '默认估算'
    ) {
      return '默认';
    }

    if (ageDays <= 30) {
      return '新';
    }

    if (ageDays <= 180) {
      return '较新';
    }

    if (ageDays <= 365) {
      return '中';
    }

    if (ageDays <= 1095) {
      return '旧';
    }

    return '很旧';
  }

  function calcAnswerScore({
    views,
    answers,
    follows,
    ageDays
  }) {
    const safeViews =
      Math.max(
        views,
        0
      );

    const safeAnswers =
      Math.max(
        answers,
        0
      );

    const safeFollows =
      Math.max(
        follows,
        0
      );

    const safeAgeDays =
      Math.max(
        ageDays,
        0
      );

    const demand =
      Math.log10(
        safeViews + 10
      );

    const followBoost =
      Math.log10(
        safeFollows + 10
      );

    const competition =
      1 /
      Math.sqrt(
        safeAnswers + 3
      );

    const freshness =
      1 /
      Math.sqrt(
        1 +
        safeAgeDays /
          CONFIG.FRESHNESS_BASE_DAYS
      );

    const volumeWeight =
      safeViews /
      (
        safeViews +
        CONFIG.VOLUME_BASE
      );

    return (
      100 *
      demand *
      followBoost *
      competition *
      freshness *
      volumeWeight
    );
  }

  function getAnswerLevel(score) {
    if (
      score >=
      CONFIG.ANSWER_EXTREME
    ) {
      return {
        text: '极高',
        shortLabel: '极高',
        fullLabel: '极高机会',
        className:
          'zh-opportunity-extreme'
      };
    }

    if (
      score >=
      CONFIG.ANSWER_HIGH
    ) {
      return {
        text: '高',
        shortLabel: '高机',
        fullLabel: '高机会',
        className:
          'zh-opportunity-high'
      };
    }

    if (
      score >=
      CONFIG.ANSWER_MID
    ) {
      return {
        text: '中',
        shortLabel: '中机',
        fullLabel: '中机会',
        className:
          'zh-opportunity-mid'
      };
    }

    return {
      text: '低',
      shortLabel: '低机',
      fullLabel: '低机会',
      className:
        'zh-opportunity-low'
    };
  }

  function getGapLevel(gap) {
    if (
      !Number.isFinite(gap)
    ) {
      return '低';
    }

    if (
      gap >=
      CONFIG.GAP_EXTREME
    ) {
      return '极高';
    }

    if (
      gap >=
      CONFIG.GAP_HIGH
    ) {
      return '高';
    }

    if (
      gap >=
      CONFIG.GAP_MID
    ) {
      return '中';
    }

    return '低';
  }

  function createBadge({
    views,
    answers,
    follows,
    ageDays,
    ageSource,
    compact = false
  }) {
    const gap =
      answers > 0
        ? views / answers
        : views;

    const score =
      calcAnswerScore({
        views,
        answers,
        follows,
        ageDays
      });

    const answerLevel =
      getAnswerLevel(score);

    const gapLevel =
      getGapLevel(gap);

    const gapText =
      answers > 0
        ? formatNumber(gap)
        : '无回答';

    const ageText =
      formatAge(
        ageDays,
        ageSource
      );

    const ageLevel =
      getAgeLevel(
        ageDays,
        ageSource
      );

    const badge =
      document.createElement(
        'span'
      );

    badge.className =
      `${
        compact
          ? 'zh-opportunity-badge'
          : 'zh-opportunity-question-badge'
      } ${answerLevel.className}`;

    badge.title = [
      `浏览数：${Math.round(
        views
      ).toLocaleString()}`,

      `回答数：${Math.round(
        answers
      ).toLocaleString()}`,

      `关注数：${Math.round(
        follows
      ).toLocaleString()}`,

      `提问时间：${ageText}`,
      `时间来源：${ageSource}`,
      `时效等级：${ageLevel}`,

      '',

      `缺口值：${gapText}`,
      `缺口等级：${gapLevel}`,

      `答题分：${score.toFixed(
        1
      )}`,

      `答题等级：${answerLevel.text}`,

      '',

      '缺口值 = 浏览数 / 回答数',

      '答题分 = 100 × log10(浏览+10) × log10(关注+10) × 流量池权重 × 时间新鲜度 / sqrt(回答+3)'
    ].join('\n');

    const ageHtml =
      CONFIG.SHOW_AGE_IN_BADGE
        ? `
          <span class="zh-opportunity-sep">｜</span>
          <span>
            时效
            <span class="zh-opportunity-strong">
              ${ageLevel}
            </span>
          </span>
        `
        : '';

    if (compact) {
      badge.innerHTML = `
        <span>
          ${answerLevel.shortLabel}
        </span>

        <span class="zh-opportunity-sep">
          ｜
        </span>

        <span>
          缺口
          <span class="zh-opportunity-strong">
            ${gapText}
          </span>
          <span class="zh-opportunity-small">
            ${gapLevel}
          </span>
        </span>

        <span class="zh-opportunity-sep">
          ｜
        </span>

        <span>
          答题
          <span class="zh-opportunity-strong">
            ${score.toFixed(0)}
          </span>
          <span class="zh-opportunity-small">
            ${answerLevel.text}
          </span>
        </span>

        ${ageHtml}
      `;
    } else {
      badge.innerHTML = `
        <span>
          ${answerLevel.fullLabel}
        </span>

        <span class="zh-opportunity-sep">
          ｜
        </span>

        <span>
          缺口
          <span class="zh-opportunity-strong">
            ${gapText}
          </span>
          <span class="zh-opportunity-small">
            ${gapLevel}
          </span>
        </span>

        <span class="zh-opportunity-sep">
          ｜
        </span>

        <span>
          答题分
          <span class="zh-opportunity-strong">
            ${score.toFixed(0)}
          </span>
          <span class="zh-opportunity-small">
            ${answerLevel.text}
          </span>
        </span>

        ${ageHtml}
      `;
    }

    return badge;
  }

  // -------------------------
  // 创作中心
  // -------------------------

  function parseCreatorMetrics(
    text
  ) {
    if (
      !text ||
      text.length > 300
    ) {
      return null;
    }

    const views =
      extractMetric(
        text,
        [
          '被浏览',
          '浏览'
        ]
      );

    const answers =
      extractMetric(
        text,
        [
          '回答'
        ]
      );

    const follows =
      extractMetric(
        text,
        [
          '关注者',
          '关注'
        ]
      );

    if (
      views === null ||
      answers === null ||
      follows === null
    ) {
      return null;
    }

    return {
      views,
      answers,
      follows
    };
  }

  function hasCreatorMetricChild(
    el
  ) {
    return Array
      .from(el.children)
      .some(child => {
        if (
          child.classList &&
          child.classList.contains(
            'zh-opportunity-badge'
          )
        ) {
          return false;
        }

        return Boolean(
          parseCreatorMetrics(
            child.innerText || ''
          )
        );
      });
  }

  function processCreatorList() {
    if (!isCreatorPage()) {
      return;
    }

    const elements =
      Array.from(
        document.querySelectorAll(
          'div, span, p, li'
        )
      );

    for (const el of elements) {
      if (
        el.dataset
          .zhOpportunityDone === '1'
      ) {
        continue;
      }

      const text =
        el.innerText || '';

      const metrics =
        parseCreatorMetrics(text);

      if (!metrics) {
        continue;
      }

      if (
        hasCreatorMetricChild(el)
      ) {
        continue;
      }

      if (
        metrics.views <= 0
      ) {
        continue;
      }

      const parsedAge =
        parseAgeDays(text);

      const ageDays =
        parsedAge === null
          ? 180
          : parsedAge;

      const ageSource =
        parsedAge === null
          ? '默认估算'
          : '页面显示';

      const badge =
        createBadge({
          ...metrics,
          ageDays,
          ageSource,
          compact: true
        });

      el.appendChild(badge);

      el.dataset
        .zhOpportunityDone = '1';
    }
  }

  // -------------------------
  // 普通问题页
  // -------------------------

  function parseQuestionStatsText(
    text
  ) {
    if (!text) {
      return null;
    }

    const views =
      extractMetric(
        text,
        [
          '被浏览',
          '浏览'
        ]
      );

    const follows =
      extractMetric(
        text,
        [
          '关注者',
          '关注'
        ]
      );

    if (
      views === null ||
      follows === null
    ) {
      return null;
    }

    return {
      views,
      follows
    };
  }

  function findQuestionStatsBox() {
    /*
     * 旧版 UI：
     *
     * 关注者
     * 262
     *
     * 被浏览
     * 87.8万
     */
    const legacySelectors = [
      '.QuestionHeader-side .NumberBoard',

      '.QuestionHeader-side [class*="NumberBoard"]',

      '[class*="QuestionHeader-side"] [class*="NumberBoard"]',

      '.NumberBoard'
    ];

    for (
      const selector
      of legacySelectors
    ) {
      const elements =
        Array.from(
          document.querySelectorAll(
            selector
          )
        );

      for (const el of elements) {
        const metrics =
          parseQuestionStatsText(
            el.innerText || ''
          );

        if (metrics) {
          return {
            el,
            ...metrics
          };
        }
      }
    }

    /*
     * 新版 UI：
     *
     * 262 关注
     * 87.8 万浏览
     *
     * 不依赖知乎 CSS 类名。
     * 选择同时包含“关注”和“浏览”
     * 且文字最短的容器。
     */
    const candidates =
      Array.from(
        document.querySelectorAll(
          'div, section, header, aside, nav'
        )
      )
        .map(el => {
          const text =
            (
              el.innerText || ''
            ).trim();

          if (
            !text ||
            text.length > 260
          ) {
            return null;
          }

          const metrics =
            parseQuestionStatsText(
              text
            );

          if (!metrics) {
            return null;
          }

          return {
            el,
            text,
            ...metrics
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.text.length -
            b.text.length
        );

    return (
      candidates[0] ||
      null
    );
  }

  function parseAnswerCountText(
    text
  ) {
    if (!text) {
      return null;
    }

    const patterns = [
      /([\d,.]+)\s*([万亿]?)\s*(?:个\s*)?回答/,

      /回答(?:数)?\s*[:：]?\s*([\d,.]+)\s*([万亿]?)/
    ];

    for (const re of patterns) {
      const match =
        text.match(re);

      if (!match) {
        continue;
      }

      return toNumber(
        match[1],
        match[2]
      );
    }

    if (
      /暂无回答|还没有回答|尚无回答/
        .test(text)
    ) {
      return 0;
    }

    return null;
  }

  function extractQuestionAnswerCount() {
    /*
     * 旧版优先：
     * List-headerText
     */
    const preferredSelectors = [
      '.Question-mainColumn .List-headerText',

      '.Question-mainColumn [class*="List-headerText"]',

      '[class*="Question-mainColumn"] [class*="List-headerText"]',

      '.List-headerText'
    ];

    for (
      const selector
      of preferredSelectors
    ) {
      const elements =
        Array.from(
          document.querySelectorAll(
            selector
          )
        );

      for (const el of elements) {
        const n =
          parseAnswerCountText(
            (
              el.innerText || ''
            ).trim()
          );

        if (n !== null) {
          return n;
        }
      }
    }

    /*
     * 新版：
     * 例如“64 个回答”
     *
     * 优先只在主内容区域搜索，
     * 避免误读右侧相关问题。
     */
    const roots = [
      document.querySelector(
        '.Question-mainColumn'
      ),

      document.querySelector(
        '[class*="Question-mainColumn"]'
      ),

      document.querySelector(
        'main'
      )
    ].filter(Boolean);

    for (const root of roots) {
      const texts =
        Array.from(
          root.querySelectorAll(
            'h1, h2, h3, div, span, p'
          )
        )
          .map(
            el =>
              (
                el.innerText || ''
              ).trim()
          )
          .filter(
            text =>
              text &&
              text.length <= 40
          )
          .sort(
            (a, b) =>
              a.length -
              b.length
          );

      for (const text of texts) {
        const n =
          parseAnswerCountText(
            text
          );

        if (n !== null) {
          return n;
        }
      }
    }

    /*
     * 找不到就是 null。
     *
     * 注意：
     * null 代表“没有成功解析”，
     * 绝不能当成“0 个回答”。
     */
    return null;
  }

  function processQuestionPage() {
    if (!isQuestionPage()) {
      const oldBadge =
        document.getElementById(
          BADGE_ID
        );

      if (oldBadge) {
        oldBadge.remove();
      }

      lastQuestionPath = '';

      return;
    }

    /*
     * 知乎是 SPA。
     * 用户直接切换问题时，
     * 删除旧问题留下的 badge。
     */
    if (
      lastQuestionPath !==
      location.pathname
    ) {
      const oldBadge =
        document.getElementById(
          BADGE_ID
        );

      if (oldBadge) {
        oldBadge.remove();
      }

      lastQuestionPath =
        location.pathname;
    }

    if (
      document.getElementById(
        BADGE_ID
      )
    ) {
      return;
    }

    const stats =
      findQuestionStatsBox();

    if (!stats) {
      return;
    }

    const answers =
      extractQuestionAnswerCount();

    /*
     * 最重要的修复：
     *
     * 找不到回答数时，
     * 不再默认按 0 计算。
     */
    if (
      stats.views === null ||
      stats.follows === null ||
      answers === null
    ) {
      return;
    }

    if (
      stats.views <= 0
    ) {
      return;
    }

    const age =
      extractQuestionAgeDays();

    const badge =
      createBadge({
        views:
          stats.views,

        answers,

        follows:
          stats.follows,

        ageDays:
          age.ageDays,

        ageSource:
          age.source,

        compact: false
      });

    badge.id =
      BADGE_ID;

    stats.el.appendChild(
      badge
    );
  }

  function process() {
    addStyle();

    /*
     * 两种页面彻底分开，
     * 不再让创作中心解析器
     * 在问题页执行。
     */
    if (isCreatorPage()) {
      processCreatorList();
      return;
    }

    if (isQuestionPage()) {
      processQuestionPage();
      return;
    }

    const oldBadge =
      document.getElementById(
        BADGE_ID
      );

    if (oldBadge) {
      oldBadge.remove();
    }
  }

  function scheduleProcess() {
    clearTimeout(timer);

    timer =
      setTimeout(
        process,
        400
      );
  }

  process();

  const observer =
    new MutationObserver(
      scheduleProcess
    );

  observer.observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );
})();

// ==UserScript==
// @name         知乎问题机会分 Pro
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.6.2
// @description  在知乎创作中心和问题页显示缺口值与答题分（适配新版知乎 UI）
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

(() => {
  'use strict';

  const CFG = {
    answer: { extreme: 120, high: 75, mid: 40 },
    gap: { extreme: 20000, high: 5000, mid: 2000 },
    volumeBase: 100000,
    freshnessBaseDays: 365,
    defaultAgeDays: 180
  };

  const STYLE_ID = 'zh-opportunity-style';
  const ROW_ID = 'zh-opportunity-question-row';

  let lastPath = location.pathname;
  let timer = null;

  const isCreatorPage = () =>
    location.hostname === 'creator.zhihu.com' ||
    (
      location.hostname === 'www.zhihu.com' &&
      location.pathname.startsWith('/creator')
    );

  const isQuestionPage = () =>
    location.hostname === 'www.zhihu.com' &&
    location.pathname.startsWith('/question/');


  // =========================
  // 样式
  // =========================

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      .zh-opportunity-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;
        border: 1px solid transparent;
        border-radius: 999px;
        padding: 4px 9px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
      }

      .zh-opportunity-inline {
        margin-left: 8px;
        vertical-align: middle;
      }

      #${ROW_ID} {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        width: 100%;
        box-sizing: border-box;
        padding: 10px 0 8px;
      }

      .zh-opportunity-sep {
        opacity: 0.5;
      }

      .zh-opportunity-strong {
        font-weight: 900;
      }

      .zh-opportunity-small {
        margin-left: 2px;
        font-size: 11px;
        font-weight: 800;
        opacity: 0.9;
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


  // =========================
  // 数字解析
  // =========================

  function parseNumber(raw, unit = '') {
    const n = Number.parseFloat(
      String(raw).replace(/,/g, '').trim()
    );

    if (!Number.isFinite(n)) return null;

    if (unit === '亿') return n * 100000000;
    if (unit === '万') return n * 10000;

    return n;
  }

  function readMetric(text, label) {
    const patterns = [
      new RegExp(
        `([\\d,.]+)\\s*([万亿]?)\\s*(?:个|次|人)?\\s*${label}`
      ),
      new RegExp(
        `${label}\\s*[:：]?\\s*([\\d,.]+)\\s*([万亿]?)`
      )
    ];

    for (const re of patterns) {
      const m = String(text).match(re);

      if (m) {
        return parseNumber(m[1], m[2]);
      }
    }

    return null;
  }

  function readAnswers(text) {
    const m = String(text).match(
      /([\d,.]+)\s*([万亿]?)\s*个回答/
    );

    return m
      ? parseNumber(m[1], m[2])
      : null;
  }

  function trimNumber(n, digits) {
    return Number(n.toFixed(digits)).toString();
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '-';

    if (n >= 100000000) {
      return `${trimNumber(n / 100000000, 2)}亿`;
    }

    if (n >= 10000) {
      return `${trimNumber(n / 10000, 1)}万`;
    }

    if (n >= 1000) {
      return Math.round(n).toLocaleString();
    }

    return trimNumber(n, 1);
  }


  // =========================
  // 问题时间
  // =========================

  function getQuestionAgeDays() {
    const qid =
      location.pathname.match(
        /^\/question\/(\d+)/
      )?.[1];

    if (!qid) {
      return CFG.defaultAgeDays;
    }

    const sources = [];

    const initial =
      document.getElementById(
        'js-initialData'
      )?.textContent;

    if (initial) {
      sources.push(initial);
    }

    for (const script of document.scripts) {
      const text =
        script.textContent || '';

      if (
        text.includes(qid) &&
        text.includes('created')
      ) {
        sources.push(text);
      }

      if (sources.length >= 4) {
        break;
      }
    }

    for (const text of sources) {
      const index =
        text.indexOf(qid);

      const chunk =
        index >= 0
          ? text.slice(
              Math.max(0, index - 8000),
              index + 12000
            )
          : text;

      const m =
        chunk.match(
          /"created"\s*:\s*(\d{10,13})/
        );

      if (!m) continue;

      let ts = Number(m[1]);

      if (ts > 1000000000000) {
        ts /= 1000;
      }

      const days =
        (
          Date.now() -
          ts * 1000
        ) / 86400000;

      if (
        days >= 0 &&
        days < 10000
      ) {
        return days;
      }
    }

    return CFG.defaultAgeDays;
  }


  // =========================
  // 评分
  // =========================

  function calcScore(
    views,
    answers,
    follows,
    ageDays
  ) {
    const demand =
      Math.log10(
        views + 10
      );

    const followBoost =
      Math.log10(
        follows + 10
      );

    const competition =
      1 /
      Math.sqrt(
        answers + 3
      );

    const freshness =
      1 /
      Math.sqrt(
        1 +
        ageDays /
          CFG.freshnessBaseDays
      );

    const volumeWeight =
      views /
      (
        views +
        CFG.volumeBase
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

  function answerLevel(score) {
    if (
      score >=
      CFG.answer.extreme
    ) {
      return [
        '极高',
        '极高机会',
        'zh-opportunity-extreme'
      ];
    }

    if (
      score >=
      CFG.answer.high
    ) {
      return [
        '高',
        '高机会',
        'zh-opportunity-high'
      ];
    }

    if (
      score >=
      CFG.answer.mid
    ) {
      return [
        '中',
        '中机会',
        'zh-opportunity-mid'
      ];
    }

    return [
      '低',
      '低机会',
      'zh-opportunity-low'
    ];
  }

  function gapLevel(gap) {
    if (
      gap >=
      CFG.gap.extreme
    ) {
      return '极高';
    }

    if (
      gap >=
      CFG.gap.high
    ) {
      return '高';
    }

    if (
      gap >=
      CFG.gap.mid
    ) {
      return '中';
    }

    return '低';
  }


  // =========================
  // 胶囊
  // =========================

  function makeBadge({
    views,
    answers,
    follows,
    ageDays,
    compact = false
  }) {
    const gap =
      answers > 0
        ? views / answers
        : views;

    const score =
      calcScore(
        views,
        answers,
        follows,
        ageDays
      );

    const [
      level,
      fullLabel,
      className
    ] = answerLevel(score);

    const badge =
      document.createElement(
        'span'
      );

    badge.className =
      `zh-opportunity-badge ${className}` +
      (
        compact
          ? ' zh-opportunity-inline'
          : ''
      );

    badge.title = [
      `浏览数：${Math.round(views).toLocaleString()}`,
      `回答数：${Math.round(answers).toLocaleString()}`,
      `关注数：${Math.round(follows).toLocaleString()}`,
      `缺口值：${formatNumber(gap)}`,
      `答题分：${score.toFixed(1)}`
    ].join('\n');

    badge.innerHTML = `
      <span>
        ${compact ? level : fullLabel}
      </span>

      <span class="zh-opportunity-sep">
        ｜
      </span>

      <span>
        缺口
        <span class="zh-opportunity-strong">
          ${formatNumber(gap)}
        </span>
        <span class="zh-opportunity-small">
          ${gapLevel(gap)}
        </span>
      </span>

      <span class="zh-opportunity-sep">
        ｜
      </span>

      <span>
        答题${compact ? '' : '分'}
        <span class="zh-opportunity-strong">
          ${score.toFixed(0)}
        </span>
        <span class="zh-opportunity-small">
          ${level}
        </span>
      </span>
    `;

    return badge;
  }


  // =========================
  // 最新版知乎问题页
  // =========================

  function findQuestionStats() {
    const candidates =
      Array.from(
        document.querySelectorAll(
          'div, span, section, header, nav'
        )
      )
        .map(el => {
          const text =
            (
              el.innerText || ''
            ).trim();

          if (
            !text ||
            text.length > 220 ||
            !text.includes('关注') ||
            !text.includes('浏览')
          ) {
            return null;
          }

          const follows =
            readMetric(
              text,
              '关注'
            );

          const views =
            readMetric(
              text,
              '浏览'
            );

          if (
            follows === null ||
            views === null
          ) {
            return null;
          }

          return {
            el,
            text,
            follows,
            views
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.text.length -
            b.text.length
        );

    return candidates[0] || null;
  }

  function findAnswerAnchor() {
    const root =
      document.querySelector(
        'main'
      ) || document;

    const candidates =
      Array.from(
        root.querySelectorAll(
          'h1, h2, h3, div, span, p'
        )
      )
        .map(el => ({
          el,
          text:
            (
              el.innerText || ''
            ).trim()
        }))
        .filter(
          item =>
            item.text.length <= 30 &&
            /^([\d,.]+)\s*([万亿]?)\s*个回答$/
              .test(item.text)
        )
        .sort(
          (a, b) =>
            a.text.length -
            b.text.length
        );

    return candidates[0] || null;
  }

  function cleanupQuestionPage() {
    /*
     * 清掉旧版本曾经塞进顶部操作栏的胶囊。
     * 当前版本自己的胶囊位于 ROW_ID 中，不删除。
     */
    document
      .querySelectorAll(
        '.zh-opportunity-question-badge, .zh-opportunity-badge'
      )
      .forEach(el => {
        if (
          !el.closest(
            `#${ROW_ID}`
          )
        ) {
          el.remove();
        }
      });
  }

  function processQuestionPage() {
    cleanupQuestionPage();

    /*
     * 已经显示，就不要再生成第二个。
     */
    if (
      document.getElementById(
        ROW_ID
      )
    ) {
      return;
    }

    const stats =
      findQuestionStats();

    const answer =
      findAnswerAnchor();

    if (
      !stats ||
      !answer
    ) {
      return;
    }

    const answers =
      readAnswers(
        answer.text
      );

    if (
      answers === null ||
      stats.views <= 0
    ) {
      return;
    }

    const badge =
      makeBadge({
        views:
          stats.views,

        answers,

        follows:
          stats.follows,

        ageDays:
          getQuestionAgeDays()
      });

    const row =
      document.createElement(
        'div'
      );

    row.id =
      ROW_ID;

    row.appendChild(
      badge
    );

    /*
     * 关键：
     * 胶囊不再放进顶部“关注/浏览/分享”操作栏。
     *
     * 而是作为独立一行，
     * 插在“XX 个回答”标题之前。
     */
    const host =
      answer.el.closest(
        '.List-header, [class*="List-header"]'
      ) ||
      answer.el;

    if (
      !host.parentElement
    ) {
      return;
    }

    host.parentElement.insertBefore(
      row,
      host
    );
  }


  // =========================
  // 创作中心
  // =========================

  function readCreatorMetrics(
    text
  ) {
    if (
      !text ||
      text.length > 260
    ) {
      return null;
    }

    const views =
      readMetric(
        text,
        '浏览'
      );

    const follows =
      readMetric(
        text,
        '关注'
      );

    const answers =
      readMetric(
        text,
        '回答'
      );

    if (
      views === null ||
      follows === null ||
      answers === null
    ) {
      return null;
    }

    return {
      views,
      follows,
      answers
    };
  }

  function processCreatorPage() {
    for (
      const el
      of document.querySelectorAll(
        'div, li'
      )
    ) {
      if (
        el.dataset
          .zhOpportunityDone === '1'
      ) {
        continue;
      }

      const text =
        (
          el.innerText || ''
        ).trim();

      const metrics =
        readCreatorMetrics(
          text
        );

      if (
        !metrics ||
        metrics.views <= 0
      ) {
        continue;
      }

      const childAlreadyMatches =
        Array.from(
          el.children
        ).some(
          child =>
            Boolean(
              readCreatorMetrics(
                (
                  child.innerText ||
                  ''
                ).trim()
              )
            )
        );

      if (
        childAlreadyMatches
      ) {
        continue;
      }

      el.appendChild(
        makeBadge({
          ...metrics,
          ageDays:
            CFG.defaultAgeDays,
          compact: true
        })
      );

      el.dataset
        .zhOpportunityDone = '1';
    }
  }


  // =========================
  // 运行
  // =========================

  function process() {
    addStyle();

    /*
     * 知乎 SPA 切换问题时，
     * 删除上一题留下的胶囊。
     */
    if (
      location.pathname !==
      lastPath
    ) {
      document
        .getElementById(
          ROW_ID
        )
        ?.remove();

      lastPath =
        location.pathname;
    }

    if (
      isQuestionPage()
    ) {
      processQuestionPage();
      return;
    }

    if (
      isCreatorPage()
    ) {
      processCreatorPage();
    }
  }

  function schedule() {
    clearTimeout(timer);

    timer =
      setTimeout(
        process,
        300
      );
  }

  process();

  new MutationObserver(
    schedule
  ).observe(
    document.body,
    {
      childList: true,
      subtree: true
    }
  );
})();

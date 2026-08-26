// ==UserScript==
// @name         知乎问题机会分 Pro
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.6.3
// @description  在知乎创作中心和新版问题/回答页显示缺口值与答题分
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

  const STYLE_ID = 'zh-opportunity-style-v163';
  const FLOAT_ID = 'zh-opportunity-question-float';

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
    /^\/question\/\d+/.test(location.pathname);

  const questionId = () =>
    location.pathname.match(/^\/question\/(\d+)/)?.[1] || '';


  // =========================
  // 样式
  // =========================

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      .zh-opportunity-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        white-space: nowrap;

        border: 1px solid transparent;
        border-radius: 999px;

        padding: 5px 10px;

        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
      }

      #${FLOAT_ID} {
        position: fixed;
        top: 150px;
        right: 28px;
        z-index: 9999;

        box-shadow: 0 2px 10px rgba(0, 0, 0, .08);
      }

      .zh-opportunity-inline {
        margin-left: 8px;
        vertical-align: middle;
        padding: 3px 8px;
      }

      .zh-opportunity-sep {
        opacity: .5;
      }

      .zh-opportunity-strong {
        font-weight: 900;
      }

      .zh-opportunity-small {
        margin-left: 2px;
        font-size: 11px;
        font-weight: 800;
        opacity: .9;
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

      @media (max-width: 900px) {
        #${FLOAT_ID} {
          top: 120px;
          right: 12px;
        }
      }
    `;

    document.head.appendChild(style);
  }


  // =========================
  // 数字
  // =========================

  function parseNumber(raw, unit = '') {
    const n = Number.parseFloat(
      String(raw ?? '')
        .replace(/,/g, '')
        .trim()
    );

    if (!Number.isFinite(n)) return null;

    if (unit === '亿') return n * 100000000;
    if (unit === '万') return n * 10000;

    return n;
  }

  function metric(text, label) {
    const s = String(text || '');

    const patterns = [
      new RegExp(
        `([\\d,.]+)\\s*([万亿]?)\\s*(?:个|次|人)?\\s*${label}`
      ),

      new RegExp(
        `${label}\\s*[:：]?\\s*([\\d,.]+)\\s*([万亿]?)`
      )
    ];

    for (const re of patterns) {
      const m = s.match(re);

      if (m) {
        return parseNumber(
          m[1],
          m[2]
        );
      }
    }

    return null;
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) {
      return '-';
    }

    const tidy = (x, digits) =>
      Number(
        x.toFixed(digits)
      ).toString();

    if (n >= 100000000) {
      return `${tidy(
        n / 100000000,
        2
      )}亿`;
    }

    if (n >= 10000) {
      return `${tidy(
        n / 10000,
        1
      )}万`;
    }

    if (n >= 1000) {
      return Math
        .round(n)
        .toLocaleString();
    }

    return tidy(n, 1);
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
      `zh-opportunity-pill ${className}` +
      (
        compact
          ? ' zh-opportunity-inline'
          : ''
      );

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

      `缺口值：${formatNumber(
        gap
      )}`,

      `答题分：${score.toFixed(
        1
      )}`
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
          ${
            answers > 0
              ? formatNumber(gap)
              : '无回答'
          }
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
  // 知乎隐藏问题数据
  // =========================

  function hasQuestionMetrics(obj) {
    return (
      obj &&
      typeof obj === 'object' &&
      [
        'answerCount',
        'followerCount',
        'visitCount',
        'viewCount'
      ].some(
        key =>
          Object.prototype
            .hasOwnProperty
            .call(obj, key)
      )
    );
  }

  function isQuestionObject(
    obj,
    qid
  ) {
    if (!hasQuestionMetrics(obj)) {
      return false;
    }

    return (
      String(
        obj.id ?? ''
      ) === qid ||

      String(
        obj.url ?? ''
      ).includes(
        `/question/${qid}`
      )
    );
  }

  function readInitialQuestion() {
    const qid =
      questionId();

    const raw =
      document
        .getElementById(
          'js-initialData'
        )
        ?.textContent;

    if (
      !qid ||
      !raw
    ) {
      return null;
    }

    try {
      const root =
        JSON.parse(raw);

      const stack = [
        root
      ];

      const seen =
        new Set();

      let steps = 0;

      while (
        stack.length &&
        steps++ < 30000
      ) {
        const obj =
          stack.pop();

        if (
          !obj ||
          typeof obj !== 'object' ||
          seen.has(obj)
        ) {
          continue;
        }

        seen.add(obj);

        /*
         * 知乎常见结构：
         * questions: {
         *   "问题ID": {...}
         * }
         */
        if (
          Object.prototype
            .hasOwnProperty
            .call(obj, qid)
        ) {
          const candidate =
            obj[qid];

          if (
            hasQuestionMetrics(
              candidate
            )
          ) {
            return candidate;
          }
        }

        if (
          isQuestionObject(
            obj,
            qid
          )
        ) {
          return obj;
        }

        for (
          const value
          of Object.values(obj)
        ) {
          if (
            value &&
            typeof value === 'object'
          ) {
            stack.push(value);
          }
        }
      }
    } catch (_) {}

    return null;
  }


  // =========================
  // 新版页面文本 fallback
  // =========================

  function findStatsText() {
    const candidates =
      Array.from(
        document.querySelectorAll(
          'div, span, section, header, nav'
        )
      )
        .map(el => ({
          text:
            (
              el.innerText || ''
            ).trim()
        }))
        .filter(
          x =>
            x.text &&
            x.text.length <= 240 &&
            x.text.includes('关注') &&
            x.text.includes('浏览')
        )
        .sort(
          (a, b) =>
            a.text.length -
            b.text.length
        );

    return (
      candidates[0]?.text ||
      ''
    );
  }

  function findAnswerCountFromPage() {
    const root =
      document.querySelector(
        'main'
      ) ||
      document.body;

    const texts =
      Array.from(
        root.querySelectorAll(
          'h1,h2,h3,div,span,p,a,button'
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
            text.length <= 50
        );

    for (const text of texts) {
      let m =
        text.match(
          /^([\d,.]+)\s*([万亿]?)\s*个回答$/
        );

      if (!m) {
        m =
          text.match(
            /查看全部\s*([\d,.]+)\s*([万亿]?)\s*个回答/
          );
      }

      if (m) {
        return parseNumber(
          m[1],
          m[2]
        );
      }
    }

    return null;
  }


  // =========================
  // 获取问题数据
  // =========================

  function questionData() {
    const q =
      readInitialQuestion();

    const statsText =
      findStatsText();

    const field = (
      obj,
      names
    ) => {
      for (
        const name
        of names
      ) {
        const n =
          Number(
            obj?.[name]
          );

        if (
          Number.isFinite(n)
        ) {
          return n;
        }
      }

      return null;
    };

    const views =
      field(
        q,
        [
          'visitCount',
          'viewCount'
        ]
      ) ??
      metric(
        statsText,
        '浏览'
      );

    const follows =
      field(
        q,
        [
          'followerCount',
          'followCount'
        ]
      ) ??
      metric(
        statsText,
        '关注'
      );

    /*
     * 回答详情页即使没有
     * “64 个回答”标题，
     * 也优先从隐藏问题对象读 answerCount。
     */
    const answers =
      field(
        q,
        [
          'answerCount'
        ]
      ) ??
      findAnswerCountFromPage();

    let ageDays =
      CFG.defaultAgeDays;

    const created =
      Number(
        q?.created ??
        q?.createdTime
      );

    if (
      Number.isFinite(created) &&
      created > 0
    ) {
      const ms =
        created >
        1000000000000
          ? created
          : created * 1000;

      const days =
        (
          Date.now() -
          ms
        ) /
        86400000;

      if (
        days >= 0 &&
        days < 10000
      ) {
        ageDays =
          days;
      }
    }

    if (
      views === null ||
      follows === null ||
      answers === null ||
      views <= 0
    ) {
      return null;
    }

    return {
      views,
      follows,
      answers,
      ageDays
    };
  }


  // =========================
  // 问题页 + 回答详情页
  // =========================

  function cleanupOldQuestionBadges() {
    document
      .querySelectorAll(
        [
          '.zh-opportunity-question-badge',
          '.zh-opportunity-badge',
          '#zh-opportunity-question-row',
          '#zh-opportunity-question-page-row'
        ].join(',')
      )
      .forEach(
        el =>
          el.remove()
      );
  }

  function processQuestionPage() {
    cleanupOldQuestionBadges();

    /*
     * 已存在就不再添加，
     * 确保永远只有一个。
     */
    if (
      document.getElementById(
        FLOAT_ID
      )
    ) {
      return;
    }

    const data =
      questionData();

    if (!data) {
      return;
    }

    const badge =
      makeBadge(data);

    badge.id =
      FLOAT_ID;

    /*
     * 直接挂 body，
     * position: fixed。
     *
     * 不进入知乎 flex/grid，
     * 所以不会挤压任何原生内容。
     */
    document.body.appendChild(
      badge
    );
  }


  // =========================
  // 创作中心
  // =========================

  function parseAgeDays(text) {
    const m =
      String(
        text || ''
      ).match(
        /([\d.]+)\s*(分钟|小时|天|个月|月|年)前/
      );

    if (!m) {
      return null;
    }

    const n =
      Number(m[1]);

    if (
      !Number.isFinite(n)
    ) {
      return null;
    }

    if (
      m[2] === '分钟'
    ) {
      return n / 1440;
    }

    if (
      m[2] === '小时'
    ) {
      return n / 24;
    }

    if (
      m[2] === '天'
    ) {
      return n;
    }

    if (
      m[2] === '个月' ||
      m[2] === '月'
    ) {
      return n * 30;
    }

    return n * 365;
  }

  function creatorMetrics(text) {
    if (
      !text ||
      text.length > 260
    ) {
      return null;
    }

    const views =
      metric(
        text,
        '浏览'
      );

    const follows =
      metric(
        text,
        '关注'
      );

    const answers =
      metric(
        text,
        '回答'
      );

    if (
      views === null ||
      follows === null ||
      answers === null ||
      views <= 0
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

      const data =
        creatorMetrics(text);

      if (!data) {
        continue;
      }

      const hasMetricChild =
        Array.from(
          el.children
        ).some(
          child =>
            creatorMetrics(
              (
                child.innerText ||
                ''
              ).trim()
            )
        );

      if (
        hasMetricChild
      ) {
        continue;
      }

      el.appendChild(
        makeBadge({
          ...data,

          ageDays:
            parseAgeDays(text) ??
            CFG.defaultAgeDays,

          compact: true
        })
      );

      el.dataset
        .zhOpportunityDone =
        '1';
    }
  }


  // =========================
  // 运行
  // =========================

  function process() {
    addStyle();

    /*
     * 知乎是 SPA。
     * 切换问题/回答时删除旧数据。
     */
    if (
      location.pathname !==
      lastPath
    ) {
      document
        .getElementById(
          FLOAT_ID
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

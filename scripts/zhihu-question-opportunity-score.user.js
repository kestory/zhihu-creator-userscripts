// ==UserScript==
// @name         知乎问题机会分 Pro
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.6.9
// @description  在知乎待回答列表、问题页和回答详情页显示缺口值与答题分
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

  const STYLE_ID = 'zqo-style-v169';
  const FLOAT_ID = 'zqo-question-float';
  const WAITING_ROW = 'zqo-waiting-row';

  let lastPath = location.pathname;
  let timer = null;
  let detailStatsHost = null;
  let positionFrame = null;
  let floatingPlacement = null;

  const isDetail = () =>
    location.hostname === 'www.zhihu.com' &&
    /^\/question\/\d+/.test(location.pathname);

  const isWaiting = () =>
    location.hostname === 'www.zhihu.com' &&
    /^\/question\/waiting\/?$/.test(location.pathname);

  const isCreator = () =>
    location.hostname === 'creator.zhihu.com' ||
    (
      location.hostname === 'www.zhihu.com' &&
      location.pathname.startsWith('/creator')
    );

  const questionId = () =>
    location.pathname.match(/^\/question\/(\d+)/)?.[1] || '';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      .zqo-pill{
        display:inline-flex;
        align-items:center;
        gap:5px;
        white-space:nowrap;
        border:1px solid transparent;
        border-radius:999px;
        padding:5px 10px;
        font-size:12px;
        font-weight:700;
        line-height:1.25;
        box-sizing:border-box
      }

      #${FLOAT_ID}{
        position:fixed;
        top:76px;
        left:auto;
        right:16px;
        visibility:hidden;
        width:max-content;
        max-width:calc(100vw - 24px);
        flex-wrap:wrap;
        z-index:9999;
        box-shadow:0 2px 10px rgba(0,0,0,.08)
      }

      #${FLOAT_ID}.zqo-stacked{
        flex-direction:column;
        align-items:flex-start;
        gap:4px;
        border-radius:12px;
        padding:8px 10px
      }

      #${FLOAT_ID}.zqo-stacked .zqo-sep{
        display:none
      }

      .${WAITING_ROW}{
        margin-top:6px;
        line-height:1;
        min-width:0;
        max-width:100%;
        overflow-x:auto
      }

      .${WAITING_ROW} .zqo-pill{
        padding:3px 8px;
        font-size:12px;
        margin-left:0;
        flex-wrap:nowrap;
        width:max-content
      }

      .zqo-inline{
        margin-left:8px;
        vertical-align:middle;
        padding:3px 8px
      }

      .zqo-sep{opacity:.5}
      .zqo-strong{font-weight:900}

      .zqo-small{
        margin-left:2px;
        font-size:11px;
        font-weight:800;
        opacity:.9
      }

      .zqo-extreme{
        color:#6d28d9;
        background:#f5f3ff;
        border-color:#8b5cf655
      }

      .zqo-high{
        color:#047857;
        background:#ecfdf5;
        border-color:#10b98155
      }

      .zqo-mid{
        color:#b45309;
        background:#fffbeb;
        border-color:#f59e0b55
      }

      .zqo-low{
        color:#64748b;
        background:#f8fafc;
        border-color:#94a3b855
      }

      .zqo-pill.zqo-detail{
        color:#334155
      }

      .zqo-detail-line{
        display:inline-flex;
        align-items:baseline
      }

      .zqo-detail .zqo-label{
        color:#607087;
        font-weight:500
      }

      .zqo-detail .zqo-number{
        color:#0f172a;
        font-weight:800
      }

      .zqo-detail .zqo-grade{
        font-weight:800
      }

      .zqo-detail .zqo-metric-grade{
        margin-left:3px;
        font-size:11px
      }

      .zqo-detail [data-level="极高"]{color:#6d28d9}
      .zqo-detail [data-level="高"]{color:#047857}
      .zqo-detail [data-level="中"]{color:#b45309}
      .zqo-detail [data-level="低"]{color:#607087}

      #${FLOAT_ID}.zqo-stacked.zqo-narrow{
        padding-left:6px;
        padding-right:6px;
        font-size:10px
      }

      #${FLOAT_ID}.zqo-narrow .zqo-metric-grade{
        font-size:10px
      }
    `;

    document.head.appendChild(style);
  }

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
        return parseNumber(m[1], m[2]);
      }
    }

    return null;
  }

  function parseAgeDays(text) {
    const m = String(text || '').match(
      /([\d.]+)\s*(分钟|小时|天|个月|月|年)\s*前/
    );

    if (!m) return null;

    const n = Number(m[1]);

    if (!Number.isFinite(n)) return null;

    if (m[2] === '分钟') return n / 1440;
    if (m[2] === '小时') return n / 24;
    if (m[2] === '天') return n;
    if (m[2] === '个月' || m[2] === '月') return n * 30;

    return n * 365;
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '-';

    const tidy = (x, d) =>
      Number(x.toFixed(d)).toString();

    if (n >= 100000000) {
      return `${tidy(n / 100000000, 2)}亿`;
    }

    if (n >= 10000) {
      return `${tidy(n / 10000, 1)}万`;
    }

    if (n >= 1000) {
      return Math.round(n).toLocaleString();
    }

    return tidy(n, 1);
  }

  function calcScore(
    views,
    answers,
    follows,
    ageDays
  ) {
    const demand =
      Math.log10(views + 10);

    const followBoost =
      Math.log10(follows + 10);

    const competition =
      1 / Math.sqrt(answers + 3);

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
    if (score >= CFG.answer.extreme) {
      return [
        '极高',
        '极高机会',
        'zqo-extreme'
      ];
    }

    if (score >= CFG.answer.high) {
      return [
        '高',
        '高机会',
        'zqo-high'
      ];
    }

    if (score >= CFG.answer.mid) {
      return [
        '中',
        '中机会',
        'zqo-mid'
      ];
    }

    return [
      '低',
      '低机会',
      'zqo-low'
    ];
  }

  function gapLevel(gap) {
    if (gap >= CFG.gap.extreme) return '极高';
    if (gap >= CFG.gap.high) return '高';
    if (gap >= CFG.gap.mid) return '中';

    return '低';
  }

  function makeBadge({
    views,
    answers,
    follows,
    ageDays,
    compact = false,
    labeled = false
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
      document.createElement('span');

    badge.className =
      `zqo-pill ${className}` +
      (compact ? ' zqo-inline' : '') +
      (!compact || labeled ? ' zqo-detail' : '');

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

      `缺口值：${formatNumber(gap)}`,

      `答题分：${score.toFixed(1)}`
    ].join('\n');

    if (!compact || labeled) {
      const gapLabel = gapLevel(gap);
      if (answers <= 0) {
        badge.title = badge.title.replace(
          `缺口值：${formatNumber(gap)}`,
          '缺口值：无回答，暂不计算浏览数与回答数的比值'
        );
      }

      badge.innerHTML = `
        <span class="zqo-detail-line">
          <span class="zqo-label">机会等级：</span><span class="zqo-grade" data-level="${level}">${level}</span>
        </span>
        <span class="zqo-sep">｜</span>
        <span class="zqo-detail-line">
          <span class="zqo-label">缺口值：</span><span class="zqo-number">${answers > 0 ? formatNumber(gap) : '无回答'}</span>${answers > 0 ? `<span class="zqo-grade zqo-metric-grade" data-level="${gapLabel}">（${gapLabel}）</span>` : ''}
        </span>
        <span class="zqo-sep">｜</span>
        <span class="zqo-detail-line">
          <span class="zqo-label">答题分：</span><span class="zqo-number">${score.toFixed(0)}</span><span class="zqo-grade zqo-metric-grade" data-level="${level}">（${level}）</span>
        </span>
      `;
      return badge;
    }

    badge.innerHTML = `
      <span>
        ${compact ? level : fullLabel}
      </span>

      <span class="zqo-sep">｜</span>

      <span>
        缺口
        <span class="zqo-strong">
          ${
            answers > 0
              ? formatNumber(gap)
              : '无回答'
          }
        </span>
        <span class="zqo-small">
          ${gapLevel(gap)}
        </span>
      </span>

      <span class="zqo-sep">｜</span>

      <span>
        答题${compact ? '' : '分'}
        <span class="zqo-strong">
          ${score.toFixed(0)}
        </span>
        <span class="zqo-small">
          ${level}
        </span>
      </span>
    `;

    return badge;
  }

  // =========================
  // 问题页 / 回答详情页
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
      const stack = [
        JSON.parse(raw)
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

        if (
          Object.prototype
            .hasOwnProperty
            .call(obj, qid) &&
          hasQuestionMetrics(
            obj[qid]
          )
        ) {
          return obj[qid];
        }

        if (
          hasQuestionMetrics(obj) &&
          (
            String(
              obj.id ?? ''
            ) === qid ||

            String(
              obj.url ?? ''
            ).includes(
              `/question/${qid}`
            )
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

  function findStatsHost() {
    const candidates = root =>
      Array.from(root.querySelectorAll('div,span,section,header,nav'))
        .map(el => ({ el, text: (el.innerText || '').trim() }))
        .filter(({ el, text }) => {
          if (text.length > 240 ||
              !text.includes('关注') || !text.includes('浏览')) return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .sort((a, b) => {
          const textDifference = a.text.length - b.text.length;
          if (textDifference) return textDifference;
          // 相同文字可能出现在整列外层容器中，选择紧贴数字的小容器。
          const aRect = a.el.getBoundingClientRect();
          const bRect = b.el.getBoundingClientRect();
          return aRect.width * aRect.height - bRect.width * bRect.height;
        });

    // 优先使用问题头部的统计区，兼容没有这些类名的新版页面。
    const header = document.querySelector('.QuestionHeader');
    return (header && candidates(header)[0]?.el) ||
      candidates(document)[0]?.el || null;
  }

  function findStatsText() {
    return (findStatsHost()?.innerText || '').trim();
  }

  function findAnswerCountFromPage() {
    const root =
      document.querySelector('main') ||
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
            text.length <= 60
        );

    for (const text of texts) {
      const m =
        text.match(
          /^([\d,.]+)\s*([万亿]?)\s*个回答$/
        ) ||
        text.match(
          /查看全部\s*([\d,.]+)\s*([万亿]?)\s*个回答/
        );

      if (m) {
        return parseNumber(
          m[1],
          m[2]
        );
      }
    }

    return null;
  }

  function questionData() {
    const q =
      readInitialQuestion();

    const statsText =
      findStatsText();

    const field = (
      obj,
      names
    ) => {
      for (const name of names) {
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

  function findHeaderAvatar() {
    const selectors = [
      '.AppHeader-profile .Avatar',
      '.AppHeader-profile img',
      '[class*="AppHeader-profile"] img',
      '.AppHeader img.Avatar',
      'header img.Avatar'
    ];

    for (const selector of selectors) {
      for (const avatar of document.querySelectorAll(selector)) {
        const rect = avatar.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 &&
            rect.top >= 0 && rect.bottom <= 160) return avatar;
      }
    }
    return null;
  }

  function positionFloatingBadge() {
    const badge = document.getElementById(FLOAT_ID);
    if (!badge) return;

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const avatar = findHeaderAvatar();
    const stats = detailStatsHost?.isConnected ? detailStatsHost : null;
    const needsLayout = !floatingPlacement ||
      floatingPlacement.viewportWidth !== viewportWidth ||
      floatingPlacement.viewportHeight !== viewportHeight ||
      (!floatingPlacement.hasStats && stats) ||
      (!floatingPlacement.hasAvatar && avatar);

    if (needsLayout) {
      badge.classList.remove('zqo-stacked', 'zqo-narrow');
      badge.style.width = '';
      const naturalWidth = badge.offsetWidth;
      const avatarRect = avatar?.getBoundingClientRect();
      const header = avatar?.closest('header,.AppHeader') ||
        document.querySelector('.AppHeader');
      const headerRect = header?.getBoundingClientRect();
      const headerBottom = headerRect && headerRect.bottom > 0 &&
        headerRect.bottom <= 160 ? headerRect.bottom : 0;
      const right = Math.max(12, avatarRect
        ? viewportWidth - avatarRect.right
        : floatingPlacement?.right ?? 16);
      const rightEdge = viewportWidth - right;
      let top = Math.max(headerBottom, avatarRect?.bottom || 0) + 8;
      if (top === 8) top = floatingPlacement?.top ?? 76;

      let width = null;
      let stacked = false;
      const rect = stats?.getBoundingClientRect();
      // 使用页顶坐标确定初始位置；滚动时保留窗口内的位置。
      const statsTop = rect ? rect.top + window.scrollY : 0;
      if (rect && rect.width > 0 && rect.height > 0 &&
          statsTop >= 0 && statsTop <= top + 100) {
        const available = Math.floor(rightEdge - rect.right - 8);
        top = Math.max(top, statsTop);
        if (available >= naturalWidth) {
          // 右侧空间足够时保持单行胶囊。
        } else if (available >= 130) {
          // 空间较窄时分行，紧贴统计区右侧，不遮挡数字。
          width = available;
          stacked = true;
        } else {
          // 窄屏没有侧边空位时，紧贴数字下方，并继续固定悬浮。
          top = Math.max(top, statsTop + rect.height + 6);
        }
      }

      floatingPlacement = {
        viewportWidth, viewportHeight, right, top, width, stacked,
        hasStats: Boolean(stats), hasAvatar: Boolean(avatar)
      };
    }

    const placement = floatingPlacement;
    badge.classList.toggle('zqo-stacked', placement.stacked);
    badge.classList.toggle('zqo-narrow', placement.stacked && placement.width < 150);
    badge.style.width = placement.width ? `${placement.width}px` : '';
    badge.style.left = 'auto';
    badge.style.right = `${Math.round(placement.right)}px`;
    badge.style.top = `${Math.round(Math.max(8, Math.min(
      placement.top, viewportHeight - badge.offsetHeight - 12
    )))}px`;
    badge.style.visibility = 'visible';
  }

  function schedulePosition() {
    if (positionFrame !== null) return;
    positionFrame = requestAnimationFrame(() => {
      positionFrame = null;
      positionFloatingBadge();
    });
  }

  function cleanupLegacyDetailBadges() {
    document
      .querySelectorAll(
        [
          '#zh-opportunity-question-float',
          '#zh-opportunity-question-row',
          '#zh-opportunity-question-page-row',
          '.zh-opportunity-question-badge',
          '.zh-opportunity-badge'
        ].join(',')
      )
      .forEach(
        el =>
          el.remove()
      );
  }

  function processDetail() {
    cleanupLegacyDetailBadges();
    detailStatsHost = findStatsHost();

    let badge =
      document.getElementById(
        FLOAT_ID
      );

    if (!badge) {
      const data =
        questionData();

      if (!data) return;

      badge =
        makeBadge(data);

      badge.id =
        FLOAT_ID;

      document.body.appendChild(
        badge
      );
    }

    positionFloatingBadge();
  }

  // =========================
  // /question/waiting
  // =========================

  function waitingMetrics(text) {
    const views =
      metric(
        text,
        '浏览'
      );

    const answers =
      metric(
        text,
        '回答'
      );

    const follows =
      metric(
        text,
        '关注'
      );

    if (
      views === null ||
      answers === null ||
      follows === null ||
      views <= 0
    ) {
      return null;
    }

    return {
      views,
      answers,
      follows,
      ageDays:
        parseAgeDays(text) ??
        CFG.defaultAgeDays
    };
  }

  function findWaitingStatsHosts() {
    return Array
      .from(
        document.querySelectorAll(
          'div,p'
        )
      )
      .filter(el => {
        const text =
          (
            el.innerText || ''
          ).trim();

        if (
          !text ||
          text.length > 220 ||
          !waitingMetrics(text)
        ) {
          return false;
        }

        return !Array
          .from(el.children)
          .some(
            child =>
              waitingMetrics(
                (
                  child.innerText ||
                  ''
                ).trim()
              )
          );
      });
  }

  function processWaiting() {
    document
      .getElementById(
        FLOAT_ID
      )
      ?.remove();

    for (
      const host
      of findWaitingStatsHosts()
    ) {
      const data =
        waitingMetrics(
          host.innerText || ''
        );

      if (!data) continue;

      const signature =
        `${data.views}|${data.answers}|${data.follows}|${Math.round(data.ageDays)}`;

      let row =
        host.nextElementSibling;

      if (
        row?.classList.contains(
          WAITING_ROW
        )
      ) {
        if (
          row.dataset.signature ===
          signature
        ) {
          continue;
        }

        row.remove();
      }

      row =
        document.createElement(
          'div'
        );

      row.className =
        WAITING_ROW;

      row.dataset.signature =
        signature;

      row.appendChild(
        makeBadge({
          ...data,
          compact: true,
          labeled: true
        })
      );

      host.insertAdjacentElement(
        'afterend',
        row
      );
    }
  }

  // =========================
  // 创作中心
  // =========================

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

  function processCreator() {
    for (
      const el
      of document.querySelectorAll(
        'div,li'
      )
    ) {
      if (
        el.dataset.zqoDone === '1'
      ) {
        continue;
      }

      const text =
        (
          el.innerText || ''
        ).trim();

      const data =
        creatorMetrics(text);

      if (!data) continue;

      if (
        Array
          .from(el.children)
          .some(
            child =>
              creatorMetrics(
                (
                  child.innerText ||
                  ''
                ).trim()
              )
          )
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

      el.dataset.zqoDone =
        '1';
    }
  }

  function cleanupInjected() {
    detailStatsHost = null;
    floatingPlacement = null;
    document
      .getElementById(
        FLOAT_ID
      )
      ?.remove();

    document
      .querySelectorAll(
        `.${WAITING_ROW}`
      )
      .forEach(
        el =>
          el.remove()
      );
  }

  function process() {
    addStyle();

    if (
      location.pathname !==
      lastPath
    ) {
      cleanupInjected();

      lastPath =
        location.pathname;
    }

    if (isDetail()) {
      return processDetail();
    }

    if (isWaiting()) {
      return processWaiting();
    }

    if (isCreator()) {
      return processCreator();
    }
  }

  function schedule() {
    clearTimeout(timer);

    timer =
      setTimeout(
        process,
        250
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

  window.addEventListener(
    'resize',
    () => {
      schedulePosition();
      schedule();
    },
    {
      passive: true
    }
  );

  window.addEventListener('scroll', schedulePosition, {
    passive: true,
    capture: true
  });
})();

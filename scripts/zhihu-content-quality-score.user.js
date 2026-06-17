// ==UserScript==
// @name         知乎内容质量分 Simple
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.3
// @description  在知乎创作中心内容管理页显示简单质效分
// @match        *://www.zhihu.com/creator/manage/creation*
// @run-at       document-idle
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    EXTREME: 80,
    HIGH: 40,
    MID: 15
  };

  function addStyle() {
    if (document.getElementById('zh-quality-simple-style')) return;

    const style = document.createElement('style');
    style.id = 'zh-quality-simple-style';
    style.textContent = `
      .zh-quality-simple-row {
        margin-top: 6px;
        margin-bottom: 4px;
      }

      .zh-quality-simple-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        white-space: nowrap;
        border: 1px solid transparent;
      }

      .zh-quality-sep {
        opacity: 0.55;
      }

      .zh-quality-strong {
        font-weight: 900;
      }

      .zh-quality-extreme {
        color: #6d28d9;
        background: #f5f3ff;
        border-color: #8b5cf655;
      }

      .zh-quality-high {
        color: #047857;
        background: #ecfdf5;
        border-color: #10b98155;
      }

      .zh-quality-mid {
        color: #b45309;
        background: #fffbeb;
        border-color: #f59e0b55;
      }

      .zh-quality-low {
        color: #64748b;
        background: #f8fafc;
        border-color: #94a3b855;
      }
    `;
    document.head.appendChild(style);
  }

  function toNumber(num, unit) {
    if (!num) return 0;

    const clean = String(num)
      .replace(/,/g, '')
      .replace(/\s/g, '')
      .trim();

    const n = parseFloat(clean);
    if (Number.isNaN(n)) return 0;

    if (unit === '万') return n * 10000;
    if (unit === '亿') return n * 100000000;

    return n;
  }

  function extractMetric(text, label) {
    const re = new RegExp(`([\\d,.]+)\\s*([万亿]?)\\s*${label}`);
    const m = text.match(re);
    if (!m) return 0;
    return toNumber(m[1], m[2]);
  }

  function trimZero(n, digits) {
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatPercent(rate) {
    if (!Number.isFinite(rate)) return '-';

    const p = rate * 100;
    if (p >= 10) return trimZero(p, 1) + '%';
    if (p >= 1) return trimZero(p, 2) + '%';
    if (p > 0) return trimZero(p, 3) + '%';
    return '0%';
  }

  function isMetricLine(text) {
    if (!text) return false;
    if (text.length > 260) return false;

    return (
      text.includes('阅读') &&
      text.includes('赞同') &&
      text.includes('评论') &&
      text.includes('收藏') &&
      /[\d,.]+\s*[万亿]?\s*阅读/.test(text)
    );
  }

  function hasMetricChild(el) {
    for (const child of el.children) {
      if (child.classList && child.classList.contains('zh-quality-simple-row')) {
        continue;
      }

      const text = child.innerText || '';
      if (isMetricLine(text)) return true;
    }

    return false;
  }

  function isTopSummary(text) {
    return (
      text.includes('共') &&
      text.includes('条内容') &&
      text.includes('阅读') &&
      text.includes('赞同')
    );
  }

  function calcScore({ views, agrees, comments, collects, likes }) {
    const weighted =
      agrees * 1 +
      comments * 2 +
      collects * 1.5 +
      likes * 0.5;

    const score = 1000 * weighted / (views + 1000);

    return {
      score,
      weighted
    };
  }

  function getLevel(score) {
    if (score >= CONFIG.EXTREME) {
      return {
        label: '极优',
        className: 'zh-quality-extreme'
      };
    }

    if (score >= CONFIG.HIGH) {
      return {
        label: '高质',
        className: 'zh-quality-high'
      };
    }

    if (score >= CONFIG.MID) {
      return {
        label: '中等',
        className: 'zh-quality-mid'
      };
    }

    return {
      label: '待观察',
      className: 'zh-quality-low'
    };
  }

  function createBadge({ views, agrees, comments, collects, likes }) {
    const { score, weighted } = calcScore({
      views,
      agrees,
      comments,
      collects,
      likes
    });

    const level = getLevel(score);

    const agreeRate = views > 0 ? agrees / views : 0;
    const collectRate = views > 0 ? collects / views : 0;
    const commentRate = views > 0 ? comments / views : 0;

    const badge = document.createElement('span');
    badge.className = `zh-quality-simple-badge ${level.className}`;

    badge.title = [
      `阅读数：${Math.round(views).toLocaleString()}`,
      `赞同数：${Math.round(agrees).toLocaleString()}`,
      `评论数：${Math.round(comments).toLocaleString()}`,
      `收藏数：${Math.round(collects).toLocaleString()}`,
      `喜欢数：${Math.round(likes).toLocaleString()}`,
      '',
      `赞同率：${formatPercent(agreeRate)}`,
      `收藏率：${formatPercent(collectRate)}`,
      `评论率：${formatPercent(commentRate)}`,
      '',
      `加权互动：${trimZero(weighted, 1)}`,
      `质效分：${trimZero(score, 1)}`,
      '',
      '公式：',
      '加权互动 = 赞同×1 + 评论×2 + 收藏×1.5 + 喜欢×0.5',
      '质效分 = 1000 × 加权互动 / (阅读数 + 1000)'
    ].join('\n');

    badge.innerHTML = `
      <span>${level.label}</span>
      <span class="zh-quality-sep">｜</span>
      <span>质效 <span class="zh-quality-strong">${score.toFixed(0)}</span></span>
      <span class="zh-quality-sep">｜</span>
      <span>赞 <span class="zh-quality-strong">${formatPercent(agreeRate)}</span></span>
      <span class="zh-quality-sep">｜</span>
      <span>藏 <span class="zh-quality-strong">${formatPercent(collectRate)}</span></span>
    `;

    return badge;
  }

  function insertAfterMetricLine(el, badge) {
    if (el.dataset.zhQualityInserted === '1') return;

    const row = document.createElement('div');
    row.className = 'zh-quality-simple-row';
    row.appendChild(badge);

    el.insertAdjacentElement('afterend', row);
    el.dataset.zhQualityInserted = '1';
  }

  function process() {
    addStyle();

    const elements = Array.from(document.querySelectorAll('div, span, p, li'));

    for (const el of elements) {
      if (el.dataset.zhQualityDone === '1') continue;

      const text = el.innerText || '';

      if (!isMetricLine(text)) continue;
      if (hasMetricChild(el)) continue;
      if (isTopSummary(text)) continue;

      const views = extractMetric(text, '阅读');
      const agrees = extractMetric(text, '赞同');
      const comments = extractMetric(text, '评论');
      const collects = extractMetric(text, '收藏');
      const likes = extractMetric(text, '喜欢');

      if (views <= 0) continue;

      const badge = createBadge({
        views,
        agrees,
        comments,
        collects,
        likes
      });

      insertAfterMetricLine(el, badge);
      el.dataset.zhQualityDone = '1';
    }
  }

  let timer = null;

  function scheduleProcess() {
    clearTimeout(timer);
    timer = setTimeout(process, 300);
  }

  process();

  const observer = new MutationObserver(scheduleProcess);
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

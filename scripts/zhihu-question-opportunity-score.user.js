// ==UserScript==
// @name         知乎问题机会分 Pro
// @namespace    https://github.com/kestory/zhihu-creator-userscripts
// @version      1.5
// @description  在知乎创作中心和普通问题页显示“缺口值”和“答题分”，用颜色标记极高/高/中/低机会
// @match        *://www.zhihu.com/creator*
// @match        *://creator.zhihu.com/*
// @match        *://www.zhihu.com/question/*
// @run-at       document-idle
// @grant        none
// @license      MIT
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

    // 默认不把时间写进胶囊，避免标签太大。
    // 想看时效，可以改成 true。
    SHOW_AGE_IN_BADGE: false
  };

  const QUESTION_BADGE_ID = 'zh-opportunity-question-page-badge';
  let lastQuestionPath = '';

  function addStyle() {
    if (document.getElementById('zh-opportunity-style-pro')) return;

    const style = document.createElement('style');
    style.id = 'zh-opportunity-style-pro';

    style.textContent = `
      .zh-opportunity-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-left: 8px;
        padding: 3px 8px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        vertical-align: middle;
        white-space: nowrap;
        border: 1px solid transparent;
        max-width: 280px;
      }

      .zh-opportunity-question-badge {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        margin-left: 14px;
        padding: 4px 9px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.25;
        vertical-align: middle;
        white-space: nowrap;
        border: 1px solid transparent;
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

  function extractAfterLabel(text, label) {
    const re = new RegExp(`${label}\\s*([\\d,.]+)\\s*([万亿]?)`);
    const m = text.match(re);
    if (!m) return 0;
    return toNumber(m[1], m[2]);
  }

  function parseAgeDays(text) {
    const m = text.match(/([\d.]+)\s*(分钟|小时|天|个月|月|年)前/);
    if (!m) return null;

    const n = parseFloat(m[1]);
    const unit = m[2];

    if (Number.isNaN(n)) return null;

    if (unit === '分钟') return n / 1440;
    if (unit === '小时') return n / 24;
    if (unit === '天') return n;
    if (unit === '个月' || unit === '月') return n * 30;
    if (unit === '年') return n * 365;

    return null;
  }

  function daysFromTimestamp(ts) {
    if (!ts) return null;

    let n = Number(ts);
    if (!Number.isFinite(n)) return null;

    // 13 位毫秒时间戳转秒
    if (n > 1000000000000) {
      n = Math.floor(n / 1000);
    }

    // 合理范围：2008 年之后，且不晚于当前时间
    const min = new Date('2008-01-01').getTime() / 1000;
    const now = Date.now() / 1000;

    if (n < min || n > now + 86400) return null;

    const days = (Date.now() - n * 1000) / 86400000;
    if (days < 0 || days > 10000) return null;

    return days;
  }

  function daysFromDateString(s) {
    if (!s) return null;

    const t = Date.parse(s);
    if (!Number.isFinite(t)) return null;

    const days = (Date.now() - t) / 86400000;
    if (days < 0 || days > 10000) return null;

    return days;
  }

  function extractQuestionAgeDays() {
    // 1. 先试 meta
    const metaSelectors = [
      'meta[itemprop="dateCreated"]',
      'meta[itemprop="datePublished"]',
      'meta[property="article:published_time"]',
      'meta[name="date"]'
    ];

    for (const selector of metaSelectors) {
      const meta = document.querySelector(selector);
      const content = meta && meta.getAttribute('content');
      const days = daysFromDateString(content);
      if (days !== null) {
        return {
          ageDays: days,
          source: '页面时间'
        };
      }
    }

    // 2. 再试知乎页面隐藏数据
    const qidMatch = location.pathname.match(/\/question\/([^/?#]+)/);
    const qid = qidMatch ? decodeURIComponent(qidMatch[1]) : '';

    if (qid) {
      const texts = [];

      const initialData = document.getElementById('js-initialData');
      if (initialData && initialData.textContent) {
        texts.push(initialData.textContent);
      }

      for (const script of Array.from(document.scripts)) {
        const t = script.textContent || '';
        if (t.includes(qid) && t.includes('created')) {
          texts.push(t);
        }
        if (texts.length >= 4) break;
      }

      for (const text of texts) {
        const idx = text.indexOf(qid);
        if (idx < 0) continue;

        const segment = text.slice(Math.max(0, idx - 10000), idx + 15000);

        const patterns = [
          /"created"\s*:\s*(\d{10,13})/g,
          /"createdTime"\s*:\s*(\d{10,13})/g,
          /"dateCreated"\s*:\s*"([^"]+)"/g,
          /"datePublished"\s*:\s*"([^"]+)"/g
        ];

        for (const re of patterns) {
          const matches = Array.from(segment.matchAll(re));
          for (const m of matches) {
            const days = /^\d{10,13}$/.test(m[1])
              ? daysFromTimestamp(m[1])
              : daysFromDateString(m[1]);

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

    // 3. 找不到时，用中性默认值
    return {
      ageDays: 180,
      source: '默认估算'
    };
  }

  function trimZero(n, digits) {
    return n.toFixed(digits).replace(/\.?0+$/, '');
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return '-';

    if (n >= 100000000) return trimZero(n / 100000000, 2) + '亿';
    if (n >= 10000) return trimZero(n / 10000, 1) + '万';
    if (n >= 1000) return Math.round(n).toLocaleString();
    if (n >= 100) return Math.round(n).toString();
    if (n >= 10) return trimZero(n, 1);

    return trimZero(n, 1);
  }

  function formatAge(ageDays, source) {
    if (source === '默认估算') return '默认';

    if (ageDays < 1) return '今天';
    if (ageDays < 30) return `${Math.round(ageDays)}天`;
    if (ageDays < 365) return `${trimZero(ageDays / 30, 1)}月`;

    return `${trimZero(ageDays / 365, 1)}年`;
  }

  function getAgeLevel(ageDays, source) {
    if (source === '默认估算') return '默认';
    if (ageDays <= 30) return '新';
    if (ageDays <= 180) return '较新';
    if (ageDays <= 365) return '中';
    if (ageDays <= 1095) return '旧';
    return '很旧';
  }

  function calcAnswerScore({ views, answers, follows, ageDays }) {
    const safeViews = Math.max(views, 0);
    const safeAnswers = Math.max(answers, 0);
    const safeFollows = Math.max(follows, 0);
    const safeAgeDays = Math.max(ageDays, 0);

    const demand = Math.log10(safeViews + 10);
    const followBoost = Math.log10(safeFollows + 10);

    // 回答越多，竞争越激烈
    const competition = 1 / Math.sqrt(safeAnswers + 3);

    // 越新越好，但老问题不直接归零
    const freshness = 1 / Math.sqrt(1 + safeAgeDays / CONFIG.FRESHNESS_BASE_DAYS);

    // 小流量池惩罚
    const volumeWeight = safeViews / (safeViews + CONFIG.VOLUME_BASE);

    return 100 * demand * followBoost * competition * freshness * volumeWeight;
  }

  function getAnswerLevel(score) {
    if (score >= CONFIG.ANSWER_EXTREME) {
      return {
        text: '极高',
        shortLabel: '极高',
        fullLabel: '极高机会',
        className: 'zh-opportunity-extreme'
      };
    }

    if (score >= CONFIG.ANSWER_HIGH) {
      return {
        text: '高',
        shortLabel: '高机',
        fullLabel: '高机会',
        className: 'zh-opportunity-high'
      };
    }

    if (score >= CONFIG.ANSWER_MID) {
      return {
        text: '中',
        shortLabel: '中机',
        fullLabel: '中机会',
        className: 'zh-opportunity-mid'
      };
    }

    return {
      text: '低',
      shortLabel: '低机',
      fullLabel: '低机会',
      className: 'zh-opportunity-low'
    };
  }

  function getGapLevel(gap) {
    if (!Number.isFinite(gap)) return '低';
    if (gap >= CONFIG.GAP_EXTREME) return '极高';
    if (gap >= CONFIG.GAP_HIGH) return '高';
    if (gap >= CONFIG.GAP_MID) return '中';
    return '低';
  }

  function createBadge({ views, answers, follows, ageDays, ageSource, compact = false }) {
    const gap = answers > 0 ? views / answers : views;

    const answerScore = calcAnswerScore({
      views,
      answers,
      follows,
      ageDays
    });

    const answerLevel = getAnswerLevel(answerScore);
    const gapLevel = getGapLevel(gap);

    const gapText = answers > 0 ? formatNumber(gap) : '无回答';
    const scoreText = answerScore.toFixed(0);

    const ageText = formatAge(ageDays, ageSource);
    const ageLevel = getAgeLevel(ageDays, ageSource);

    const badge = document.createElement('span');
    badge.className = `${compact ? 'zh-opportunity-badge' : 'zh-opportunity-question-badge'} ${answerLevel.className}`;

    badge.title = [
      `浏览数：${Math.round(views).toLocaleString()}`,
      `回答数：${Math.round(answers).toLocaleString()}`,
      `关注数：${Math.round(follows).toLocaleString()}`,
      `提问时间：${ageText}`,
      `时间来源：${ageSource}`,
      `时效等级：${ageLevel}`,
      '',
      `缺口值：${gapText}`,
      `缺口等级：${gapLevel}`,
      `答题分：${answerScore.toFixed(1)}`,
      `答题等级：${answerLevel.text}`,
      '',
      '缺口值 = 浏览数 / 回答数',
      '答题分 = 100 × log10(浏览+10) × log10(关注+10) × 流量池权重 × 时间新鲜度 / sqrt(回答+3)',
      '流量池权重 = 浏览 / (浏览 + 100000)',
      '时间新鲜度 = 1 / sqrt(1 + 提问天数 / 365)'
    ].join('\n');

    const ageHtml = CONFIG.SHOW_AGE_IN_BADGE
      ? `<span class="zh-opportunity-sep">｜</span><span>时效 <span class="zh-opportunity-strong">${ageLevel}</span></span>`
      : '';

    if (compact) {
      badge.innerHTML = `
        <span>${answerLevel.shortLabel}</span>
        <span class="zh-opportunity-sep">｜</span>
        <span>缺口 <span class="zh-opportunity-strong">${gapText}</span><span class="zh-opportunity-small">${gapLevel}</span></span>
        <span class="zh-opportunity-sep">｜</span>
        <span>答题 <span class="zh-opportunity-strong">${scoreText}</span><span class="zh-opportunity-small">${answerLevel.text}</span></span>
        ${ageHtml}
      `;
    } else {
      badge.innerHTML = `
        <span>${answerLevel.fullLabel}</span>
        <span class="zh-opportunity-sep">｜</span>
        <span>缺口 <span class="zh-opportunity-strong">${gapText}</span><span class="zh-opportunity-small">${gapLevel}</span></span>
        <span class="zh-opportunity-sep">｜</span>
        <span>答题分 <span class="zh-opportunity-strong">${scoreText}</span><span class="zh-opportunity-small">${answerLevel.text}</span></span>
        ${ageHtml}
      `;
    }

    return badge;
  }

  // ---------- 创作中心推荐问题列表 ----------

  function isCreatorMetricText(text) {
    if (!text) return false;
    if (text.length > 300) return false;

    return (
      text.includes('浏览') &&
      text.includes('回答') &&
      text.includes('关注') &&
      /[\d,.]+\s*[万亿]?\s*浏览/.test(text)
    );
  }

  function hasCreatorMetricChild(el) {
    for (const child of el.children) {
      if (child.classList && child.classList.contains('zh-opportunity-badge')) continue;

      const text = child.innerText || '';
      if (isCreatorMetricText(text)) return true;
    }

    return false;
  }

  function processCreatorList() {
    const elements = Array.from(document.querySelectorAll('div, span, p, li'));

    for (const el of elements) {
      if (el.dataset.zhOpportunityDone === '1') continue;

      const text = el.innerText || '';

      if (!isCreatorMetricText(text)) continue;
      if (hasCreatorMetricChild(el)) continue;

      const views = extractMetric(text, '浏览');
      const answers = extractMetric(text, '回答');
      const follows = extractMetric(text, '关注');

      const parsedAge = parseAgeDays(text);
      const ageDays = parsedAge === null ? 180 : parsedAge;
      const ageSource = parsedAge === null ? '默认估算' : '页面显示';

      if (views <= 0) continue;

      const badge = createBadge({
        views,
        answers,
        follows,
        ageDays,
        ageSource,
        compact: true
      });

      el.appendChild(badge);
      el.dataset.zhOpportunityDone = '1';
    }
  }

  // ---------- 普通知乎问题页 ----------

  function findQuestionStatsBox() {
    const selectors = [
      '.QuestionHeader-side .NumberBoard',
      '.QuestionHeader-side [class*="NumberBoard"]',
      '[class*="QuestionHeader-side"] [class*="NumberBoard"]',
      '.NumberBoard'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const text = el.innerText || '';
      if (text.includes('关注者') && text.includes('被浏览')) {
        return el;
      }
    }

    const candidates = Array.from(document.querySelectorAll('div, section, aside'))
      .filter(el => {
        const text = el.innerText || '';
        return (
          text.includes('关注者') &&
          text.includes('被浏览') &&
          text.length < 180
        );
      })
      .sort((a, b) => {
        const at = a.innerText || '';
        const bt = b.innerText || '';
        return at.length - bt.length;
      });

    return candidates[0] || null;
  }

  function extractQuestionAnswerCount() {
    const preferredSelectors = [
      '.Question-mainColumn .List-headerText',
      '.Question-mainColumn [class*="List-headerText"]',
      '.List-headerText'
    ];

    for (const selector of preferredSelectors) {
      const els = Array.from(document.querySelectorAll(selector));

      for (const el of els) {
        const text = (el.innerText || '').trim();
        const m = text.match(/^([\d,.]+)\s*([万亿]?)\s*个回答/);

        if (m) {
          return toNumber(m[1], m[2]);
        }
      }
    }

    const bodyText = document.body.innerText || '';
    const matches = Array.from(bodyText.matchAll(/([\d,.]+)\s*([万亿]?)\s*个回答/g));

    if (!matches.length) return 0;

    // 兜底：取最大的“个回答”，避免误取右侧相关问题的 3 个回答、10 个回答
    return matches.reduce((max, m) => {
      const n = toNumber(m[1], m[2]);
      return Math.max(max, n);
    }, 0);
  }

  function processQuestionPage() {
    const isQuestionPage = location.pathname.startsWith('/question/');

    if (!isQuestionPage) {
      const oldBadge = document.getElementById(QUESTION_BADGE_ID);
      if (oldBadge) oldBadge.remove();
      lastQuestionPath = '';
      return;
    }

    if (lastQuestionPath !== location.pathname) {
      const oldBadge = document.getElementById(QUESTION_BADGE_ID);
      if (oldBadge) oldBadge.remove();
      lastQuestionPath = location.pathname;
    }

    if (document.getElementById(QUESTION_BADGE_ID)) return;

    const statsBox = findQuestionStatsBox();
    if (!statsBox) return;

    const statsText = statsBox.innerText || '';

    const follows =
      extractAfterLabel(statsText, '关注者') ||
      extractMetric(statsText, '关注者') ||
      extractMetric(statsText, '关注');

    const views =
      extractAfterLabel(statsText, '被浏览') ||
      extractMetric(statsText, '被浏览') ||
      extractMetric(statsText, '浏览');

    const answers = extractQuestionAnswerCount();

    if (views <= 0 || answers <= 0) return;

    const ageInfo = extractQuestionAgeDays();

    const badge = createBadge({
      views,
      answers,
      follows,
      ageDays: ageInfo.ageDays,
      ageSource: ageInfo.source,
      compact: false
    });

    badge.id = QUESTION_BADGE_ID;

    // 放到“关注者 / 被浏览”旁边
    statsBox.appendChild(badge);
  }

  function process() {
    addStyle();
    processCreatorList();
    processQuestionPage();
  }

  let timer = null;

  function scheduleProcess() {
    clearTimeout(timer);
    timer = setTimeout(process, 500);
  }

  process();

  const observer = new MutationObserver(scheduleProcess);

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
})();

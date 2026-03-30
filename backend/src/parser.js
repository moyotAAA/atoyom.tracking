const cheerio = require('cheerio');

const LABEL_TRANSLATIONS = {
  '参考号': 'Référence',
  '跟踪号码': 'Numéro de suivi',
  '目的地': 'Destination',
  '当地时间': 'Heure locale',
  '最新状态': 'Dernier statut',
  '收件人': 'Destinataire',
  '运单信息': 'Informations d’expédition',
  '查看附件': 'Pièces jointes',
  '关闭': 'Fermer',
  '查询': 'Rechercher',
  '请输入您的追踪号码': 'Saisissez votre numéro de suivi'
};

const DATE_REGEX = /(\d{2,4}[\/.\-]\d{1,2}[\/.\-]\d{1,2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?)/;

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function translateLabel(label) {
  return LABEL_TRANSLATIONS[cleanText(label)] || cleanText(label);
}

function parseDateCandidate(raw) {
  const value = cleanText(raw).replace(/\./g, '-').replace(/\//g, '-');
  const match = value.match(/(\d{2,4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  let year = Number(match[1]);
  if (year < 100) year += 2000;

  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4] || '0');
  const minute = Number(match[5] || '0');
  const second = Number(match[6] || '0');

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function parseAttachments($, scope) {
  const attachments = [];

  scope.find('[onclick*="selectFile("]').each((_, element) => {
    const onclick = $(element).attr('onclick') || '';
    const match = onclick.match(/selectFile\('([^']+)'\)/);
    if (!match) return;

    const files = match[1]
      .split(';')
      .map((path) => cleanText(path))
      .filter(Boolean);

    attachments.push(...files);
  });

  return Array.from(new Set(attachments));
}

function toEvent(cells) {
  const normalizedCells = cells.map((value) => cleanText(value)).filter(Boolean);
  if (normalizedCells.length < 2) return null;

  const dateCell = normalizedCells.find((value) => DATE_REGEX.test(value));
  if (!dateCell) return null;

  const location = normalizedCells[1] || '';
  const status = normalizedCells.slice(2).join(' - ') || normalizedCells[1] || '';
  const parsedDate = parseDateCandidate(dateCell);

  return {
    date: dateCell,
    location,
    status,
    parsedDate: parsedDate ? parsedDate.toISOString() : null
  };
}

function parseHistoryRows($, scope) {
  const rows = [];

  scope.find('.men_li ul').each((_, ul) => {
    const cells = [];
    $(ul)
      .find('li')
      .each((__, li) => {
        cells.push(cleanText($(li).text()));
      });

    const event = toEvent(cells);
    if (event) rows.push(event);
  });

  if (rows.length === 0) {
    scope.find('table tr').each((_, tr) => {
      const cells = [];
      $(tr)
        .find('th,td')
        .each((__, cell) => {
          cells.push(cleanText($(cell).text()));
        });

      const event = toEvent(cells);
      if (event) rows.push(event);
    });
  }

  return rows;
}

function parseMainInfo($, scope) {
  const headers = [];
  const values = [];

  scope.find('.menu_ ul').each((index, ul) => {
    const row = [];
    $(ul)
      .find('li')
      .each((_, li) => {
        row.push(cleanText($(li).text()));
      });

    if (index === 0) {
      headers.push(...row);
    } else if (row.some(Boolean)) {
      values.push(row);
    }
  });

  return values.map((row) => {
    const mapped = {};
    headers.forEach((header, idx) => {
      mapped[translateLabel(header)] = row[idx] || '';
    });
    return mapped;
  });
}

function sortHistoryNewestFirst(history) {
  return [...history].sort((a, b) => {
    if (!a.parsedDate && !b.parsedDate) return 0;
    if (!a.parsedDate) return 1;
    if (!b.parsedDate) return -1;
    return new Date(b.parsedDate).getTime() - new Date(a.parsedDate).getTime();
  });
}

function parseTrackingHtml(html) {
  const $ = cheerio.load(html);
  const shipments = [];

  $('.div_canta .content .div_con').each((_, container) => {
    const $container = $(container);
    const pageScope = $container.closest('.content');

    const titleText = cleanText($container.find('.div_tb_h .danhao').text());
    const ticketText = cleanText($container.find('.div_tb_h .hd').text());

    const details = parseMainInfo($, $container);
    const history = sortHistoryNewestFirst(parseHistoryRows($, pageScope));
    const attachments = parseAttachments($, pageScope);

    const matchTracking = titleText.match(/【([^】]*)】/);
    const trackingInTitle = matchTracking && matchTracking[1] ? matchTracking[1] : null;
    const latestEvent = history[0] || null;

    if (details.length > 0 || trackingInTitle || history.length > 0) {
      shipments.push({
        sectionTitle: titleText,
        sectionTitleFr: titleText
          .replace('运单信息', 'Informations d’expédition')
          .replace('【】', ''),
        ticket: ticketText,
        trackingInTitle,
        details,
        history,
        latestEvent,
        attachments
      });
    }
  });

  return {
    translations: LABEL_TRANSLATIONS,
    shipments,
    found: shipments.length > 0,
    meta: {
      sourceTitle: cleanText($('title').text()),
      sourceTitleFr: translateLabel($('title').text())
    }
  };
}

module.exports = {
  parseTrackingHtml,
  translateLabel,
  LABEL_TRANSLATIONS
};

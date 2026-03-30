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

function cleanText(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function translateLabel(label) {
  return LABEL_TRANSLATIONS[cleanText(label)] || cleanText(label);
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

function parseHistoryRows($, scope) {
  const rows = [];

  scope.find('.men_li ul').each((_, ul) => {
    const cells = [];
    $(ul)
      .find('li')
      .each((__, li) => {
        cells.push(cleanText($(li).text()));
      });

    if (cells.length >= 3 && !cells.every((cell) => cell === '')) {
      rows.push({
        date: cells[0],
        location: cells[1],
        status: cells.slice(2).join(' - ')
      });
    }
  });

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

function parseTrackingHtml(html) {
  const $ = cheerio.load(html);
  const shipments = [];

  $('.div_canta .content .div_con').each((_, container) => {
    const $container = $(container);
    const titleText = cleanText($container.find('.div_tb_h .danhao').text());
    const ticketText = cleanText($container.find('.div_tb_h .hd').text());

    const details = parseMainInfo($, $container);
    const history = parseHistoryRows($, $container.parent());
    const attachments = parseAttachments($, $container.parent());

    const matchTracking = titleText.match(/【([^】]*)】/);
    const trackingInTitle = matchTracking && matchTracking[1] ? matchTracking[1] : null;

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

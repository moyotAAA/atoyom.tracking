const form = document.getElementById('track-form');
const input = document.getElementById('tracking-input');
const feedback = document.getElementById('feedback');
const results = document.getElementById('results');

function setFeedback(message, type = '') {
  feedback.className = `feedback ${type}`.trim();
  feedback.textContent = message;
}

function renderEmptyState() {
  const tpl = document.getElementById('empty-state-template');
  results.innerHTML = '';
  results.appendChild(tpl.content.cloneNode(true));
}

function renderLoader() {
  results.innerHTML = `
    <div class="card state-card">
      <div class="loader">
        <span>Recherche en cours</span>
        <span class="loader-dot"></span>
        <span class="loader-dot"></span>
        <span class="loader-dot"></span>
      </div>
    </div>
  `;
}

function renderShipments(shipments = []) {
  results.innerHTML = '';

  shipments.forEach((shipment) => {
    const details = shipment.details?.[0] || {};

    const detailsHtml = Object.entries(details)
      .map(([key, value]) => `
        <article class="kv">
          <div class="label">${key}</div>
          <div class="value">${value || '—'}</div>
        </article>
      `)
      .join('');

    const historyHtml = (shipment.history || [])
      .map((step) => `
        <article class="timeline-item">
          <p class="meta">${step.date || 'Date inconnue'} · ${step.location || 'Lieu inconnu'}</p>
          <strong>${step.status || 'Mise à jour non détaillée'}</strong>
        </article>
      `)
      .join('');

    const attachmentHtml = (shipment.attachments || [])
      .map((href, index) => `<a href="${href}" target="_blank" rel="noopener noreferrer">Pièce jointe ${index + 1}</a>`)
      .join('');

    const card = document.createElement('article');
    card.className = 'card shipment-card';
    card.innerHTML = `
      <h2 class="section-title">${shipment.sectionTitleFr || 'Informations d’expédition'}</h2>
      <p class="meta">${shipment.ticket || ''}</p>

      <div class="kv-grid">${detailsHtml || '<p class="meta">Aucun détail exploitable trouvé.</p>'}</div>

      ${(shipment.history || []).length > 0 ? `<div class="timeline">${historyHtml}</div>` : '<p class="meta">Historique non disponible.</p>'}

      ${attachmentHtml ? `<div class="attachments">${attachmentHtml}</div>` : ''}
    `;

    results.appendChild(card);
  });
}

async function onSubmit(event) {
  event.preventDefault();
  const trackingNumber = input.value.trim();

  if (!trackingNumber) {
    setFeedback('Veuillez saisir un numéro de suivi.', 'error');
    return;
  }

  form.querySelector('button').disabled = true;
  setFeedback('');
  renderLoader();

  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingNumber })
    });

    const payload = await response.json();

    if (!response.ok) {
      setFeedback(payload.error || 'Une erreur est survenue.', 'error');
      renderEmptyState();
      return;
    }

    setFeedback(`Résultat trouvé pour ${payload.trackingNumber}.`, 'success');
    renderShipments(payload.data.shipments);
  } catch (error) {
    setFeedback('Le service est temporairement indisponible.', 'error');
    renderEmptyState();
  } finally {
    form.querySelector('button').disabled = false;
  }
}

form.addEventListener('submit', onSubmit);
renderEmptyState();

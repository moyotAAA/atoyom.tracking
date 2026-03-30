const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { parseTrackingHtml } = require('./parser');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const LEGACY_BASE_URL = process.env.LEGACY_BASE_URL || '';
const LEGACY_TRACK_PATH = process.env.LEGACY_TRACK_PATH || '/trackIndex.htm';

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '../../frontend')));

function buildLegacyTrackUrl() {
  if (!LEGACY_BASE_URL) {
    return null;
  }

  return new URL(LEGACY_TRACK_PATH, LEGACY_BASE_URL).toString();
}

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/track', async (req, res) => {
  const trackingNumber = `${req.body.trackingNumber || ''}`.trim();

  if (!trackingNumber) {
    return res.status(400).json({
      error: 'Le numéro de suivi est requis.'
    });
  }

  const trackUrl = buildLegacyTrackUrl();

  if (!trackUrl) {
    return res.status(500).json({
      error: 'Le backend n’est pas configuré. Ajoutez LEGACY_BASE_URL dans votre fichier .env.'
    });
  }

  try {
    const params = new URLSearchParams();
    params.set('documentCode', trackingNumber);

    const legacyResponse = await axios.post(trackUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'text/html,application/xhtml+xml'
      },
      timeout: 15000,
      responseType: 'text',
      maxRedirects: 5
    });

    const parsed = parseTrackingHtml(legacyResponse.data);

    if (!parsed.found) {
      return res.status(404).json({
        error: 'Aucun colis trouvé pour ce numéro.',
        trackingNumber,
        data: parsed
      });
    }

    return res.json({
      trackingNumber,
      data: parsed
    });
  } catch (error) {
    const code = error.code === 'ECONNABORTED' ? 504 : 502;

    return res.status(code).json({
      error: 'Impossible de contacter le site d’origine pour le moment.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Tracking façade disponible sur http://localhost:${PORT}`);
});

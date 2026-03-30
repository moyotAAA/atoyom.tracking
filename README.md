# Façade moderne de suivi colis (FR)

Ce projet fournit une **façade web moderne** (frontend + backend proxy) pour un ancien site de tracking basé sur `trackIndex.htm`.

## Fonctionnalités

- Interface responsive, minimaliste, style premium (inspiration Apple).
- Formulaire de recherche de numéro de suivi.
- Backend Node.js/Express qui agit comme proxy vers le site legacy.
- Parsing HTML (Cheerio) pour extraire les données utiles.
- Traduction des libellés chinois vers le français.
- États UX: vide, chargement, erreur, succès.

## Architecture

- `frontend/`: UI moderne (HTML/CSS/JS)
- `backend/src/server.js`: API interne et proxy legacy
- `backend/src/parser.js`: extraction + normalisation + traduction des données
- `trackIndex.htm`: source legacy fournie et utilisée pour définir les sélecteurs

## Traductions (chinois -> français)

- 轨迹查询 -> Suivi de colis
- 请输入您的追踪号码 -> Saisissez votre numéro de suivi
- 查询 -> Rechercher
- 运单信息 -> Informations d’expédition
- 参考号 -> Référence
- 跟踪号码 -> Numéro de suivi
- 目的地 -> Destination
- 当地时间 -> Heure locale
- 最新状态 -> Dernier statut
- 收件人 -> Destinataire
- 查看附件 -> Pièces jointes
- 关闭 -> Fermer

## Installation

```bash
npm install
cp .env.example .env
```

Renseigner dans `.env`:

- `LEGACY_BASE_URL`: domaine du site d’origine
- `LEGACY_TRACK_PATH`: chemin de la page de recherche (par défaut `/trackIndex.htm`)

## Lancement

```bash
npm run dev
```

Application disponible sur `http://localhost:3000`.

## API interne

### POST `/api/track`

Body JSON:

```json
{
  "trackingNumber": "AB123456789CN"
}
```

Le backend:
1. poste `documentCode` au site legacy,
2. récupère le HTML,
3. parse les sections/détails/historique/pièces jointes,
4. renvoie une réponse JSON exploitable par le frontend.

## Remarques

- Le parsing est conçu pour la structure observée dans `trackIndex.htm` et reste extensible.
- Si le site d’origine est indisponible, l’API renvoie une erreur claire côté frontend.

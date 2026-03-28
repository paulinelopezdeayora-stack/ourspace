const router = require('express').Router();
const r2     = require('../lib/r2');

// GET /api/media/:key  — sert un fichier depuis R2
router.get('/:key', async (req, res) => {
  try {
    const obj    = await r2.getObject(req.params.key);
    // transformToByteArray() est la méthode officielle AWS SDK v3 pour lire le body
    const bytes  = await obj.Body.transformToByteArray();
    const buffer = Buffer.from(bytes);
    res.setHeader('Content-Type',  obj.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (e) {
    console.error('Media R2 error:', e.message);
    res.status(500).send('Erreur : ' + e.message);
  }
});

module.exports = router;

const router = require('express').Router();
const r2     = require('../lib/r2');

// GET /api/media/:key  — sert un fichier depuis R2
router.get('/:key', async (req, res) => {
  try {
    const obj = await r2.getObject(req.params.key);
    // Collecter tous les chunks du web ReadableStream (plus fiable que .pipe())
    const chunks = [];
    for await (const chunk of obj.Body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    res.setHeader('Content-Type',  obj.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(buffer);
  } catch (e) {
    console.error('Media R2 error:', e.message);
    res.status(500).send('Erreur : ' + e.message);
  }
});

module.exports = router;

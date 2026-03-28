const router   = require('express').Router();
const r2       = require('../lib/r2');
const { Readable } = require('stream');

// GET /api/media/:key  — sert un fichier depuis R2
router.get('/:key', async (req, res) => {
  try {
    const obj = await r2.getObject(req.params.key);
    res.setHeader('Content-Type',  obj.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // AWS SDK v3 retourne un web ReadableStream, pas un Node.js stream.
    // Readable.fromWeb() fait la conversion nécessaire pour .pipe()
    Readable.fromWeb(obj.Body).pipe(res);
  } catch (e) {
    console.error('Media R2 error:', e.message);
    res.status(404).send('Not found');
  }
});

module.exports = router;

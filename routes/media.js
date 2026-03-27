const router = require('express').Router();
const r2     = require('../lib/r2');

// GET /api/media/:key  — sert un fichier depuis R2
router.get('/:key', async (req, res) => {
  try {
    const obj = await r2.getObject(req.params.key);
    res.setHeader('Content-Type',  obj.ContentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    obj.Body.pipe(res);
  } catch (e) {
    res.status(404).send('Not found');
  }
});

module.exports = router;

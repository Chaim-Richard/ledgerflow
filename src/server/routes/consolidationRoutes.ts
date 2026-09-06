import express from 'express';

export const consolidationRouter = express.Router();

consolidationRouter.post('/eliminate', async (req, res) => {
  return res.status(501).json({
    error: "Multi-entity consolidation automated elimination is currently undergoing ASC 810 schema certification. Manual journal entries should be used for intercompany eliminations."
  });
});


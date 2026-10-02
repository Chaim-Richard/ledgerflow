import { errorMessage } from '../auth/requestUser';
import express from 'express';
import { FxService } from '../services/FxService';

export const fxRouter = express.Router();

fxRouter.get('/rate', async (req, res) => {
  try {
    const from = (req.query.from as string || 'USD').toUpperCase();
    const to = (req.query.to as string || 'EUR').toUpperCase();
    const rate = await FxService.getRate(from, to);
    res.json({ from, to, rate, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

fxRouter.get('/rates/:base', async (req, res) => {
  try {
    const base = (req.params.base || 'USD').toUpperCase();
    const rates = await FxService.getRatesForBase(base);
    res.json({ base, rates, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: errorMessage(error) });
  }
});

// Vercel function: every /api/* request (see the rewrites in vercel.json) is handled by the
// Express app from server.ts, which `npm run build` bundles into build/server.cjs.
import server from '../build/server.cjs';

let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = server.createApp().catch(err => {
      appPromise = undefined;
      throw err;
    });
  }
  const app = await appPromise;
  return app(req, res);
}

import express from 'express';
import { getAuth } from 'firebase-admin/auth';

const SYSTEM_ADMIN_EMAILS = [
  'shmuelbiller@gmail.com'
];

export const authenticate = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    if (decodedToken.email && SYSTEM_ADMIN_EMAILS.includes(decodedToken.email.trim().toLowerCase())) {
      (decodedToken as any).admin = true;
      (decodedToken as any).role = 'admin';
    }
    (req as any).user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const apiAuthenticate = authenticate;

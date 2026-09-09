import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  let firebaseConfig = {};
  try {
    firebaseConfig = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
  } catch (e) {}
  const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
  if (projectId) {
    admin.initializeApp({ projectId });
  } else {
    admin.initializeApp();
  }
}

const targetUid = process.argv[2];

if (!targetUid) {
  console.error("Usage: node scripts/grant-admin.js <USER_UID_OR_EMAIL>");
  process.exit(1);
}

async function grantAdmin() {
  try {
    let userRecord;
    if (targetUid.includes('@')) {
      userRecord = await admin.auth().getUserByEmail(targetUid);
    } else {
      userRecord = await admin.auth().getUser(targetUid);
    }

    const uid = userRecord.uid;
    console.log(`Granting admin claim and updating role for UID: ${uid} (${userRecord.email || 'no-email'})...`);

    // 1. Set custom user claims
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    // 2. Update users/{uid} document in Firestore
    const db = admin.firestore();
    await db.collection('users').doc(uid).set({
      uid,
      email: userRecord.email || '',
      role: 'admin',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully granted admin claim and updated Firestore profile for ${uid}.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to grant admin claim:", err);
    process.exit(1);
  }
}

grantAdmin();

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
    const db = admin.firestore();
    let uid = targetUid;
    let email = targetUid.includes('@') ? targetUid : '';

    // 1. Try to set custom claims via Auth SDK
    try {
      let userRecord;
      if (targetUid.includes('@')) {
        userRecord = await admin.auth().getUserByEmail(targetUid);
      } else {
        userRecord = await admin.auth().getUser(targetUid);
      }
      uid = userRecord.uid;
      email = userRecord.email || email;
      await admin.auth().setCustomUserClaims(uid, { admin: true, role: 'admin' });
      console.log(`Custom user claims set for UID: ${uid}`);
    } catch (authErr) {
      console.warn(`Auth SDK user lookup/claims skipped (${authErr.message}). Falling back to Firestore...`);
      if (targetUid.includes('@')) {
        const usersSnap = await db.collection('users').where('email', '==', targetUid).limit(1).get();
        if (!usersSnap.empty) {
          uid = usersSnap.docs[0].id;
        }
      }
    }

    console.log(`Granting admin role in Firestore for UID: ${uid} (${email || 'no-email'})...`);

    // 2. Update users/{uid} document in Firestore
    await db.collection('users').doc(uid).set({
      uid,
      email,
      role: 'admin',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // 3. Write to admins/{uid} document
    await db.collection('admins').doc(uid).set({
      uid,
      email,
      isAdmin: true,
      createdAt: new Date().toISOString()
    }, { merge: true });

    console.log(`Successfully granted admin claim and updated Firestore profile for ${uid}.`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to grant admin claim:", err);
    process.exit(1);
  }
}

grantAdmin();

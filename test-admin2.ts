import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
admin.initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ws = await db.collection("workspaces").limit(1).get();
    console.log("Workspaces OK:", ws.size);
  } catch(e: any) {
    console.error("Workspaces Error:", e.message);
  }
  try {
    const usr = await db.collection("users").limit(1).get();
    console.log("Users OK:", usr.size);
  } catch(e: any) {
    console.error("Users Error:", e.message);
  }
}
run();

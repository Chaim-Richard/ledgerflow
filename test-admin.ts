import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
admin.initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const workspaces = await db.collection("workspaces").limit(1).get();
    console.log("Workspaces:", workspaces.size);
    const users = await db.collection("users").limit(1).get();
    console.log("Users:", users.size);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();

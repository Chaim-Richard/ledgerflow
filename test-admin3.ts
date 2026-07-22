import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
admin.initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const ws = await db.collection("workspaces").where("uid", "==", "test").get();
    console.log("Workspaces where OK:", ws.size);
  } catch(e: any) {
    console.error("Workspaces where Error:", e.message);
  }
}
run();

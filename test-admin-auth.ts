import admin from "firebase-admin";
import fs from "fs";

const firebaseConfig = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
admin.initializeApp({ projectId: firebaseConfig.projectId });

async function run() {
  try {
    const users = await admin.auth().listUsers(10);
    console.log("Auth Users OK:", users.users.length);
  } catch(e: any) {
    console.error("Auth Users Error:", e.message);
  }
}
run();

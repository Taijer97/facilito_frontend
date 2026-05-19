import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore";
import config from "./firebase-applet-config.json" assert { type: "json" };

const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  try {
    const q = query(collection(db, 'raffles'), 
      where('status', '==', 'active'), 
      orderBy('endDate', 'asc'),
      limit(1)
    );
    const snap = await getDocs(q);
    console.log("Docs:", snap.docs.length);
  } catch (e) {
    console.error("Error TYPE:", e.name, "CODE:", e.code, "MESSAGE:", e.message);
  }
}
run();
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * MVP NOTE:
 * We are not using Admin SDK credentials or server sessions yet.
 * This is scaffolded for later when you want server-side auth checks.
 */
export function getAdmin() {
  if (!getApps().length) {
    initializeApp();
  }
  return {
    adminAuth: getAuth(),
    adminDb: getFirestore()
  };
}

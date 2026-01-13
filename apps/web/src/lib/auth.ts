import { auth, googleProvider } from "./firebase.client";
import {
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  signOut
} from "firebase/auth";

export async function loginWithGoogle() {
  await signInWithPopup(auth, googleProvider);
}

export async function sendMagicLink(email: string) {
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/auth/finish`;
  await sendSignInLinkToEmail(auth, email, {
    url,
    handleCodeInApp: true
  });
  window.localStorage.setItem("ds_emailForSignIn", email);
}

export async function finishMagicLink() {
  if (!isSignInWithEmailLink(auth, window.location.href)) return false;

  let email = window.localStorage.getItem("ds_emailForSignIn");
  if (!email) {
    email = window.prompt("Confirm your email to finish sign in:") ?? "";
  }
  if (!email) return false;

  await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem("ds_emailForSignIn");
  return true;
}

export async function logout() {
  await signOut(auth);
}

// Firebase のアプリとログインを、記録の保存 (firebase.ts) とたいせん (battle-net.ts) で 1 つずつ共有する。
// どちらも main.ts から「あとで」読みこむので、このファイルも最初の表示では読みこまれない。
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { firebaseConfig, useEmulator } from './config';

let auth: Auth | null = null;

export function firebaseApp(): FirebaseApp {
  if (!firebaseConfig) throw new Error('Firebase の設定がありません');
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export function firebaseAuth(): Auth {
  if (auth) return auth;
  auth = getAuth(firebaseApp());
  if (useEmulator) connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  return auth;
}

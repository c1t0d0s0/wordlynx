// Firebase を使う部分は、このファイルだけにまとめる。
// main.ts から「あとで」読みこむので、Firebase を使わない人の最初の表示はおそくならない。
import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  collection,
  connectFirestoreEmulator,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore/lite';
import {
  APP_ID,
  SCHEMA,
  fromAppDoc,
  fromProgressDoc,
  toAppDoc,
  toProgressDoc,
  type AppDoc,
  type ProgressDoc,
  type Snapshot,
} from '../core/snapshot';
import type { FirebaseConfig } from './config';
import type { AuthPort, Remote } from './sync';

export function createFirebase(config: FirebaseConfig, emulator: boolean): { remote: Remote; auth: AuthPort } {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  // エミュレーターには本物の Google ログインの画面がないので、テストから「だれとしてログインするか」を
  // 指定できるようにする (window.__testUser)。本番のビルドでは emulator が false なので使われない
  const testHooks = window as unknown as { __testUser?: string; __testIdToken?: () => Promise<string | undefined> };
  if (emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    testHooks.__testIdToken = async () => auth.currentUser?.getIdToken();
  }

  // users/{uid}/apps/{appId} と、その下の progress/{itemId}
  const userRef = (uid: string) => doc(db, 'users', uid);
  const appRef = (uid: string) => doc(db, 'users', uid, 'apps', APP_ID);
  const progressCol = (uid: string) => collection(db, 'users', uid, 'apps', APP_ID, 'progress');
  const progressRef = (uid: string, id: string) => doc(db, 'users', uid, 'apps', APP_ID, 'progress', id);

  async function loadSummary(uid: string): Promise<Snapshot | null> {
    const snap = await getDoc(appRef(uid));
    return snap.exists() ? fromAppDoc(snap.data() as Partial<AppDoc>) : null;
  }

  const remote: Remote = {
    loadSummary,
    async loadAll(uid) {
      const [summary, docs] = await Promise.all([loadSummary(uid), getDocs(progressCol(uid))]);
      if (!summary && docs.empty) return null;
      const snapshot = summary ?? fromAppDoc(null);
      docs.forEach((d) => {
        const p = fromProgressDoc(d.data() as Partial<ProgressDoc>);
        if (p) snapshot.progress[d.id] = p;
      });
      return snapshot;
    },
    async saveSummary(uid, snapshot) {
      const now = Date.now();
      // その人の情報 (全アプリ共通)。名前やメールアドレスは入れない
      const user = await getDoc(userRef(uid));
      await setDoc(userRef(uid), { schema: SCHEMA, updatedAt: now, ...(user.exists() ? {} : { createdAt: now }) }, { merge: true });
      await setDoc(appRef(uid), toAppDoc(snapshot, now));
    },
    async saveProgress(uid, id, progress) {
      await setDoc(progressRef(uid, id), toProgressDoc(progress, Date.now()));
    },
    async deleteProgress(uid, id) {
      await deleteDoc(progressRef(uid, id));
    },
  };

  const authPort: AuthPort = {
    onUser(cb) {
      onAuthStateChanged(auth, (user) => cb(user ? user.uid : null));
    },
    async signIn() {
      if (emulator && testHooks.__testUser) {
        const sub = testHooks.__testUser;
        const token = JSON.stringify({ sub, email: `${sub}@example.com`, email_verified: true });
        await signInWithCredential(auth, GoogleAuthProvider.credential(token));
        return;
      }
      await signInWithPopup(auth, new GoogleAuthProvider());
    },
    async signOut() {
      await signOut(auth);
    },
  };

  return { remote, auth: authPort };
}

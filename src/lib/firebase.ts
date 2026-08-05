import { initializeApp, getApps, getApp, deleteApp, FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

/**
 * Konfigurasi Firebase.
 *
 * CATATAN PENTING SOAL "API KEY":
 * apiKey Firebase Web BUKAN rahasia. Ia memang terekspos di bundle browser dan
 * fungsinya hanya sebagai pengenal proyek. Yang benar-benar menjaga data Anda
 * adalah `firestore.rules` + Firebase Authentication -- bukan penyembunyian key.
 *
 * Nilai tetap dibaca dari environment variable agar proyek dev/staging/produksi
 * bisa dipisah, dengan fallback ke konfigurasi produksi HayBike.
 */
const env: any = (import.meta as any).env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyDre88VDh4MOLmSsutQKaX27TehqCQZg_k',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'haybike-apps.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'haybike-apps',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'haybike-apps.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '955945329468',
  appId: env.VITE_FIREBASE_APP_ID || '1:955945329468:web:0a05c045e80758dacb3439'
};

/**
 * Domain sintetis untuk akun yang login memakai username (tanpa email asli).
 * Username "kasir_siti" -> "kasir_siti@haybike.local" di Firebase Auth.
 * Dengan cara ini kasir tetap cukup mengetik username, tapi identitasnya
 * dikelola Firebase Auth, bukan dicocokkan manual di sisi klien.
 */
export const INTERNAL_EMAIL_DOMAIN =
  env.VITE_INTERNAL_EMAIL_DOMAIN || 'haybike.local';

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth: Auth = getAuth(app);
const db = getFirestore(app);

/**
 * Sesi disimpan per-tab dan hilang saat tab ditutup. Untuk komputer kasir yang
 * dipakai bergantian, ini jauh lebih aman daripada persistensi lokal permanen.
 */
setPersistence(auth, browserSessionPersistence).catch((err) => {
  console.warn('Gagal menetapkan persistensi sesi:', err);
});

/**
 * Membuat user baru lewat `createUserWithEmailAndPassword` pada app utama akan
 * MENGGANTI sesi yang sedang aktif -- artinya admin otomatis terlempar keluar
 * setiap kali membuat akun kasir. Solusinya: pakai instance Firebase kedua
 * yang sesinya dibuang setelah selesai.
 */
export async function withSecondaryAuth<T>(
  fn: (secondaryAuth: Auth) => Promise<T>
): Promise<T> {
  const name = `haybike-provisioning-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, name);
  const secondaryAuth = getAuth(secondaryApp);
  try {
    return await fn(secondaryAuth);
  } finally {
    try {
      await secondaryAuth.signOut();
    } catch {
      /* diabaikan: sesi sementara */
    }
    try {
      await deleteApp(secondaryApp);
    } catch {
      /* diabaikan: instance sementara */
    }
  }
}

export { app, auth, db };

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  writeBatch,
  increment
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  EmailAuthProvider,
  User
} from 'firebase/auth';
import { db, auth, withSecondaryAuth, INTERNAL_EMAIL_DOMAIN } from '../lib/firebase';
import {
  Account,
  Product,
  CartItem,
  SaleTransaction,
  JournalEntry,
  PiutangItem,
  PiutangBayar,
  UtangItem,
  UtangBayar,
  UtangBankItem,
  UtangBankBayarItem,
  MutasiKasBank,
  StockOpnameItem,
  JurnalPenyesuaianItem,
  DashboardData,
  LaporanLabaRugi,
  LapKeuanganFull,
  KartuStokItem,
  BukuBesarItem,
  PaymentMethod,
  AppSettings,
  UserAccount
} from '../types';
import { INITIAL_ACCOUNTS, INITIAL_PRODUCTS } from './initialData';

export const DEFAULT_SETTINGS: AppSettings = {
  namaToko: 'TOKO HAYBIKE',
  alamatToko: 'Jalan Raya Cikijing-Talaga No 17',
  kotaToko: 'Talaga Wetan, Majalengka',
  teleponToko: '0813-1351-8416',
  emailToko: 'haybikeapps@gmail.com',
  headerStruk: 'Bengkel & Toko Sepeda Professional',
  footerMessage: 'Barang yang sudah dibeli tidak dapat dikembalikan',
  footerGreeting: 'Hatur Nuhun - Salam Gowes',
  showKasirName: true,
  thermalWidth: '58mm',
  autoPrintReceipt: false,
  logoUrl: '/logo-struk.png'
};

// Helper to format date YYYY-MM-DD
export function formatISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper to format date DD/MM/YYYY
export function fmtD(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return String(d);
  return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

/**
 * Ubah "YYYY-MM-DD" menjadi Date pada zona waktu LOKAL.
 *
 * `new Date('2026-07-29')` ditafsirkan sebagai tengah malam UTC, sementara
 * batas periode dibentuk memakai jam lokal. Percampuran keduanya membuat
 * laporan meleset satu hari di sebagian zona waktu. Semua perbandingan
 * tanggal kini melewati fungsi ini agar konsisten.
 */
export function parseLocalDate(v: any): Date {
  if (v instanceof Date) return v;
  if (v && typeof v === 'object') {
    if (typeof v.toDate === 'function') return v.toDate();
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000);
  }
  const str = String(v || '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const fallback = new Date(v);
  return isNaN(fallback.getTime()) ? new Date(0) : fallback;
}

export function formatRupiah(num: number): string {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

export function calculateEstimatedPrice(modal: number): number {
  const m = parseInt(String(modal)) || 0;
  if (m < 120000) return Math.round(m * 1.3);
  if (m < 350000) return Math.round((m + 100000) * 1.21);
  if (m < 600000) return Math.round((m + 140000) * 1.21);
  return Math.round((m + 180000) * 1.21);
}

// ==================== SEEDING / INITIALIZATION ====================
export async function initializeDatabase() {
  await ensureAuth();
  // Check Settings
  try {
    const settingsRef = doc(db, 'settings', 'config');
    const settingsSnap = await getDoc(settingsRef);
    if (!settingsSnap.exists()) {
      await setDoc(settingsRef, DEFAULT_SETTINGS);
    } else {
      // Merge missing defaults if any
      const curData = settingsSnap.data();
      const updated = { ...DEFAULT_SETTINGS, ...curData };
      if (Object.keys(updated).length !== Object.keys(curData).length) {
        await setDoc(settingsRef, updated, { merge: true });
      }
    }
  } catch (err) {
    console.warn('Settings initialization skipped or restricted:', err);
  }

  // Check Accounts
  try {
    const accSnap = await getDocs(collection(db, 'accounts'));
    if (accSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_ACCOUNTS.forEach((acc) => {
        const docRef = doc(collection(db, 'accounts'));
        batch.set(docRef, acc);
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Accounts initialization skipped or restricted:', err);
  }

  // Check Products
  try {
    const prodSnap = await getDocs(collection(db, 'products'));
    if (prodSnap.empty) {
      const batch = writeBatch(db);
      INITIAL_PRODUCTS.forEach((prod) => {
        const docRef = doc(collection(db, 'products'));
        batch.set(docRef, { ...prod, updatedAt: serverTimestamp() });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn('Products initialization skipped or restricted:', err);
  }
}

// ==================== APP SETTINGS ====================
export async function getAppSettings(): Promise<AppSettings> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'config'));
    if (snap.exists()) {
      return { ...DEFAULT_SETTINGS, ...snap.data() } as AppSettings;
    }
  } catch (e) {
    console.error('Error fetching app settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function subscribeSettings(callback: (settings: AppSettings) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(doc(db, 'settings', 'config'), (snap) => {
      if (snap.exists()) {
        callback({ ...DEFAULT_SETTINGS, ...snap.data() } as AppSettings);
      } else {
        callback(DEFAULT_SETTINGS);
      }
    }, (err) => {
      console.warn('subscribeSettings listener warning:', err);
      callback(DEFAULT_SETTINGS);
    });
  });
  return () => {
    if (unsub) unsub();
  };
}

export async function saveAppSettings(newSettings: Partial<AppSettings>): Promise<{ ok: boolean; msg?: string }> {
  try {
    const settingsRef = doc(db, 'settings', 'config');
    await setDoc(settingsRef, newSettings, { merge: true });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, msg: e.message || 'Gagal menyimpan pengaturan' };
  }
}

export async function getRecentSales(limitCount = 300): Promise<any[]> {
  try {
    const snap = await getDocs(collection(db, 'transactions'));
    const list: any[] = [];
    snap.forEach((d) => {
      const data = d.data();
      let items = [];
      try {
        if (data.itemsJson) items = JSON.parse(data.itemsJson);
      } catch (e) {}

      let tglStr = '';
      if (data.tanggal) {
        if (typeof data.tanggal === 'string') {
          tglStr = data.tanggal;
        } else if (data.tanggal?.toDate) {
          tglStr = formatISO(data.tanggal.toDate());
        } else if (data.tanggal?.seconds) {
          tglStr = formatISO(new Date(data.tanggal.seconds * 1000));
        }
      } else if (data.createdAt) {
        if (data.createdAt?.toDate) {
          tglStr = formatISO(data.createdAt.toDate());
        } else if (data.createdAt?.seconds) {
          tglStr = formatISO(new Date(data.createdAt.seconds * 1000));
        }
      }

      list.push({
        id: data.id || d.id,
        tanggal: tglStr || formatISO(new Date()),
        tipe: data.tipe || 'Penjualan Barang',
        total: Number(data.total) || 0,
        metode: data.metode || 'Kas',
        status: data.status || 'Lunas',
        namaPembeli: data.namaPembeli || '',
        kontakPembeli: data.kontakPembeli || '',
        kasirName: data.kasirName || '',
        shiftId: data.shiftId || '',
        items,
        namaJasa: data.namaJasa || '',
        createdAt: data.createdAt
      });
    });
    // Sort descending by date or id
    return list
      .sort((a, b) => {
        const tA = String(a.tanggal || '');
        const tB = String(b.tanggal || '');
        if (tA !== tB) return tB.localeCompare(tA);
        return String(b.id || '').localeCompare(String(a.id || ''));
      })
      .slice(0, limitCount);
  } catch (e) {
    console.error('Error fetching recent sales:', e);
    return [];
  }
}

export function subscribeRecentSales(callback: (sales: any[]) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(collection(db, 'transactions'), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        const data = d.data();
        let items = [];
        try {
          if (data.itemsJson) items = JSON.parse(data.itemsJson);
        } catch (e) {}

        let tglStr = '';
        if (data.tanggal) {
          if (typeof data.tanggal === 'string') {
            tglStr = data.tanggal;
          } else if (data.tanggal?.toDate) {
            tglStr = formatISO(data.tanggal.toDate());
          } else if (data.tanggal?.seconds) {
            tglStr = formatISO(new Date(data.tanggal.seconds * 1000));
          }
        } else if (data.createdAt) {
          if (data.createdAt?.toDate) {
            tglStr = formatISO(data.createdAt.toDate());
          } else if (data.createdAt?.seconds) {
            tglStr = formatISO(new Date(data.createdAt.seconds * 1000));
          }
        }

        list.push({
          id: data.id || d.id,
          tanggal: tglStr || formatISO(new Date()),
          tipe: data.tipe || 'Penjualan Barang',
          total: Number(data.total) || 0,
          metode: data.metode || 'Kas',
          status: data.status || 'Lunas',
          namaPembeli: data.namaPembeli || '',
          kontakPembeli: data.kontakPembeli || '',
          kasirName: data.kasirName || '',
          shiftId: data.shiftId || '',
          items,
          namaJasa: data.namaJasa || '',
          createdAt: data.createdAt
        });
      });

      const sorted = list.sort((a, b) => {
        const tA = String(a.tanggal || '');
        const tB = String(b.tanggal || '');
        if (tA !== tB) return tB.localeCompare(tA);
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      callback(sorted);
    }, (err) => {
      console.warn('subscribeRecentSales listener warning:', err);
      callback([]);
    });
  }).catch((err) => {
    console.warn('ensureAuth error in subscribeRecentSales:', err);
    callback([]);
  });
  return () => {
    if (unsub) unsub();
  };
}

export async function deleteTransaction(trxId: string): Promise<{ ok: boolean; msg?: string }> {
  try {
    await ensureAuth();
    const qTrx = query(collection(db, 'transactions'), where('id', '==', trxId));
    const snap = await getDocs(qTrx);
    if (snap.empty) {
      return { ok: false, msg: `Transaksi [${trxId}] tidak ditemukan!` };
    }

    let trxDocId = '';
    let trxData: any = null;
    snap.forEach((d) => {
      trxDocId = d.id;
      trxData = d.data();
    });

    if (!trxData) {
      return { ok: false, msg: 'Data transaksi tidak valid' };
    }

    // If Penjualan Barang, restore product stock
    if (trxData.tipe === 'Penjualan Barang' && trxData.itemsJson) {
      try {
        let items: any[] = typeof trxData.itemsJson === 'string' ? JSON.parse(trxData.itemsJson) : trxData.itemsJson;
        if (Array.isArray(items)) {
          const prodSnap = await getDocs(collection(db, 'products'));
          const dbProds: (Product & { docId: string })[] = [];
          prodSnap.forEach((p) => dbProds.push({ docId: p.id, ...(p.data() as Product) }));

          for (const item of items) {
            if (item.kode && item.qty) {
              const found = dbProds.find((p) => p.kode === item.kode);
              if (found) {
                await updateDoc(doc(db, 'products', found.docId), {
                  stok: (found.stok || 0) + Number(item.qty),
                  updatedAt: serverTimestamp()
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('Error restoring stock on deleteTransaction:', err);
      }
    }

    // Delete matching journal entries
    const journalSnap = await getDocs(query(collection(db, 'journals'), where('bukti', '==', trxId)));
    journalSnap.forEach(async (jd) => {
      await deleteDoc(doc(db, 'journals', jd.id));
    });

    // Delete matching piutang entry if any
    const piutangSnap = await getDocs(query(collection(db, 'piutang'), where('id', '==', trxId)));
    piutangSnap.forEach(async (pd) => {
      await deleteDoc(doc(db, 'piutang', pd.id));
    });

    // Delete transaction doc
    await deleteDoc(doc(db, 'transactions', trxDocId));

    return { ok: true };
  } catch (err: any) {
    console.error('Error in deleteTransaction:', err);
    return { ok: false, msg: err.message || 'Gagal menghapus transaksi' };
  }
}

// ==================== AUTH & IDENTITAS ====================
//
// ARSITEKTUR BARU (menggantikan pencocokan password di sisi klien):
//   * Identitas    -> Firebase Authentication (Email/Password).
//   * Otorisasi    -> dokumen /users/{uid} berisi role + status.
//   * Penegakannya -> firestore.rules, bukan kode React.
//
// Password TIDAK PERNAH lagi disimpan di Firestore dan tidak pernah dikirim
// ke browser. Yang disimpan hanya profil (nama, username, role, status).

/** Ubah "kasir_siti" menjadi email internal, biarkan email asli apa adanya. */
export function toAuthEmail(identifier: string): string {
  const clean = String(identifier || '').trim().toLowerCase();
  if (clean.includes('@')) return clean;
  const safe = clean.replace(/[^a-z0-9._-]/g, '_');
  return `${safe}@${INTERNAL_EMAIL_DOMAIN}`;
}

/** True bila email tersebut email sintetis internal (tak bisa dikirimi surel). */
export function isInternalEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${INTERNAL_EMAIL_DOMAIN}`);
}

/**
 * Menunggu Firebase memulihkan sesi yang tersimpan.
 *
 * Versi lama memanggil `signInAnonymously()` di sini -- itulah akar masalahnya:
 * setiap pengunjung, termasuk yang belum login, langsung mendapat kredensial
 * yang sah sehingga aturan Firestore mana pun jadi tak ada artinya.
 * Sekarang fungsi ini hanya MENUNGGU, tidak pernah membuat sesi baru.
 */
export async function ensureAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  return new Promise<User | null>((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

function mapProfile(uid: string, data: any): UserAccount {
  return {
    id: uid,
    username: data.username || '',
    email: data.email || '',
    name: data.name || data.username || 'Pengguna',
    role: data.role === 'admin' ? 'admin' : 'kasir',
    status: data.status === 'nonactive' ? 'nonactive' : 'active',
    createdAt: data.createdAt || '',
    updatedAt: data.updatedAt || '',
    lastLoginAt: data.lastLoginAt || ''
  };
}

/** Ambil profil (role & status) milik UID tertentu. */
export async function getUserProfile(uid: string): Promise<UserAccount | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) return null;
    return mapProfile(snap.id, snap.data());
  } catch (e) {
    console.error('getUserProfile error:', e);
    return null;
  }
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Pantau profil pengguna yang sedang login secara real-time.
 * Efeknya: begitu admin menonaktifkan sebuah akun atau menurunkan rolenya,
 * sesi yang sedang berjalan langsung ikut menyesuaikan tanpa perlu login ulang.
 */
export function subscribeCurrentProfile(
  uid: string,
  callback: (profile: UserAccount | null) => void
) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => callback(snap.exists() ? mapProfile(snap.id, snap.data()) : null),
    (err) => {
      console.warn('subscribeCurrentProfile warning:', err);
      callback(null);
    }
  );
}

function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      // Sengaja disamakan: jangan beri tahu penyerang akun mana yang ada.
      return 'Email / Username atau Password salah.';
    case 'auth/invalid-email':
      return 'Format Email / Username tidak valid.';
    case 'auth/user-disabled':
      return 'Akun ini dinonaktifkan. Hubungi Admin toko.';
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan gagal. Tunggu beberapa menit lalu coba lagi.';
    case 'auth/network-request-failed':
      return 'Koneksi internet bermasalah. Periksa jaringan Anda.';
    case 'auth/operation-not-allowed':
      return 'Metode login Email/Password belum diaktifkan di Firebase Console.';
    case 'auth/email-already-in-use':
      return 'Username / Email tersebut sudah dipakai akun lain.';
    case 'auth/weak-password':
      return 'Password terlalu lemah. Gunakan minimal 8 karakter.';
    default:
      return 'Gagal memproses permintaan. Silakan coba lagi.';
  }
}

/**
 * Login utama. Menerima email asli maupun username.
 * Alur: Firebase Auth -> baca profil -> verifikasi status aktif.
 */
export async function loginUserByEmailOrUsername(
  identifier: string,
  pass: string
): Promise<{ ok: boolean; role?: 'admin' | 'kasir'; name?: string; uid?: string; msg?: string }> {
  const email = toAuthEmail(identifier);

  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, email, pass);
  } catch (err: any) {
    return { ok: false, msg: authErrorMessage(err?.code || '') };
  }

  const uid = cred.user.uid;
  const profile = await getUserProfile(uid);

  // Punya kredensial Auth tapi tak punya profil = belum didaftarkan admin.
  if (!profile) {
    await signOut(auth).catch(() => {});
    return {
      ok: false,
      msg: 'Akun terdaftar di Firebase, tetapi belum diberi hak akses. Hubungi Admin toko.'
    };
  }

  if (profile.status !== 'active') {
    await signOut(auth).catch(() => {});
    return { ok: false, msg: `Akun "${profile.name}" sedang dinonaktifkan. Hubungi Admin toko.` };
  }

  // Catatan jejak login (best-effort, kegagalan tidak memblokir login).
  updateDoc(doc(db, 'users', uid), { lastLoginAt: new Date().toISOString() }).catch(() => {});

  return { ok: true, role: profile.role, name: profile.name, uid };
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (e) {
    console.error('Logout error:', e);
  }
}

/** Ganti password sendiri. Wajib memasukkan password lama (re-autentikasi). */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; msg?: string }> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    return { ok: false, msg: 'Sesi tidak ditemukan. Silakan login ulang.' };
  }
  if (!newPassword || newPassword.length < 8) {
    return { ok: false, msg: 'Password baru minimal 8 karakter.' };
  }
  try {
    await reauthenticateWithCredential(
      user,
      EmailAuthProvider.credential(user.email, currentPassword)
    );
    await updatePassword(user, newPassword);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: authErrorMessage(err?.code || '') };
  }
}

/** Kirim tautan reset password (hanya untuk akun dengan email asli). */
export async function sendResetPasswordEmail(
  identifier: string
): Promise<{ ok: boolean; msg?: string }> {
  const email = toAuthEmail(identifier);
  if (isInternalEmail(email)) {
    return {
      ok: false,
      msg: 'Akun berbasis username tidak punya alamat surel. Minta Admin toko mengatur ulang passwordnya.'
    };
  }
  try {
    await sendPasswordResetEmail(auth, email);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: authErrorMessage(err?.code || '') };
  }
}

// ==================== MANAJEMEN AKUN (KHUSUS ADMIN) ====================

export async function getUserAccounts(): Promise<UserAccount[]> {
  try {
    const snap = await getDocs(collection(db, 'users'));
    const list: UserAccount[] = [];
    snap.forEach((d) => list.push(mapProfile(d.id, d.data())));
    return list.sort((a, b) => a.name.localeCompare(b.name));
  } catch (e) {
    console.error('getUserAccounts error:', e);
    return [];
  }
}

export function subscribeUserAccounts(callback: (users: UserAccount[]) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list: UserAccount[] = [];
        snap.forEach((d) => list.push(mapProfile(d.id, d.data())));
        callback(list.sort((a, b) => a.name.localeCompare(b.name)));
      },
      (err) => {
        console.error('subscribeUserAccounts error:', err);
        callback([]);
      }
    );
  });
  return () => {
    if (unsub) unsub();
  };
}

export interface NewUserInput {
  name: string;
  username: string;
  email?: string;
  password: string;
  role: 'admin' | 'kasir';
  status: 'active' | 'nonactive';
}

/**
 * Buat akun baru: kredensial di Firebase Auth + profil di Firestore.
 *
 * Pembuatan user dilakukan lewat instance Firebase kedua supaya sesi admin
 * yang sedang berjalan tidak ikut tergantikan (perilaku bawaan Firebase Web SDK).
 */
export async function createUserAccount(
  data: NewUserInput
): Promise<{ ok: boolean; msg?: string; id?: string }> {
  const username = String(data.username || '').trim().toLowerCase();
  const name = String(data.name || '').trim();
  const realEmail = String(data.email || '').trim().toLowerCase();

  if (!name) return { ok: false, msg: 'Nama lengkap wajib diisi.' };
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return {
      ok: false,
      msg: 'Username minimal 3 karakter, hanya huruf kecil, angka, titik, garis bawah, atau strip.'
    };
  }
  if (!data.password || data.password.length < 8) {
    return { ok: false, msg: 'Password minimal 8 karakter.' };
  }

  const existing = await getUserAccounts();
  if (existing.some((u) => u.username === username)) {
    return { ok: false, msg: `Username "${username}" sudah digunakan.` };
  }
  if (realEmail && existing.some((u) => u.email?.toLowerCase() === realEmail)) {
    return { ok: false, msg: `Email "${realEmail}" sudah digunakan.` };
  }

  const loginEmail = realEmail || toAuthEmail(username);

  try {
    const uid = await withSecondaryAuth(async (secondaryAuth) => {
      const cred = await createUserWithEmailAndPassword(
        secondaryAuth,
        loginEmail,
        data.password
      );
      return cred.user.uid;
    });

    // Ditulis lewat app utama, jadi rule `isAdmin()` dievaluasi atas sesi admin.
    await setDoc(doc(db, 'users', uid), {
      username,
      email: loginEmail,
      name,
      role: data.role === 'admin' ? 'admin' : 'kasir',
      status: data.status === 'nonactive' ? 'nonactive' : 'active',
      createdAt: formatISO(new Date()),
      updatedAt: formatISO(new Date())
    });

    return { ok: true, id: uid };
  } catch (err: any) {
    console.error('createUserAccount error:', err);
    return { ok: false, msg: authErrorMessage(err?.code || '') };
  }
}

/**
 * Perbarui profil. Password TIDAK bisa diubah dari sini: mengganti password
 * pengguna lain memerlukan Firebase Admin SDK (server), bukan SDK browser.
 */
export async function updateUserAccount(
  id: string,
  data: Partial<Pick<UserAccount, 'name' | 'username' | 'email' | 'role' | 'status'>>
): Promise<{ ok: boolean; msg?: string }> {
  try {
    const payload: any = { updatedAt: formatISO(new Date()) };
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.username !== undefined) payload.username = data.username.trim().toLowerCase();
    if (data.email !== undefined) payload.email = data.email.trim().toLowerCase();
    if (data.role !== undefined) payload.role = data.role;
    if (data.status !== undefined) payload.status = data.status;

    await updateDoc(doc(db, 'users', id), payload);
    return { ok: true };
  } catch (err: any) {
    console.error('updateUserAccount error:', err);
    return { ok: false, msg: 'Gagal memperbarui akun. Pastikan Anda login sebagai Admin.' };
  }
}

/**
 * Cabut akses sebuah akun.
 *
 * Menghapus dokumen profil sudah cukup untuk memutus seluruh akses, karena
 * `firestore.rules` mensyaratkan adanya profil aktif. Kredensial Firebase Auth
 * miliknya tetap ada (penghapusannya butuh Admin SDK), tetapi tanpa profil
 * kredensial itu tidak bisa membaca atau menulis apa pun.
 */
export async function deleteUserAccount(id: string): Promise<{ ok: boolean; msg?: string }> {
  try {
    if (auth.currentUser?.uid === id) {
      return { ok: false, msg: 'Anda tidak dapat menghapus akun yang sedang Anda pakai.' };
    }
    await deleteDoc(doc(db, 'users', id));
    return { ok: true };
  } catch (err: any) {
    console.error('deleteUserAccount error:', err);
    return { ok: false, msg: 'Gagal menghapus akun. Pastikan Anda login sebagai Admin.' };
  }
}

// ==================== ACCOUNTS ====================
export async function getAccounts(): Promise<Account[]> {
  try {
    const snap = await getDocs(collection(db, 'accounts'));
    if (snap.empty) return INITIAL_ACCOUNTS;
    const list: Account[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as Account);
    });
    return list;
  } catch (e) {
    return INITIAL_ACCOUNTS;
  }
}

export function subscribeAccounts(callback: (accounts: Account[]) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(collection(db, 'accounts'), (snap) => {
      const list: Account[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Account));
      callback(list.length ? list : INITIAL_ACCOUNTS);
    }, (err) => {
      console.warn('subscribeAccounts listener warning:', err);
      callback(INITIAL_ACCOUNTS);
    });
  });
  return () => {
    if (unsub) unsub();
  };
}

export async function addAccount(acc: Omit<Account, 'id'>) {
  const ref = await addDoc(collection(db, 'accounts'), acc);
  return { ok: true, id: ref.id };
}

export async function updateAccount(id: string, acc: Partial<Account>) {
  await updateDoc(doc(db, 'accounts', id), acc);
  return { ok: true };
}

export async function deleteAccount(id: string) {
  await deleteDoc(doc(db, 'accounts', id));
  return { ok: true };
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const acc = await getAccounts();
  const m: PaymentMethod[] = [{ val: 'Kas', label: 'Kas (Tunai)' }];
  for (let i = 0; i < acc.length; i++) {
    if (acc[i].kelompok === 'Aset' && acc[i].nama.toUpperCase().includes('BANK')) {
      m.push({ val: acc[i].nama, label: acc[i].nama });
    }
  }
  m.push({ val: 'Utang', label: 'Utang (Piutang Usaha)' });
  return m;
}

export function subscribePaymentMethods(callback: (methods: PaymentMethod[]) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(collection(db, 'accounts'), async () => {
      const methods = await getPaymentMethods();
      callback(methods);
    }, (err) => {
      console.warn('subscribePaymentMethods listener warning:', err);
    });
  });
  return () => {
    if (unsub) unsub();
  };
}

export const initializeInitialData = initializeDatabase;

export async function savePembayaranPiutang(id: string, bayar: number, metode: string, tanggal?: string) {
  return payPiutangAngsur(JSON.stringify({ id, bayar, metode, tanggal }));
}

export async function savePembayaranUtang(id: string, bayar: number, metode: string, tanggal?: string) {
  return payUtangAngsur(JSON.stringify({ id, bayar, metode, tanggal }));
}

export async function getAkunDebitPenerimaan() {
  const acc = await getAccounts();
  const r: string[] = [];
  for (let i = 0; i < acc.length; i++) {
    const n = acc[i].nama.toUpperCase();
    if (acc[i].kelompok === 'Aset' && (n === 'KAS' || n.includes('BANK'))) {
      r.push(acc[i].nama);
    }
  }
  if (r.length === 0) r.push('KAS', 'BANK BRI');
  return r;
}

export async function getAkunKreditPenerimaan() {
  const acc = await getAccounts();
  const r: string[] = [];
  for (let i = 0; i < acc.length; i++) {
    const k = acc[i].kelompok;
    const kat = acc[i].kategori || '';
    const n = acc[i].nama.toUpperCase();
    if (k === 'Pendapatan' && kat !== 'Kontra Pendapatan') r.push(acc[i].nama);
    if (k === 'Modal' && kat !== 'Prive') r.push(acc[i].nama);
    if (k === 'Kewajiban') r.push(acc[i].nama);
    if (n === 'PIUTANG USAHA') r.push(acc[i].nama);
  }
  if (!r.includes('PENDAPATAN JASA')) r.unshift('PENDAPATAN JASA');
  if (!r.includes('PIUTANG USAHA')) r.push('PIUTANG USAHA');
  return r;
}

export async function getAkunDebitPengeluaran() {
  const acc = await getAccounts();
  const r: string[] = [];
  for (let i = 0; i < acc.length; i++) {
    const k = acc[i].kelompok;
    const kat = acc[i].kategori || '';
    const n = acc[i].nama.toUpperCase();
    if (k === 'Beban') r.push(acc[i].nama);
    if (k === 'HPP') r.push(acc[i].nama);
    if (k === 'Kewajiban') r.push(acc[i].nama);
    if (kat === 'Prive') r.push(acc[i].nama);
    if (k === 'Aset' && kat === 'Aset Tetap') r.push(acc[i].nama);
    if (k === 'Aset' && kat === 'Aset Lancar' && n.includes('PERSEDIAAN')) r.push(acc[i].nama);
  }
  if (!r.includes('BEBAN LISTRIK')) r.unshift('BEBAN LISTRIK');
  if (!r.includes('BEBAN GAJI KARYAWAN')) r.unshift('BEBAN GAJI KARYAWAN');
  if (!r.includes('UTANG USAHA')) r.push('UTANG USAHA');
  if (!r.includes('PRIVE')) r.push('PRIVE');
  return r;
}

export async function getAkunKreditPengeluaran() {
  const acc = await getAccounts();
  const r: string[] = [];
  for (let i = 0; i < acc.length; i++) {
    const k = acc[i].kelompok;
    const n = acc[i].nama.toUpperCase();
    if (k === 'Aset' && (n === 'KAS' || n.includes('BANK'))) {
      r.push(acc[i].nama);
    }
  }
  if (r.length === 0) r.push('KAS', 'BANK BRI');
  return r;
}

// ==================== PRODUCTS / MASTER BARANG ====================
export async function getProducts(cat?: string): Promise<Product[]> {
  const snap = await getDocs(collection(db, 'products'));
  const r: Product[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as Product;
    if (!cat || d.kategori === cat) {
      r.push({ id: doc.id, ...d });
    }
  });
  return r;
}

export function subscribeProducts(callback: (products: Product[]) => void) {
  let unsub: (() => void) | null = null;
  ensureAuth().then(() => {
    unsub = onSnapshot(collection(db, 'products'), (snap) => {
      const list: Product[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as Product));
      callback(list);
    }, (err) => {
      console.warn('subscribeProducts listener warning:', err);
    });
  });
  return () => {
    if (unsub) unsub();
  };
}

export async function updateProductDirect(kode: string, updates: Partial<Product>): Promise<{ ok: boolean; msg?: string }> {
  try {
    const snap = await getDocs(query(collection(db, 'products'), where('kode', '==', kode)));
    if (snap.empty) {
      return { ok: false, msg: `Barang dengan kode ${kode} tidak ditemukan!` };
    }
    let targetDocId = '';
    snap.forEach((d) => { targetDocId = d.id; });
    await updateDoc(doc(db, 'products', targetDocId), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: err.message || 'Gagal mengubah data barang' };
  }
}

export async function deleteProductDirect(kode: string): Promise<{ ok: boolean; msg?: string }> {
  try {
    const snap = await getDocs(query(collection(db, 'products'), where('kode', '==', kode)));
    if (snap.empty) {
      return { ok: false, msg: `Barang dengan kode ${kode} tidak ditemukan!` };
    }
    let targetDocId = '';
    snap.forEach((d) => { targetDocId = d.id; });
    await deleteDoc(doc(db, 'products', targetDocId));
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: err.message || 'Gagal menghapus barang' };
  }
}

// RESTOCK TUNAI
export async function saveStockPurchase(dataStr: string): Promise<{ ok: boolean; msg?: string }> {
  await ensureAuth();
  try {
    const data = JSON.parse(dataStr);
    const items = data.items as CartItem[];
    const katTotals: Record<string, number> = {};

    const snap = await getDocs(collection(db, 'products'));
    const existingProds: (Product & { docId: string })[] = [];
    snap.forEach((d) => existingProds.push({ docId: d.id, ...(d.data() as Product) }));

    // Semua tulisan (update stok, jurnal) digabung dalam satu batch supaya
    // atomik: kalau salah satu ditolak oleh aturan keamanan Firestore, TIDAK
    // ADA yang tersimpan sebagian (mis. stok sudah naik tapi jurnal gagal).
    const batch = writeBatch(db);

    for (const it of items) {
      const found = existingProds.find((p) => p.kode === it.kode);
      if (found) {
        const oldQty = Number(found.stok) || 0;
        const oldModal = Number(found.modal) || 0;
        const newQty = it.qty;
        const newModal = it.modal;

        const totalQtyNow = oldQty + newQty;
        let newAvg = 0;
        if (totalQtyNow > 0) {
          newAvg = Math.round((oldQty * oldModal + newQty * newModal) / totalQtyNow);
        }

        batch.update(doc(db, 'products', found.docId), {
          stok: totalQtyNow,
          modal: newModal > 0 ? newAvg : oldModal,
          jual: it.jual > 0 ? it.jual : found.jual,
          updatedAt: serverTimestamp()
        });

        const akunPers = getPersAkun(it.kategori);
        katTotals[akunPers] =
          (katTotals[akunPers] || 0) + newQty * (newModal > 0 ? newModal : oldModal);
      } else {
        batch.set(doc(collection(db, 'products')), {
          kode: it.kode,
          nama: it.nama,
          kategori: it.kategori,
          satuan: it.satuan || 'pcs',
          modal: it.modal,
          jual: it.jual,
          stok: it.qty,
          updatedAt: serverTimestamp()
        });

        const akunPersBaru = getPersAkun(it.kategori);
        katTotals[akunPersBaru] = (katTotals[akunPersBaru] || 0) + it.qty * it.modal;
      }
    }

    const kNama = data.metode === 'Kas' ? 'KAS' : data.metode;
    for (const k in katTotals) {
      const pNama = k;
      batch.set(doc(collection(db, 'journals')), {
        tanggal: data.tanggal,
        bukti: 'STK' + Date.now(),
        debit: pNama,
        kredit: kNama,
        ket: 'Beli Stok ' + k,
        nominal: katTotals[k],
        createdAt: serverTimestamp()
      });
    }

    await batch.commit();
    return { ok: true };
  } catch (e: any) {
    console.error('saveStockPurchase error:', e);
    return { ok: false, msg: e.message || 'Gagal menyimpan pembelian stok' };
  }
}

// RESTOCK UTANG (SUPPLIER)
export async function saveStockPurchaseUtang(dataStr: string): Promise<{ ok: boolean; msg?: string; id?: string }> {
  await ensureAuth();
  try {
    const data = JSON.parse(dataStr);
    const items = data.items as CartItem[];
    let total = 0;

    const blacklistWords = ['supplier', 'supplier 1', 'supplier 2', 'supplier 3', 'supplier 4', 'nama supplier', 'terlaksana', 'planet baik'];
    for (let i = 0; i < items.length; i++) {
      const namaLower = String(items[i].nama).toLowerCase().trim();
      for (let b = 0; b < blacklistWords.length; b++) {
        if (namaLower === blacklistWords[b]) return { ok: false, msg: `Nama barang "${items[i].nama}" tidak valid!` };
      }
      if (!items[i].nama || items[i].nama.length < 2) return { ok: false, msg: 'Nama barang tidak valid!' };
    }

    const katTotals: Record<string, number> = {};
    const snap = await getDocs(collection(db, 'products'));
    const existingProds: (Product & { docId: string })[] = [];
    snap.forEach((d) => existingProds.push({ docId: d.id, ...(d.data() as Product) }));

    // Semua tulisan (stok, jurnal, DAN catatan utang) digabung dalam satu
    // batch atomik. Koleksi `utang` hanya boleh ditulis oleh akun ber-role
    // admin (lihat firestore.rules). Sebelumnya stok & jurnal ditulis lebih
    // dulu lewat addDoc/updateDoc terpisah, baru utang ditulis TERAKHIR —
    // kalau baris utang ditolak (permission-denied), stok & jurnal sudah
    // kadung tersimpan padahal catatan utangnya sendiri tidak pernah ada,
    // sehingga pembelian terasa "tidak mau tersimpan" / datanya jadi tidak
    // konsisten. Dengan batch, kalau satu bagian ditolak, SEMUA dibatalkan
    // bersama dan pesan error tampil jelas ke pengguna.
    const batch = writeBatch(db);

    for (const it of items) {
      const found = existingProds.find((p) => p.kode === it.kode);
      if (found) {
        const oldQty = Number(found.stok) || 0;
        const oldModal = Number(found.modal) || 0;
        const newQty = it.qty;
        const newModal = it.modal;

        const totalQtyNow = oldQty + newQty;
        let newAvg = 0;
        if (totalQtyNow > 0) {
          newAvg = Math.round((oldQty * oldModal + newQty * newModal) / totalQtyNow);
        }

        batch.update(doc(db, 'products', found.docId), {
          stok: totalQtyNow,
          modal: newModal > 0 ? newAvg : oldModal,
          jual: it.jual > 0 ? it.jual : found.jual,
          updatedAt: serverTimestamp()
        });

        const akunPers = getPersAkun(it.kategori);
        katTotals[akunPers] =
          (katTotals[akunPers] || 0) + newQty * (newModal > 0 ? newModal : oldModal);
      } else {
        batch.set(doc(collection(db, 'products')), {
          kode: it.kode,
          nama: it.nama,
          kategori: it.kategori,
          satuan: it.satuan || 'unit',
          modal: it.modal,
          jual: it.jual || 0,
          stok: it.qty,
          updatedAt: serverTimestamp()
        });

        const akunPersBaru = getPersAkun(it.kategori);
        katTotals[akunPersBaru] = (katTotals[akunPersBaru] || 0) + it.qty * it.modal;
      }
      total += it.modal * it.qty;
    }

    const idUtang = 'UTG' + String(Date.now()).slice(-8);
    const supplierLabel = data.namaSupplier || 'Supplier';

    for (const k in katTotals) {
      const pNama = k;
      batch.set(doc(collection(db, 'journals')), {
        tanggal: data.tanggal,
        bukti: idUtang,
        debit: pNama,
        kredit: 'UTANG USAHA',
        ket: 'Beli Stok Utang ke ' + supplierLabel,
        nominal: katTotals[k],
        createdAt: serverTimestamp()
      });
    }

    const ketUtang = 'Utang Belanja Persediaan ke ' + supplierLabel;
    batch.set(doc(collection(db, 'utang')), {
      id: idUtang,
      tanggal: data.tanggal,
      namaSupplier: data.namaSupplier || '',
      kontakSupplier: data.kontakSupplier || '',
      keterangan: ketUtang,
      nominal: total,
      status: 'Belum Lunas',
      createdAt: serverTimestamp()
    });

    await batch.commit();
    return { ok: true, id: idUtang };
  } catch (e: any) {
    console.error('saveStockPurchaseUtang error:', e);
    let msg = e.message || 'Gagal menyimpan pembelian utang';
    if (e.code === 'permission-denied') {
      msg =
        'Ditolak oleh aturan keamanan: hanya akun dengan role "admin" yang boleh mencatat Utang Usaha. ' +
        'Pastikan Anda login sebagai admin (bukan kasir) dan dokumen profil Anda di Firestore (koleksi "users") ' +
        'memiliki role: "admin" dan status: "active".';
    }
    return { ok: false, msg };
  }
}

// BATCH IMPORT STOCK & PEMBELIAN (TUNAI / UTANG / MASTER STOK) DENGAN TAKSIRAN LABA 35%
export async function batchImportStockAndPurchase(dataStr: string): Promise<{ ok: boolean; msg?: string; count?: number; utangId?: string }> {
  await ensureAuth();
  try {
    const data = JSON.parse(dataStr);
    const items = data.items as Array<{
      kode?: string;
      nama: string;
      kategori?: string;
      satuan?: string;
      qty: number;
      modal: number;
      jual?: number;
      supplier?: string;
    }>;

    if (!items || items.length === 0) {
      return { ok: false, msg: 'Tidak ada data barang untuk diimpor.' };
    }

    const snap = await getDocs(collection(db, 'products'));
    const existingProds: (Product & { docId: string })[] = [];
    snap.forEach((d) => existingProds.push({ docId: d.id, ...(d.data() as Product) }));

    const katTotals: Record<string, number> = {};
    let grandTotalModal = 0;
    let importedCount = 0;

    const batch = writeBatch(db);

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const namaTrim = String(it.nama || '').trim();
      if (!namaTrim) continue;

      const rawKode = String(it.kode || '').trim();
      const rawKat = (it.kategori || 'Sparepart').trim();
      const rawSatuan = (it.satuan || 'pcs').trim();
      const rawQty = Math.max(1, Number(it.qty) || 1);
      const rawModal = Math.max(0, Number(it.modal) || 0);

      // Profit 35% auto calculation if jual <= 0 or missing
      let rawJual = Number(it.jual) || 0;
      if (rawJual <= 0) {
        rawJual = Math.round(rawModal * 1.35);
      }

      // Check if product exists by kode OR by lowercase nama
      let found = existingProds.find((p) => rawKode && p.kode === rawKode);
      if (!found) {
        found = existingProds.find((p) => p.nama.toLowerCase() === namaTrim.toLowerCase());
      }

      if (found) {
        const oldQty = Number(found.stok) || 0;
        const oldModal = Number(found.modal) || 0;
        const totalQtyNow = oldQty + rawQty;
        let newAvgModal = rawModal;

        if (totalQtyNow > 0) {
          newAvgModal = Math.round((oldQty * oldModal + rawQty * rawModal) / totalQtyNow);
        }

        const prodRef = doc(db, 'products', found.docId);
        batch.update(prodRef, {
          stok: totalQtyNow,
          modal: rawModal > 0 ? newAvgModal : oldModal,
          jual: rawJual > 0 ? rawJual : found.jual,
          updatedAt: serverTimestamp()
        });

        const akunPers = getPersAkun(found.kategori || rawKat);
        katTotals[akunPers] =
          (katTotals[akunPers] || 0) + rawQty * (rawModal > 0 ? rawModal : oldModal);
      } else {
        const finalKode = rawKode || ('HB-' + String(Date.now()).slice(-6) + i);
        const newProdRef = doc(collection(db, 'products'));
        batch.set(newProdRef, {
          kode: finalKode,
          nama: namaTrim,
          kategori: rawKat,
          satuan: rawSatuan,
          modal: rawModal,
          jual: rawJual,
          stok: rawQty,
          updatedAt: serverTimestamp()
        });

        const akunPersBaru = getPersAkun(rawKat);
        katTotals[akunPersBaru] = (katTotals[akunPersBaru] || 0) + rawQty * rawModal;
      }

      grandTotalModal += rawQty * rawModal;
      importedCount++;
    }

    if (importedCount === 0) {
      return { ok: false, msg: 'Tidak ada data barang valid yang diimpor.' };
    }

    let utangId = undefined;
    const tgl = data.tanggal || formatISO(new Date());
    const mode = data.metode || 'StockOnly';

    if (mode === 'Utang') {
      utangId = 'UTG' + String(Date.now()).slice(-8);
      const supplierLabel = data.namaSupplier || 'Supplier Excel';

      for (const k in katTotals) {
        const pNama = k;
        const jRef = doc(collection(db, 'journals'));
        batch.set(jRef, {
          tanggal: tgl,
          bukti: utangId,
          debit: pNama,
          kredit: 'UTANG USAHA',
          ket: `Import Pembelian Utang ke ${supplierLabel}`,
          nominal: katTotals[k],
          createdAt: serverTimestamp()
        });
      }

      const uRef = doc(collection(db, 'utang'));
      batch.set(uRef, {
        id: utangId,
        tanggal: tgl,
        namaSupplier: supplierLabel,
        kontakSupplier: data.kontakSupplier || '',
        keterangan: `Pembelian Import Stock Excel (${importedCount} item)`,
        nominal: grandTotalModal,
        status: 'Belum Lunas',
        createdAt: serverTimestamp()
      });
    } else if (mode === 'Kas' || mode.startsWith('Bank') || mode.includes('Bank') || mode === 'Transfer') {
      const buktiId = 'BUY' + String(Date.now()).slice(-8);
      const creditAccount = mode === 'Kas' ? 'KAS' : mode;

      for (const k in katTotals) {
        const pNama = k;
        const jRef = doc(collection(db, 'journals'));
        batch.set(jRef, {
          tanggal: tgl,
          bukti: buktiId,
          debit: pNama,
          kredit: creditAccount,
          ket: `Import Pembelian Tunai/Transfer (${importedCount} item)`,
          nominal: katTotals[k],
          createdAt: serverTimestamp()
        });
      }
    } else {
      // MasterStok / StockOnly (Saldo Awal / Modal)
      const buktiId = 'STK' + String(Date.now()).slice(-8);
      for (const k in katTotals) {
        const pNama = k;
        const jRef = doc(collection(db, 'journals'));
        batch.set(jRef, {
          tanggal: tgl,
          bukti: buktiId,
          debit: pNama,
          kredit: 'MODAL PEMILIK',
          ket: `Import Master Stok / Saldo Awal (${importedCount} item)`,
          nominal: katTotals[k],
          createdAt: serverTimestamp()
        });
      }
    }

    await batch.commit();

    return { ok: true, count: importedCount, utangId };
  } catch (err: any) {
    console.error('batchImportStockAndPurchase error:', err);
    return { ok: false, msg: err.message || 'Gagal memproses import data Excel.' };
  }
}

// HELPER ACCOUNT DEBIT
function getDebitAkun(metode: string) {
  if (metode === 'Utang') return 'PIUTANG USAHA';
  if (metode === 'Kas') return 'KAS';
  return metode;
}

// Pemetaan kategori barang ke nama akun COA.
//
// Ketiga fungsi ini WAJIB dipakai bersama-sama di seluruh modul. Sebelumnya
// modul pembelian menyusun nama akun secara ad-hoc ('PERSEDIAAN ' + kategori)
// sementara modul penjualan memakai getPersAkun(). Untuk kategori di luar tiga
// kategori baku, keduanya menghasilkan nama akun yang berbeda sehingga
// persediaan masuk dan keluar tidak pernah bertemu di akun yang sama.
const KAT_BAKU = ['Sepeda', 'Sparepart', 'Aksesoris'];

function normalKat(kat: string): string {
  const k = String(kat || '').trim();
  const found = KAT_BAKU.find((b) => b.toLowerCase() === k.toLowerCase());
  return found || 'Lainnya';
}

export function getJualAkun(kat: string) {
  const k = normalKat(kat);
  return k === 'Lainnya' ? 'PENDAPATAN LAINNYA' : `PENJUALAN ${k.toUpperCase()}`;
}

export function getHPPAkun(kat: string) {
  return `HPP ${normalKat(kat).toUpperCase()}`;
}

export function getPersAkun(kat: string) {
  return `PERSEDIAAN ${normalKat(kat).toUpperCase()}`;
}

// ==================== PENJUALAN BARANG ====================
export async function saveSale(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = 'TRX' + String(Date.now()).slice(-8);
  const rawItems = (data.items || []) as CartItem[];

  if (!rawItems.length) return { ok: false, msg: 'Keranjang penjualan masih kosong.' };

  // ---- 1. Gabungkan baris dengan kode barang yang sama --------------------
  // Kalau kasir menambahkan barang yang sama dua kali sebagai dua baris,
  // versi lama memeriksa stok per baris (2 x 3 unit lolos padahal stok 4) dan
  // menyimpan stok akhir dari nilai lama yang sama, sehingga hanya satu baris
  // yang benar-benar mengurangi stok.
  const qtyPerKode: Record<string, number> = {};
  for (const it of rawItems) {
    const kode = String(it.kode || '').trim();
    if (!kode) return { ok: false, msg: 'Ada baris barang tanpa kode. Muat ulang katalog.' };
    const q = Number(it.qty) || 0;
    if (q <= 0) return { ok: false, msg: `Jumlah untuk "${it.nama}" harus lebih dari 0.` };
    qtyPerKode[kode] = (qtyPerKode[kode] || 0) + q;
  }

  // ---- 2. Validasi stok terhadap master ----------------------------------
  const snap = await getDocs(collection(db, 'products'));
  const dbProds: (Product & { docId: string })[] = [];
  snap.forEach((d) => dbProds.push({ docId: d.id, ...(d.data() as Product) }));

  const prodByKode: Record<string, Product & { docId: string }> = {};
  dbProds.forEach((p) => (prodByKode[p.kode] = p));

  for (const kode in qtyPerKode) {
    const found = prodByKode[kode];
    if (!found) return { ok: false, msg: `Barang dengan kode "${kode}" tidak ada di master stok!` };
    if ((Number(found.stok) || 0) < qtyPerKode[kode]) {
      return {
        ok: false,
        msg: `Stok "${found.nama}" tidak cukup! Tersedia: ${found.stok}, diminta: ${qtyPerKode[kode]}`
      };
    }
  }

  // ---- 3. Susun item final; HPP diambil dari master, bukan dari klien -----
  // Harga jual boleh diubah kasir (diskon), tetapi harga modal TIDAK. Memakai
  // `modal` kiriman browser membuat laba-rugi bisa dipalsukan dari sisi klien
  // dan salah nilai bila harga rata-rata sudah berubah sejak katalog dimuat.
  let totalJual = 0;
  let totalQty = 0;
  const items = rawItems.map((it) => {
    const master = prodByKode[String(it.kode).trim()];
    const qty = Number(it.qty) || 0;
    const jual = Number(it.jual) || 0;
    const modal = Number(master?.modal) || 0;
    totalJual += jual * qty;
    totalQty += qty;
    return { ...it, qty, jual, modal, kategori: master?.kategori || it.kategori };
  });

  // ---- 4. Tulis semuanya dalam satu batch atomik -------------------------
  // Sebelumnya stok, transaksi, jurnal, dan piutang ditulis satu per satu.
  // Bila koneksi putus di tengah jalan, stok bisa berkurang tanpa struk,
  // atau struk tercatat tanpa jurnal. writeBatch menjadikannya sekali jadi.
  const batch = writeBatch(db);

  for (const kode in qtyPerKode) {
    // increment() dihitung di server, jadi aman meski dua kasir menjual barang
    // yang sama pada saat bersamaan (versi lama saling menimpa nilai stok).
    batch.update(doc(db, 'products', prodByKode[kode].docId), {
      stok: increment(-qtyPerKode[kode]),
      updatedAt: serverTimestamp()
    });
  }

  batch.set(doc(collection(db, 'transactions')), {
    id,
    tanggal: data.tanggal,
    tipe: 'Penjualan Barang',
    itemsJson: JSON.stringify(items),
    total: totalJual,
    metode: data.metode,
    status: data.metode === 'Utang' ? 'Belum Lunas' : 'Lunas',
    namaPembeli: data.namaPembeli || '',
    kontakPembeli: data.kontakPembeli || '',
    kasirName: data.kasirName || '',
    shiftId: data.shiftId || '',
    createdAt: serverTimestamp()
  });

  const debNama = getDebitAkun(data.metode);

  for (const it of items) {
    if (it.jual * it.qty > 0) {
      batch.set(doc(collection(db, 'journals')), {
        tanggal: data.tanggal,
        bukti: id,
        debit: debNama,
        kredit: getJualAkun(it.kategori),
        ket: `Jual ${it.nama} x${it.qty}`,
        nominal: it.jual * it.qty,
        createdAt: serverTimestamp()
      });
    }

    if (it.modal * it.qty > 0) {
      batch.set(doc(collection(db, 'journals')), {
        tanggal: data.tanggal,
        bukti: id,
        debit: getHPPAkun(it.kategori),
        kredit: getPersAkun(it.kategori),
        ket: `HPP ${it.nama} x${it.qty}`,
        nominal: it.modal * it.qty,
        createdAt: serverTimestamp()
      });
    }
  }

  if (data.metode === 'Utang') {
    const detailBarang = items.map((x) => `${x.nama} x${x.qty}`).join(', ');
    batch.set(doc(collection(db, 'piutang')), {
      id,
      tanggal: data.tanggal,
      namaPembeli: data.namaPembeli || '',
      kontakPembeli: data.kontakPembeli || '',
      keterangan: detailBarang,
      nominal: totalJual,
      status: 'Belum Lunas',
      createdAt: serverTimestamp()
    });
  }

  try {
    await batch.commit();
  } catch (err: any) {
    console.error('saveSale commit error:', err);
    return { ok: false, msg: 'Gagal menyimpan penjualan. Tidak ada data yang berubah. ' + (err?.message || '') };
  }

  return {
    ok: true,
    id,
    total: totalJual,
    items,
    qty: totalQty,
    tanggal: data.tanggal,
    metode: data.metode,
    kasirName: data.kasirName
  };
}

// ==================== JASA SERVICE ====================
export async function saveService(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = 'TRX' + String(Date.now()).slice(-8);
  const nom = Number(data.nominal);

  await addDoc(collection(db, 'transactions'), {
    id,
    tanggal: data.tanggal,
    tipe: 'Jasa Service',
    itemsJson: JSON.stringify({ nama: data.namaJasa, nominal: nom }),
    total: nom,
    metode: data.metode,
    status: data.metode === 'Utang' ? 'Belum Lunas' : 'Lunas',
    namaPembeli: data.namaPembeli || '',
    kontakPembeli: data.kontakPembeli || '',
    kasirName: data.kasirName || '',
    shiftId: data.shiftId || '',
    createdAt: serverTimestamp()
  });

  const debNama = getDebitAkun(data.metode);
  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: id,
    debit: debNama,
    kredit: 'PENDAPATAN JASA',
    ket: data.namaJasa,
    nominal: nom,
    createdAt: serverTimestamp()
  });

  if (data.metode === 'Utang') {
    await addDoc(collection(db, 'piutang'), {
      id,
      tanggal: data.tanggal,
      namaPembeli: data.namaPembeli || '',
      kontakPembeli: data.kontakPembeli || '',
      keterangan: 'Jasa: ' + data.namaJasa,
      nominal: nom,
      status: 'Belum Lunas',
      createdAt: serverTimestamp()
    });
  }

  return {
    ok: true,
    id,
    total: nom,
    tanggal: data.tanggal,
    metode: data.metode,
    namaJasa: data.namaJasa
  };
}

// ==================== PENDAPATAN LAINNYA ====================
export async function saveOtherIncome(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = 'TRX' + String(Date.now()).slice(-8);
  const nom = Number(data.nominal);

  await addDoc(collection(db, 'transactions'), {
    id,
    tanggal: data.tanggal,
    tipe: 'Pendapatan Lainnya',
    itemsJson: JSON.stringify({ ket: data.keterangan, nominal: nom }),
    total: nom,
    metode: data.metode,
    status: 'Lunas',
    createdAt: serverTimestamp()
  });

  const debNama = getDebitAkun(data.metode);
  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: id,
    debit: debNama,
    kredit: 'PENDAPATAN LAINNYA',
    ket: data.keterangan,
    nominal: nom,
    createdAt: serverTimestamp()
  });

  return { ok: true, id, total: nom };
}

// ==================== STOCK OPNAME ====================
export async function saveStockOpname(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  let items: { kode: string; qtyFisik: number }[] = [];

  if (Array.isArray(data.items)) {
    items = data.items.map((it: any) => ({
      kode: String(it.kode || '').trim(),
      qtyFisik: Number(it.qtyFisik !== undefined ? it.qtyFisik : it.stokFisik) || 0
    }));
  } else if (data.kodeBarang || data.kode) {
    items = [{
      kode: String(data.kodeBarang || data.kode).trim(),
      qtyFisik: Number(data.stokFisik !== undefined ? data.stokFisik : data.qtyFisik) || 0
    }];
  }

  if (items.length === 0) {
    return { ok: false, msg: 'Tidak ada data barang yang dipilih untuk opname.' };
  }

  const snap = await getDocs(collection(db, 'products'));
  if (snap.empty) return { ok: false, msg: 'Data barang kosong di master stok.' };

  const dbProds: (Product & { docId: string })[] = [];
  snap.forEach((d) => dbProds.push({ docId: d.id, ...(d.data() as Product) }));

  const opId = 'OPN' + String(Date.now()).slice(-8);
  let adaSelisih = false;

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const found = dbProds.find((p) => p.kode === it.kode);
    if (found) {
      const qtySistem = Number(found.stok) || 0;
      const selisih = it.qtyFisik - qtySistem;
      if (selisih === 0) continue;

      adaSelisih = true;
      const modalAvg = Number(found.modal) || 0;
      const nilaiSelisih = Math.abs(selisih) * modalAvg;
      const kat = found.kategori || 'Lainnya';
      const persAkun = getPersAkun(kat);
      const namaBarang = found.nama;

      await updateDoc(doc(db, 'products', found.docId), {
        stok: it.qtyFisik,
        updatedAt: serverTimestamp()
      });

      if (selisih > 0) {
        await addDoc(collection(db, 'journals'), {
          tanggal: data.tanggal || formatISO(new Date()),
          bukti: opId,
          debit: persAkun,
          kredit: 'PENDAPATAN LAINNYA',
          ket: `Opname Surplus: ${namaBarang} (+${selisih})`,
          nominal: nilaiSelisih,
          createdAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'journals'), {
          tanggal: data.tanggal || formatISO(new Date()),
          bukti: opId,
          debit: 'BEBAN LAINNYA',
          kredit: persAkun,
          ket: `Opname Shortage: ${namaBarang} (${selisih})`,
          nominal: nilaiSelisih,
          createdAt: serverTimestamp()
        });
      }
    }
  }

  if (!adaSelisih) return { ok: false, msg: 'Semua stok fisik yang dimasukkan sudah sesuai dengan sistem, tidak ada penyesuaian.' };
  return { ok: true, id: opId };
}

// ==================== PIUTANG USAHA ====================
export async function getPiutang() {
  const snap = await getDocs(query(collection(db, 'piutang'), where('status', '==', 'Belum Lunas')));
  const r: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    r.push({
      id: data.id,
      tanggal: fmtD(data.tanggal),
      keterangan: data.keterangan,
      nominal: data.nominal
    });
  });
  return r;
}

export async function getPiutangDetail(): Promise<PiutangItem[]> {
  const pSnap = await getDocs(collection(db, 'piutang'));
  const pbSnap = await getDocs(collection(db, 'piutang_bayar'));

  const payMap: Record<string, number> = {};
  pbSnap.forEach((d) => {
    const data = d.data();
    if (data.piutangId) {
      if (!payMap[data.piutangId]) payMap[data.piutangId] = 0;
      payMap[data.piutangId] += Number(data.jumlah) || 0;
    }
  });

  const r: PiutangItem[] = [];
  pSnap.forEach((d) => {
    const data = d.data();
    if (data.status === 'Belum Lunas') {
      const nominal = Number(data.nominal) || 0;
      const dibayar = payMap[data.id] || 0;
      r.push({
        id: data.id,
        tanggal: fmtD(data.tanggal),
        namaPembeli: data.namaPembeli || '-',
        kontak: data.kontakPembeli || '-',
        keterangan: data.keterangan || '-',
        nominal,
        dibayar,
        sisa: nominal - dibayar,
        status: data.status
      });
    }
  });
  return r;
}

export async function payPiutangAngsur(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = data.id;
  const bayar = Number(data.bayar);
  const metode = data.metode;
  // Tanggal dari pemanggil dihormati. Sebelumnya parameter `tanggal`
  // dialirkan App.tsx -> savePembayaran* -> fungsi ini, lalu dibuang diam-diam
  // dan diganti tanggal hari ini, sehingga pembayaran mundur mustahil dicatat.
  const tgl = String(data.tanggal || '').slice(0, 10) || formatISO(new Date());

  const pSnap = await getDocs(query(collection(db, 'piutang'), where('id', '==', id)));
  if (pSnap.empty) return { ok: false, msg: 'Piutang tidak ditemukan' };

  let pDocId = '';
  let foundNominal = 0;
  let foundKet = '';
  let foundNama = '';

  pSnap.forEach((d) => {
    pDocId = d.id;
    const pData = d.data();
    foundNominal = Number(pData.nominal) || 0;
    foundKet = pData.keterangan || '';
    foundNama = pData.namaPembeli || '';
  });

  const pbSnap = await getDocs(query(collection(db, 'piutang_bayar'), where('piutangId', '==', id)));
  let totalDibayar = 0;
  pbSnap.forEach((d) => {
    totalDibayar += Number(d.data().jumlah) || 0;
  });

  const sisa = foundNominal - totalDibayar;
  if (bayar > sisa) return { ok: false, msg: `Pembayaran melebihi sisa piutang (${formatRupiah(sisa)})` };
  if (bayar <= 0) return { ok: false, msg: 'Jumlah bayar harus lebih dari 0' };

  const newSisa = sisa - bayar;

  await addDoc(collection(db, 'piutang_bayar'), {
    piutangId: id,
    tanggal: tgl,
    jumlah: bayar,
    metode,
    keterangan: 'Angsuran ' + foundKet + (foundNama ? ` (${foundNama})` : ''),
    sisa: Math.max(0, newSisa),
    createdAt: serverTimestamp()
  });

  const debNama = getDebitAkun(metode);
  await addDoc(collection(db, 'journals'), {
    tanggal: tgl,
    bukti: 'PBA' + Date.now(),
    debit: debNama,
    kredit: 'PIUTANG USAHA',
    ket: 'Angsuran ' + foundKet,
    nominal: bayar,
    createdAt: serverTimestamp()
  });

  if (newSisa <= 0) {
    await updateDoc(doc(db, 'piutang', pDocId), { status: 'Lunas' });
    const tSnap = await getDocs(query(collection(db, 'transactions'), where('id', '==', id)));
    await Promise.all(
      tSnap.docs.map((td) => updateDoc(doc(db, 'transactions', td.id), { status: 'Lunas' }))
    );
  }

  return { ok: true, bayar, sisa: Math.max(0, newSisa), lunas: newSisa <= 0 };
}

export async function payPiutangFullNew(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = data.id;
  const metode = data.metode;
  // Tanggal dari pemanggil dihormati. Sebelumnya parameter `tanggal`
  // dialirkan App.tsx -> savePembayaran* -> fungsi ini, lalu dibuang diam-diam
  // dan diganti tanggal hari ini, sehingga pembayaran mundur mustahil dicatat.
  const tgl = String(data.tanggal || '').slice(0, 10) || formatISO(new Date());

  const pSnap = await getDocs(query(collection(db, 'piutang'), where('id', '==', id)));
  if (pSnap.empty) return { ok: false, msg: 'Piutang tidak ditemukan' };

  let pDocId = '';
  let foundNominal = 0;
  let foundKet = '';
  let foundNama = '';

  pSnap.forEach((d) => {
    pDocId = d.id;
    const pData = d.data();
    foundNominal = Number(pData.nominal) || 0;
    foundKet = pData.keterangan || '';
    foundNama = pData.namaPembeli || '';
  });

  const pbSnap = await getDocs(query(collection(db, 'piutang_bayar'), where('piutangId', '==', id)));
  let totalDibayar = 0;
  pbSnap.forEach((d) => {
    totalDibayar += Number(d.data().jumlah) || 0;
  });

  const sisa = foundNominal - totalDibayar;

  if (sisa <= 0) return { ok: false, msg: 'Tidak ada sisa piutang yang perlu dilunasi.' };

  await addDoc(collection(db, 'piutang_bayar'), {
    piutangId: id,
    tanggal: tgl,
    jumlah: sisa,
    metode,
    keterangan: 'Pelunasan ' + foundKet + (foundNama ? ` (${foundNama})` : ''),
    sisa: 0,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'piutang', pDocId), { status: 'Lunas' });
  const tSnap = await getDocs(query(collection(db, 'transactions'), where('id', '==', id)));
  await Promise.all(
    tSnap.docs.map((td) => updateDoc(doc(db, 'transactions', td.id), { status: 'Lunas' }))
  );

  const debNama = getDebitAkun(metode);
  await addDoc(collection(db, 'journals'), {
    tanggal: tgl,
    bukti: 'PBT' + Date.now(),
    debit: debNama,
    kredit: 'PIUTANG USAHA',
    ket: 'Pelunasan ' + foundKet,
    nominal: sisa,
    createdAt: serverTimestamp()
  });

  return { ok: true, bayar: sisa, sisa: 0, lunas: true };
}

export async function getRiwayatBayarPiutang(idPiutang: string) {
  const snap = await getDocs(query(collection(db, 'piutang_bayar'), where('piutangId', '==', idPiutang)));
  const r: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    r.push({
      tanggal: fmtD(data.tanggal),
      jumlah: Number(data.jumlah) || 0,
      metode: data.metode || '',
      keterangan: data.keterangan || ''
    });
  });
  return r;
}

// ==================== UTANG USAHA ====================
export async function getUtang(): Promise<UtangItem[]> {
  const uSnap = await getDocs(collection(db, 'utang'));
  const ubSnap = await getDocs(collection(db, 'utang_bayar'));

  const payMap: Record<string, number> = {};
  ubSnap.forEach((d) => {
    const data = d.data();
    if (data.utangId) {
      if (!payMap[data.utangId]) payMap[data.utangId] = 0;
      payMap[data.utangId] += Number(data.jumlah) || 0;
    }
  });

  const r: UtangItem[] = [];
  uSnap.forEach((d) => {
    const data = d.data();
    if (data.status === 'Belum Lunas') {
      const nominal = Number(data.nominal) || 0;
      const dibayar = payMap[data.id] || 0;
      r.push({
        id: data.id,
        tanggal: fmtD(data.tanggal),
        namaSupplier: data.namaSupplier || '',
        kontak: data.kontakSupplier || '',
        keterangan: data.keterangan || '',
        nominal,
        dibayar,
        sisa: nominal - dibayar,
        status: data.status
      });
    }
  });
  return r;
}

export async function payUtangAngsur(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = data.id;
  const bayar = Number(data.bayar);
  const metode = data.metode;
  // Tanggal dari pemanggil dihormati. Sebelumnya parameter `tanggal`
  // dialirkan App.tsx -> savePembayaran* -> fungsi ini, lalu dibuang diam-diam
  // dan diganti tanggal hari ini, sehingga pembayaran mundur mustahil dicatat.
  const tgl = String(data.tanggal || '').slice(0, 10) || formatISO(new Date());

  const uSnap = await getDocs(query(collection(db, 'utang'), where('id', '==', id)));
  if (uSnap.empty) return { ok: false, msg: 'Utang tidak ditemukan' };

  let uDocId = '';
  let foundNominal = 0;
  let foundKet = '';

  uSnap.forEach((d) => {
    uDocId = d.id;
    const uData = d.data();
    foundNominal = Number(uData.nominal) || 0;
    foundKet = uData.keterangan || '';
  });

  const ubSnap = await getDocs(query(collection(db, 'utang_bayar'), where('utangId', '==', id)));
  let totalDibayar = 0;
  ubSnap.forEach((d) => {
    totalDibayar += Number(d.data().jumlah) || 0;
  });

  const sisa = foundNominal - totalDibayar;
  if (bayar > sisa) return { ok: false, msg: `Pembayaran melebihi sisa utang (${formatRupiah(sisa)})` };
  if (bayar <= 0) return { ok: false, msg: 'Jumlah bayar harus lebih dari 0' };

  const newSisa = sisa - bayar;

  await addDoc(collection(db, 'utang_bayar'), {
    utangId: id,
    tanggal: tgl,
    jumlah: bayar,
    metode,
    keterangan: 'Angsuran ' + foundKet,
    sisa: Math.max(0, newSisa),
    createdAt: serverTimestamp()
  });

  const krdNama = metode === 'Kas' ? 'KAS' : metode;
  await addDoc(collection(db, 'journals'), {
    tanggal: tgl,
    bukti: 'UBA' + Date.now(),
    debit: 'UTANG USAHA',
    kredit: krdNama,
    ket: 'Angsuran ' + foundKet,
    nominal: bayar,
    createdAt: serverTimestamp()
  });

  if (newSisa <= 0) {
    await updateDoc(doc(db, 'utang', uDocId), { status: 'Lunas' });
  }

  return { ok: true, bayar, sisa: Math.max(0, newSisa), lunas: newSisa <= 0 };
}

export async function payUtangFull(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = data.id;
  const metode = data.metode;
  // Tanggal dari pemanggil dihormati. Sebelumnya parameter `tanggal`
  // dialirkan App.tsx -> savePembayaran* -> fungsi ini, lalu dibuang diam-diam
  // dan diganti tanggal hari ini, sehingga pembayaran mundur mustahil dicatat.
  const tgl = String(data.tanggal || '').slice(0, 10) || formatISO(new Date());

  const uSnap = await getDocs(query(collection(db, 'utang'), where('id', '==', id)));
  if (uSnap.empty) return { ok: false, msg: 'Utang tidak ditemukan' };

  let uDocId = '';
  let foundNominal = 0;
  let foundKet = '';

  uSnap.forEach((d) => {
    uDocId = d.id;
    const uData = d.data();
    foundNominal = Number(uData.nominal) || 0;
    foundKet = uData.keterangan || '';
  });

  const ubSnap = await getDocs(query(collection(db, 'utang_bayar'), where('utangId', '==', id)));
  let totalDibayar = 0;
  ubSnap.forEach((d) => {
    totalDibayar += Number(d.data().jumlah) || 0;
  });

  const sisa = foundNominal - totalDibayar;

  if (sisa <= 0) return { ok: false, msg: 'Tidak ada sisa utang yang perlu dilunasi.' };

  await addDoc(collection(db, 'utang_bayar'), {
    utangId: id,
    tanggal: tgl,
    jumlah: sisa,
    metode,
    keterangan: 'Pelunasan ' + foundKet,
    sisa: 0,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'utang', uDocId), { status: 'Lunas' });

  const krdNama = metode === 'Kas' ? 'KAS' : metode;
  await addDoc(collection(db, 'journals'), {
    tanggal: tgl,
    bukti: 'UBT' + Date.now(),
    debit: 'UTANG USAHA',
    kredit: krdNama,
    ket: 'Pelunasan ' + foundKet,
    nominal: sisa,
    createdAt: serverTimestamp()
  });

  return { ok: true, bayar: sisa, sisa: 0, lunas: true };
}

export async function getRiwayatBayarUtang(idUtang: string) {
  const snap = await getDocs(query(collection(db, 'utang_bayar'), where('utangId', '==', idUtang)));
  const r: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    r.push({
      tanggal: fmtD(data.tanggal),
      jumlah: Number(data.jumlah) || 0,
      metode: data.metode || '',
      keterangan: data.keterangan || ''
    });
  });
  return r;
}

export async function getAllRiwayatBayar(type: 'piutang' | 'utang') {
  const colName = type === 'piutang' ? 'piutang_bayar' : 'utang_bayar';
  const idKey = type === 'piutang' ? 'piutangId' : 'utangId';
  const snap = await getDocs(collection(db, colName));
  const r: any[] = [];
  snap.forEach((d) => {
    const data = d.data();
    r.push({
      id: data[idKey],
      tanggal: fmtD(data.tanggal),
      jumlah: Number(data.jumlah) || 0,
      metode: data.metode || '',
      keterangan: data.keterangan || ''
    });
  });
  return r;
}

// ==================== UTANG & PINJAMAN BANK ====================
export async function getUtangBank(): Promise<UtangBankItem[]> {
  try {
    const ubSnap = await getDocs(collection(db, 'utang_bank'));
    const paySnap = await getDocs(collection(db, 'utang_bank_bayar'));

    const payStats: Record<string, { pokok: number; bunga: number; denda: number }> = {};
    paySnap.forEach((d) => {
      const pData = d.data();
      const uId = pData.utangBankId;
      if (uId) {
        if (!payStats[uId]) payStats[uId] = { pokok: 0, bunga: 0, denda: 0 };
        payStats[uId].pokok += Number(pData.pokok) || 0;
        payStats[uId].bunga += Number(pData.bunga) || 0;
        payStats[uId].denda += Number(pData.denda) || 0;
      }
    });

    const result: UtangBankItem[] = [];
    ubSnap.forEach((d) => {
      const data = d.data();
      const plafon = Number(data.plafonPinjaman) || 0;
      const stats = payStats[data.id] || { pokok: 0, bunga: 0, denda: 0 };
      const sisaPokok = Math.max(0, plafon - stats.pokok);
      const isLunas = sisaPokok <= 0 || data.status === 'Lunas';

      result.push({
        id: data.id,
        tanggalPencairan: fmtD(data.tanggalPencairan),
        namaKreditur: data.namaKreditur || 'Bank',
        nomorKontrak: data.nomorKontrak || '-',
        plafonPinjaman: plafon,
        sisaPokok,
        bungaPctAnual: Number(data.bungaPctAnual) || 0,
        tenorBulan: Number(data.tenorBulan) || 12,
        dendaPctBulan: Number(data.dendaPctBulan) || 0,
        rekeningPencairan: data.rekeningPencairan || 'KAS',
        keterangan: data.keterangan || '',
        status: isLunas ? 'Lunas' : 'Aktif',
        dibayarPokok: stats.pokok,
        dibayarBunga: stats.bunga,
        dibayarDenda: stats.denda,
        createdAt: data.createdAt
      });
    });

    result.sort((a, b) => b.tanggalPencairan.localeCompare(a.tanggalPencairan));
    return result;
  } catch (err) {
    console.error('Error in getUtangBank:', err);
    return [];
  }
}

export async function savePencairanUtangBank(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = 'UBK' + String(Date.now()).slice(-8);
  const plafon = Number(data.plafonPinjaman) || 0;
  const rekPencairan = data.rekeningPencairan || 'KAS';
  const kreditur = data.namaKreditur || 'Bank';
  const noKontrak = data.nomorKontrak || '-';
  const tgl = data.tanggalPencairan || formatISO(new Date());

  if (plafon <= 0) {
    return { ok: false, msg: 'Nominal plafon pinjaman harus lebih dari Rp 0!' };
  }

  // 1. Simpan dokumen Utang Bank
  await addDoc(collection(db, 'utang_bank'), {
    id,
    tanggalPencairan: tgl,
    namaKreditur: kreditur,
    nomorKontrak: noKontrak,
    plafonPinjaman: plafon,
    sisaPokok: plafon,
    bungaPctAnual: Number(data.bungaPctAnual) || 0,
    tenorBulan: Number(data.tenorBulan) || 12,
    dendaPctBulan: Number(data.dendaPctBulan) || 0,
    rekeningPencairan: rekPencairan,
    keterangan: data.keterangan || '',
    status: 'Aktif',
    createdAt: serverTimestamp()
  });

  // 2. Jurnal Keuangan: Money In / Pencairan Pinjaman
  // Debit: Rekening Penerima (Kas / Bank)
  // Kredit: UTANG BANK / UTANG BANK BRI
  const targetKreditAkun = kreditur.toUpperCase().includes('BRI')
    ? 'UTANG BANK BRI'
    : kreditur.toUpperCase().includes('MANDIRI')
    ? 'UTANG BANK MANDIRI'
    : kreditur.toUpperCase().includes('BNI')
    ? 'UTANG BANK BNI'
    : 'UTANG BANK LAINNYA';

  await addDoc(collection(db, 'journals'), {
    tanggal: tgl,
    bukti: id,
    debit: rekPencairan,
    kredit: targetKreditAkun,
    ket: `Pencairan Pinjaman ${kreditur} (No. Kontrak: ${noKontrak})`,
    nominal: plafon,
    createdAt: serverTimestamp()
  });

  return { ok: true, id, plafon };
}

export async function savePembayaranUtangBank(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const { utangBankId, tanggal, pokok, bunga, denda, metode, keterangan } = data;

  const numPokok = Number(pokok) || 0;
  const numBunga = Number(bunga) || 0;
  const numDenda = Number(denda) || 0;
  const totalBayar = numPokok + numBunga + numDenda;

  if (totalBayar <= 0) {
    return { ok: false, msg: 'Total pembayaran angsuran harus lebih dari Rp 0!' };
  }

  // 1. Cari data Utang Bank
  const ubSnap = await getDocs(query(collection(db, 'utang_bank'), where('id', '==', utangBankId)));
  if (ubSnap.empty) return { ok: false, msg: 'Data Pinjaman Bank tidak ditemukan!' };

  let uDocId = '';
  let namaKreditur = 'Bank';
  let plafonPinjaman = 0;

  ubSnap.forEach((d) => {
    uDocId = d.id;
    const ubData = d.data();
    namaKreditur = ubData.namaKreditur || 'Bank';
    plafonPinjaman = Number(ubData.plafonPinjaman) || 0;
  });

  // Hitung riwayat angsuran sebelumnya
  const paySnap = await getDocs(query(collection(db, 'utang_bank_bayar'), where('utangBankId', '==', utangBankId)));
  let totalPokokTerdahulu = 0;
  paySnap.forEach((pd) => {
    totalPokokTerdahulu += Number(pd.data().pokok) || 0;
  });

  const currentSisa = Math.max(0, plafonPinjaman - totalPokokTerdahulu);
  if (numPokok > currentSisa) {
    return {
      ok: false,
      msg: `Angsuran Pokok (${formatRupiah(numPokok)}) melebihi Sisa Pokok Pinjaman (${formatRupiah(currentSisa)})!`
    };
  }

  const sisaPokokSesudah = Math.max(0, currentSisa - numPokok);
  const angsuranKe = paySnap.size + 1;
  const tglBayar = tanggal || formatISO(new Date());

  // 2. Simpan Catatan Pembayaran
  await addDoc(collection(db, 'utang_bank_bayar'), {
    utangBankId,
    tanggal: tglBayar,
    angsuranKe,
    pokok: numPokok,
    bunga: numBunga,
    denda: numDenda,
    totalBayar,
    metode: metode || 'Kas',
    keterangan: keterangan || `Angsuran Ke-${angsuranKe}`,
    sisaPokokSesudah,
    createdAt: serverTimestamp()
  });

  // Update status di dokumen utama
  if (sisaPokokSesudah <= 0) {
    await updateDoc(doc(db, 'utang_bank', uDocId), { status: 'Lunas', sisaPokok: 0 });
  } else {
    await updateDoc(doc(db, 'utang_bank', uDocId), { sisaPokok: sisaPokokSesudah });
  }

  // 3. Jurnal Keuangan Terintegrasi
  const targetUtangAkun = namaKreditur.toUpperCase().includes('BRI')
    ? 'UTANG BANK BRI'
    : namaKreditur.toUpperCase().includes('MANDIRI')
    ? 'UTANG BANK MANDIRI'
    : namaKreditur.toUpperCase().includes('BNI')
    ? 'UTANG BANK BNI'
    : 'UTANG BANK LAINNYA';

  const krdSumber = metode === 'Kas' ? 'KAS' : metode;
  const buktiBayar = 'UBA' + Date.now();

  // Journal 1: Pengurangan Pokok Utang Bank
  if (numPokok > 0) {
    await addDoc(collection(db, 'journals'), {
      tanggal: tglBayar,
      bukti: buktiBayar,
      debit: targetUtangAkun,
      kredit: krdSumber,
      ket: `Angsuran Pokok ${namaKreditur} (Ke-${angsuranKe})`,
      nominal: numPokok,
      createdAt: serverTimestamp()
    });
  }

  // Journal 2: Beban Bunga Bank
  if (numBunga > 0) {
    await addDoc(collection(db, 'journals'), {
      tanggal: tglBayar,
      bukti: buktiBayar,
      debit: 'BEBAN BUNGA BANK',
      kredit: krdSumber,
      ket: `Bunga Pinjaman ${namaKreditur} (Ke-${angsuranKe})`,
      nominal: numBunga,
      createdAt: serverTimestamp()
    });
  }

  // Journal 3: Beban Denda Keterlambatan
  if (numDenda > 0) {
    await addDoc(collection(db, 'journals'), {
      tanggal: tglBayar,
      bukti: buktiBayar,
      debit: 'BEBAN DENDA BANK',
      kredit: krdSumber,
      ket: `Denda Keterlambatan ${namaKreditur} (Ke-${angsuranKe})`,
      nominal: numDenda,
      createdAt: serverTimestamp()
    });
  }

  return {
    ok: true,
    angsuranKe,
    totalBayar,
    sisaPokok: sisaPokokSesudah,
    isLunas: sisaPokokSesudah <= 0
  };
}

export async function getRiwayatBayarUtangBank(utangBankId: string): Promise<UtangBankBayarItem[]> {
  try {
    const snap = await getDocs(
      query(collection(db, 'utang_bank_bayar'), where('utangBankId', '==', utangBankId))
    );
    const list: UtangBankBayarItem[] = [];
    snap.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        utangBankId: data.utangBankId,
        tanggal: fmtD(data.tanggal),
        angsuranKe: Number(data.angsuranKe) || 1,
        pokok: Number(data.pokok) || 0,
        bunga: Number(data.bunga) || 0,
        denda: Number(data.denda) || 0,
        totalBayar: Number(data.totalBayar) || 0,
        metode: data.metode || 'Kas',
        keterangan: data.keterangan || '',
        sisaPokokSesudah: Number(data.sisaPokokSesudah) || 0
      });
    });
    list.sort((a, b) => a.angsuranKe - b.angsuranKe);
    return list;
  } catch (err) {
    console.error('Error getRiwayatBayarUtangBank:', err);
    return [];
  }
}

export async function deleteUtangBank(utangBankId: string): Promise<{ ok: boolean; msg?: string }> {
  try {
    const ubSnap = await getDocs(query(collection(db, 'utang_bank'), where('id', '==', utangBankId)));
    ubSnap.forEach(async (d) => {
      await deleteDoc(doc(db, 'utang_bank', d.id));
    });
    return { ok: true };
  } catch (err: any) {
    return { ok: false, msg: err.message || 'Gagal menghapus pinjaman bank' };
  }
}

// ==================== MUTASI KAS / BANK ====================
export async function saveMutasiKasBank(dataStr: string): Promise<any> {
  const data = JSON.parse(dataStr);
  const id = 'MTK' + String(Date.now()).slice(-8);
  const nom = Number(data.nominal);

  if (data.tipe === 'Kas ke Bank') {
    await addDoc(collection(db, 'journals'), {
      tanggal: data.tanggal,
      bukti: id,
      debit: data.bank,
      kredit: 'KAS',
      ket: data.keterangan,
      nominal: nom,
      createdAt: serverTimestamp()
    });
  } else {
    await addDoc(collection(db, 'journals'), {
      tanggal: data.tanggal,
      bukti: id,
      debit: 'KAS',
      kredit: data.bank,
      ket: data.keterangan,
      nominal: nom,
      createdAt: serverTimestamp()
    });
  }
  return { ok: true, id };
}

export async function getMutasiKasBank(startD: string, endD: string): Promise<MutasiKasBank[]> {
  const snap = await getDocs(collection(db, 'journals'));
  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);
  const map: Record<string, MutasiKasBank> = {};

  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.tanggal) return;
    const tg = parseLocalDate(d.tanggal);
    if (tg < s || tg > e) return;
    const bukti = String(d.bukti || '');
    if (!bukti.startsWith('MTK')) return;

    if (!map[bukti]) {
      const debit = String(d.debit || '').trim().toUpperCase();
      const isKasToBank = debit !== 'KAS';
      const bankName = isKasToBank ? String(d.debit).trim() : String(d.kredit).trim();
      map[bukti] = {
        tanggal: fmtD(tg),
        bukti,
        tipe: isKasToBank ? 'Kas ke Bank' : 'Bank ke Kas',
        bank: bankName,
        keterangan: String(d.ket || ''),
        nominal: Number(d.nominal) || 0
      };
    }
  });

  const r = Object.values(map);
  r.sort((a, b) => b.bukti.localeCompare(a.bukti));
  return r;
}

export async function getSaldoKasBank(): Promise<Record<string, number>> {
  const snap = await getDocs(collection(db, 'journals'));
  const keys = ['KAS', 'BANK BRI', 'BANK MANDIRI', 'BANK BNI', 'BANK LAINNYA'];
  const saldo: Record<string, number> = {};
  keys.forEach((k) => (saldo[k] = 0));

  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.tanggal || !d.nominal) return;
    const debit = String(d.debit || '').trim().toUpperCase();
    const kredit = String(d.kredit || '').trim().toUpperCase();
    const nominal = Number(d.nominal) || 0;

    keys.forEach((k) => {
      if (debit === k) saldo[k] += nominal;
      if (kredit === k) saldo[k] -= nominal;
    });
  });

  return saldo;
}

// ==================== PENERIMAAN & PENGELUARAN ====================
export async function savePenerimaan(dataStr: string) {
  const data = JSON.parse(dataStr);
  const id = 'PNR' + String(Date.now()).slice(-8);
  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: id,
    debit: data.akunDebit,
    kredit: data.akunKredit,
    ket: data.keterangan,
    nominal: Number(data.nominal),
    createdAt: serverTimestamp()
  });
  return { ok: true, id };
}

export async function savePengeluaran(dataStr: string) {
  const data = JSON.parse(dataStr);
  const id = 'PNG' + String(Date.now()).slice(-8);
  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: id,
    debit: data.akunDebit,
    kredit: data.akunKredit,
    ket: data.keterangan,
    nominal: Number(data.nominal),
    createdAt: serverTimestamp()
  });
  return { ok: true, id };
}

export async function savePayroll(dataStr: string) {
  const data = JSON.parse(dataStr);
  const id = 'PRL' + String(Date.now()).slice(-8);
  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: id,
    debit: data.akunDebit || 'BEBAN GAJI KARYAWAN',
    kredit: data.akunKredit || 'KAS',
    ket: `Gaji & Operasional: ${data.namaKaryawan} (${data.jabatan}) - ${data.catatan || ''}`,
    nominal: Number(data.totalGaji),
    createdAt: serverTimestamp()
  });
  await addDoc(collection(db, 'payrolls'), {
    bukti: id,
    tanggal: data.tanggal,
    namaKaryawan: data.namaKaryawan,
    jabatan: data.jabatan,
    gajiPokok: Number(data.gajiPokok) || 0,
    uangMakan: Number(data.uangMakan) || 0,
    bonusKomisi: Number(data.bonusKomisi) || 0,
    potongan: Number(data.potongan) || 0,
    totalGaji: Number(data.totalGaji) || 0,
    metodeBayar: data.akunKredit || 'KAS',
    createdAt: serverTimestamp()
  });
  return { ok: true, id };
}

export async function getRecentPayroll(limitCount = 20) {
  try {
    const snap = await getDocs(collection(db, 'payrolls'));
    const list: any[] = [];
    snap.forEach((doc) => {
      list.push({ id: doc.id, ...doc.data() });
    });
    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    return list.slice(0, limitCount);
  } catch (err) {
    console.warn('Error getRecentPayroll:', err);
    return [];
  }
}

export async function getRecentPenerimaan(limitCount = 10) {
  try {
    const snap = await getDocs(collection(db, 'journals'));
    const list: any[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.bukti && String(d.bukti).startsWith('PNR')) {
        list.push({
          id: doc.id,
          bukti: d.bukti,
          tanggal: d.tanggal,
          akunDebit: d.debit,
          akunKredit: d.kredit,
          keterangan: d.ket,
          nominal: Number(d.nominal) || 0
        });
      }
    });
    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    return list.slice(0, limitCount);
  } catch (err) {
    console.warn('Error getRecentPenerimaan:', err);
    return [];
  }
}

export async function getRecentPengeluaran(limitCount = 10) {
  try {
    const snap = await getDocs(collection(db, 'journals'));
    const list: any[] = [];
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.bukti && String(d.bukti).startsWith('PNG')) {
        list.push({
          id: doc.id,
          bukti: d.bukti,
          tanggal: d.tanggal,
          akunDebit: d.debit,
          akunKredit: d.kredit,
          keterangan: d.ket,
          nominal: Number(d.nominal) || 0
        });
      }
    });
    list.sort((a, b) => (b.tanggal || '').localeCompare(a.tanggal || ''));
    return list.slice(0, limitCount);
  } catch (err) {
    console.warn('Error getRecentPengeluaran:', err);
    return [];
  }
}

// ==================== DASHBOARD ====================
export async function getDashboard(startD: string, endD: string): Promise<DashboardData> {
  const tSnap = await getDocs(collection(db, 'transactions'));
  const jSnap = await getDocs(collection(db, 'journals'));

  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  const diff = Math.ceil((e.getTime() - s.getTime()) / 864e5) + 1;
  const ps = new Date(s); ps.setDate(ps.getDate() - diff);
  const pe = new Date(s); pe.setDate(pe.getDate() - 1); pe.setHours(23, 59, 59, 999);

  let tItems = 0, tRev = 0, kasM = 0, kasK = 0, pItems = 0, pRev = 0;
  const prodS: Record<string, { qty: number; rev: number }> = {};
  const dayS: Record<string, { total: number; count: number }> = {};
  const txns: any[] = [];
  const bankFlows: Record<string, { masuk: number; keluar: number }> = {
    'BANK BRI': { masuk: 0, keluar: 0 },
    'BANK MANDIRI': { masuk: 0, keluar: 0 },
    'BANK BNI': { masuk: 0, keluar: 0 },
    'BANK LAINNYA': { masuk: 0, keluar: 0 }
  };
  const bankKeys = Object.keys(bankFlows);

  tSnap.forEach((doc) => {
    const td = doc.data();
    if (!td.id || !td.tanggal) return;
    const tg = parseLocalDate(td.tanggal);

    if (tg >= s && tg <= e) {
      if (String(td.tipe).trim() === 'Penjualan Barang') {
        let det: any[] = [];
        try {
          det = typeof td.itemsJson === 'string' ? JSON.parse(td.itemsJson) : td.itemsJson;
        } catch (ex) {}
        if (det) {
          for (let j = 0; j < det.length; j++) {
            tItems += det[j].qty || 0;
            if (!prodS[det[j].nama]) prodS[det[j].nama] = { qty: 0, rev: 0 };
            prodS[det[j].nama].qty += det[j].qty || 0;
            prodS[det[j].nama].rev += (det[j].jual || 0) * (det[j].qty || 0);
          }
        }
      }
      tRev += Number(td.total) || 0;
      txns.push({
        id: td.id,
        tanggal: fmtD(tg),
        tipe: td.tipe,
        total: td.total,
        metode: td.metode,
        status: td.status
      });

      const dk = fmtD(tg);
      if (!dayS[dk]) dayS[dk] = { total: 0, count: 0 };
      dayS[dk].total += Number(td.total) || 0;
      dayS[dk].count += 1;
    }

    if (tg >= ps && tg <= pe) {
      if (String(td.tipe).trim() === 'Penjualan Barang') {
        let det2: any[] = [];
        try {
          det2 = typeof td.itemsJson === 'string' ? JSON.parse(td.itemsJson) : td.itemsJson;
        } catch (ex) {}
        if (det2) {
          for (let k = 0; k < det2.length; k++) pItems += det2[k].qty || 0;
        }
      }
      pRev += Number(td.total) || 0;
    }
  });

  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal) return;
    const tg2 = parseLocalDate(jd.tanggal);
    if (tg2 >= s && tg2 <= e) {
      const debJ = String(jd.debit || '').trim().toUpperCase();
      const krdJ = String(jd.kredit || '').trim().toUpperCase();
      const nomJ = Number(jd.nominal) || 0;

      if (debJ === 'KAS') kasM += nomJ;
      if (krdJ === 'KAS') kasK += nomJ;

      for (let b = 0; b < bankKeys.length; b++) {
        if (debJ === bankKeys[b]) bankFlows[bankKeys[b]].masuk += nomJ;
        if (krdJ === bankKeys[b]) bankFlows[bankKeys[b]].keluar += nomJ;
      }
    }
  });

  const best = Object.keys(prodS)
    .map((k) => [k, prodS[k]] as [string, { qty: number; rev: number }])
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);

  const pop = Object.keys(dayS)
    .map((k) => [k, dayS[k]] as [string, { total: number; count: number }])
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 3);

  return { tItems, pItems, tRev, pRev, kasM, kasK, bankFlows, best, pop, txns };
}

// ==================== JURNAL UMUM ====================
export async function getJurnal(startD: string, endD: string): Promise<JournalEntry[]> {
  const snap = await getDocs(collection(db, 'journals'));
  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  const r: (JournalEntry & { _sortKey: string })[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.tanggal) return;
    const tg = parseLocalDate(d.tanggal);
    if (tg >= s && tg <= e) {
      r.push({
        id: doc.id,
        tanggal: fmtD(tg),
        bukti: d.bukti,
        debit: d.debit,
        kredit: d.kredit,
        ket: d.ket,
        nominal: Number(d.nominal) || 0,
        _sortKey: String(d.tanggal).slice(0, 10)
      });
    }
  });

  // Diurutkan memakai tanggal mentah (YYYY-MM-DD), BUKAN hasil fmtD().
  // Mengurutkan string "31/01/2026" secara leksikal akan menaruhnya sebelum
  // "01/02/2026" karena yang dibandingkan lebih dulu adalah angka harinya.
  r.sort((a, b) => {
    const cmp = String(b._sortKey).localeCompare(String(a._sortKey));
    return cmp !== 0 ? cmp : String(b.bukti || '').localeCompare(String(a.bukti || ''));
  });
  return r.map(({ _sortKey, ...rest }) => rest) as JournalEntry[];
}

// ==================== LAPORAN LABA RUGI ====================
export async function getLaporan(startD: string, endD: string): Promise<LaporanLabaRugi> {
  const snap = await getDocs(collection(db, 'journals'));
  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  const pend: Record<string, number> = {};
  const hpp: Record<string, number> = {};
  const beban: Record<string, number> = {};

  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.tanggal) return;
    const tg = parseLocalDate(d.tanggal);
    if (tg >= s && tg <= e) {
      const debit = String(d.debit || '').trim();
      const kredit = String(d.kredit || '').trim();
      const nominal = parseFloat(String(d.nominal)) || 0;
      const upDebit = debit.toUpperCase();
      const upKredit = kredit.toUpperCase();

      if (upKredit.includes('PENJUALAN') || upKredit.includes('PENDAPATAN')) {
        if (!pend[kredit]) pend[kredit] = 0;
        pend[kredit] += nominal;
      }
      if (upDebit.includes('HPP')) {
        if (!hpp[debit]) hpp[debit] = 0;
        hpp[debit] += nominal;
      }
      if (upDebit.includes('BEBAN')) {
        if (!beban[debit]) beban[debit] = 0;
        beban[debit] += nominal;
      }
    }
  });

  let totalPend = 0, totalHPP = 0, totalBeban = 0;
  for (const k in pend) totalPend += pend[k];
  for (const k in hpp) totalHPP += hpp[k];
  for (const k in beban) totalBeban += beban[k];

  return {
    pend,
    hpp,
    beban,
    tp: totalPend,
    th: totalHPP,
    tb: totalBeban,
    lr: totalPend - totalHPP - totalBeban
  };
}

// ==================== BUKU BESAR ====================
export async function getBukuBesarData(startD: string, endD: string): Promise<BukuBesarItem[]> {
  const jSnap = await getDocs(collection(db, 'journals'));
  const accounts = await getAccounts();

  const accMap: Record<string, Account> = {};
  accounts.forEach((a) => (accMap[a.nama.toUpperCase()] = a));

  const s = parseLocalDate(startD);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  type Entry = { tgl: Date; bukti: string; ket: string; d: number; k: number };
  const periodEntries: Record<string, Entry[]> = {};
  const openBal: Record<string, number> = {};   // saldo sebelum periode
  const allBal: Record<string, number> = {};    // saldo kumulatif s/d akhir periode

  // Satu kali lintasan untuk ketiga kebutuhan.
  // Versi lama menelusuri ulang seluruh jurnal untuk SETIAP akun (O(akun x jurnal));
  // pada buku dengan ribuan entri, halaman Buku Besar bisa membeku beberapa detik.
  jSnap.forEach((docSnap) => {
    const jd = docSnap.data();
    if (!jd.tanggal || !jd.nominal) return;

    const tg = parseLocalDate(jd.tanggal);
    if (tg > e) return;

    const debit = String(jd.debit || '').trim().toUpperCase();
    const kredit = String(jd.kredit || '').trim().toUpperCase();
    const nom = Number(jd.nominal) || 0;
    const bukti = String(jd.bukti || '').trim();
    const ket = String(jd.ket || '').trim();

    if (debit) {
      allBal[debit] = (allBal[debit] || 0) + nom;
      if (tg < s) {
        openBal[debit] = (openBal[debit] || 0) + nom;
      } else {
        (periodEntries[debit] ||= []).push({ tgl: tg, bukti, ket, d: nom, k: 0 });
      }
    }
    if (kredit) {
      allBal[kredit] = (allBal[kredit] || 0) - nom;
      if (tg < s) {
        openBal[kredit] = (openBal[kredit] || 0) - nom;
      } else {
        (periodEntries[kredit] ||= []).push({ tgl: tg, bukti, ket, d: 0, k: nom });
      }
    }
  });

  const result: BukuBesarItem[] = [];
  const keys = Object.keys(periodEntries).sort();

  for (const ak of keys) {
    const acc = accMap[ak] || { nama: ak, kelompok: '-', kategori: '', kode: '' };
    const isDN = ['Aset', 'HPP', 'Beban'].includes(acc.kelompok);

    // Entri WAJIB diurut tanggal sebelum saldo berjalan dihitung. Sebelumnya
    // urutannya mengikuti urutan dokumen Firestore (acak), sehingga kolom
    // "Saldo" pada Buku Besar tidak bisa dipertanggungjawabkan.
    const entries = [...(periodEntries[ak] || [])].sort((a, b) => {
      const t = a.tgl.getTime() - b.tgl.getTime();
      return t !== 0 ? t : a.bukti.localeCompare(b.bukti);
    });

    let runSal = openBal[ak] || 0;
    const elist = entries.map((en) => {
      runSal += en.d - en.k;
      return {
        tgl: fmtD(en.tgl),
        bukti: en.bukti,
        ket: en.ket,
        d: en.d || null,
        k: en.k || null,
        saldo: runSal
      };
    });

    result.push({
      akun: acc.nama,
      kelompok: acc.kelompok,
      kategori: acc.kategori,
      isDN,
      saldoAwal: openBal[ak] || 0,
      saldoAkhir: allBal[ak] || 0,
      entries: elist
    });
  }

  return result;
}

// ==================== KARTU STOK ====================
export async function getKartuStokAll(startD: string, endD: string): Promise<KartuStokItem[]> {
  const products = await getProducts();
  const tSnap = await getDocs(collection(db, 'transactions'));
  const jSnap = await getDocs(collection(db, 'journals'));

  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  const salesMap: Record<string, any[]> = {};
  tSnap.forEach((doc) => {
    const td = doc.data();
    if (!td.id || !td.tanggal) return;
    const tg = parseLocalDate(td.tanggal);
    if (tg < s || tg > e) return;
    if (String(td.tipe).trim() !== 'Penjualan Barang') return;

    let items: any[] = [];
    try {
      items = JSON.parse(td.itemsJson);
    } catch (e2) {
      return;
    }

    for (let j = 0; j < items.length; j++) {
      if (!items[j].kode) continue;
      if (!salesMap[items[j].kode]) salesMap[items[j].kode] = [];
      salesMap[items[j].kode].push({
        tgl: fmtD(tg),
        bukti: td.id,
        ket: `Penjualan ${items[j].nama} x${items[j].qty}`,
        qty: items[j].qty || 0
      });
    }
  });

  const opnMap: Record<string, any[]> = {};
  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal || !jd.bukti) return;
    if (!String(jd.bukti).trim().startsWith('OPN')) return;
    const tg = parseLocalDate(jd.tanggal);
    if (tg < s || tg > e) return;

    const ket = String(jd.ket || '').trim();
    const match = ket.match(/(?:Surplus|Shortage):\s*(.+?)\s*[\(]([+-]?\d+)[\)]/i);
    if (match) {
      const pName = match[1].trim();
      const sel = parseInt(match[2]) || 0;
      for (let p = 0; p < products.length; p++) {
        if (products[p].nama === pName) {
          if (!opnMap[products[p].kode]) opnMap[products[p].kode] = [];
          if (sel > 0) opnMap[products[p].kode].push({ tgl: fmtD(tg), bukti: String(jd.bukti).trim(), ket, masuk: sel, keluar: 0 });
          else if (sel < 0) opnMap[products[p].kode].push({ tgl: fmtD(tg), bukti: String(jd.bukti).trim(), ket, masuk: 0, keluar: Math.abs(sel) });
          break;
        }
      }
    }
  });

  const result: KartuStokItem[] = [];
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const outs = salesMap[p.kode] || [];
    const opns = opnMap[p.kode] || [];
    if (outs.length === 0 && opns.length === 0 && p.stok === 0) continue;

    let totalKeluar = 0;
    for (let j = 0; j < outs.length; j++) totalKeluar += outs[j].qty;

    let totalOpnMasuk = 0, totalOpnKeluar = 0;
    for (let j = 0; j < opns.length; j++) {
      totalOpnMasuk += opns[j].masuk;
      totalOpnKeluar += opns[j].keluar;
    }

    const stokAwal = p.stok + totalKeluar + totalOpnKeluar - totalOpnMasuk;
    const movements: any[] = [];

    for (let j = 0; j < outs.length; j++) movements.push({ tgl: outs[j].tgl, bukti: outs[j].bukti, ket: outs[j].ket, masuk: null, keluar: outs[j].qty });
    for (let j = 0; j < opns.length; j++) movements.push({ tgl: opns[j].tgl, bukti: opns[j].bukti, ket: opns[j].ket, masuk: opns[j].masuk || null, keluar: opns[j].keluar || null });

    movements.sort((a, b) => a.tgl.localeCompare(b.tgl));

    result.push({
      kode: p.kode,
      nama: p.nama,
      kategori: p.kategori,
      satuan: p.satuan,
      modal: p.modal,
      stokAwal,
      stokAkhir: p.stok,
      totalMasuk: totalOpnMasuk,
      totalKeluar: totalKeluar + totalOpnKeluar,
      movements
    });
  }

  return result;
}

// ==================== JURNAL PENYESUAIAN ====================
export async function getJurnalPenyesuaianAll(startD: string, endD: string): Promise<JurnalPenyesuaianItem[]> {
  const snap = await getDocs(collection(db, 'jurnal_penyesuaian'));
  const s = parseLocalDate(startD); s.setHours(0, 0, 0, 0);
  const e = parseLocalDate(endD); e.setHours(23, 59, 59, 999);

  const r: JurnalPenyesuaianItem[] = [];
  snap.forEach((doc) => {
    const d = doc.data();
    if (!d.tanggal) return;
    const tg = parseLocalDate(d.tanggal);
    if (tg >= s && tg <= e) {
      r.push({
        id: doc.id,
        tanggal: d.tanggal,
        bukti: d.bukti,
        debit: d.debit,
        kredit: d.kredit,
        ket: d.keterangan || d.ket || '',
        nominal: Number(d.nominal) || 0
      });
    }
  });

  return r;
}

export async function saveJurnalPenyesuaianEntry(dataStr: string) {
  const data = JSON.parse(dataStr);
  await addDoc(collection(db, 'jurnal_penyesuaian'), {
    tanggal: data.tanggal,
    bukti: data.bukti,
    debit: data.debit,
    kredit: data.kredit,
    keterangan: data.keterangan,
    nominal: Number(data.nominal),
    createdAt: serverTimestamp()
  });

  await addDoc(collection(db, 'journals'), {
    tanggal: data.tanggal,
    bukti: data.bukti,
    debit: data.debit,
    kredit: data.kredit,
    ket: data.keterangan,
    nominal: Number(data.nominal),
    createdAt: serverTimestamp()
  });

  return { ok: true };
}

// ==================== LAPORAN KEUANGAN FULL ====================
export async function getLapKeuanganFull(endDate: string): Promise<LapKeuanganFull> {
  const jSnap = await getDocs(collection(db, 'journals'));
  const pSnap = await getDocs(collection(db, 'products'));
  const accounts = await getAccounts();

  const e = parseLocalDate(endDate); e.setHours(23, 59, 59, 999);

  const allBal: Record<string, number> = {};
  const kelMap: Record<string, string> = {};
  accounts.forEach((a) => (kelMap[a.nama.toUpperCase()] = a.kelompok));

  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal || !jd.nominal) return;
    if (parseLocalDate(jd.tanggal) > e) return;

    const d = String(jd.debit || '').trim().toUpperCase();
    const k = String(jd.kredit || '').trim().toUpperCase();
    const n = Number(jd.nominal) || 0;

    if (!allBal[d]) allBal[d] = 0;
    if (!allBal[k]) allBal[k] = 0;
    allBal[d] += n;
    allBal[k] -= n;
  });

  const pend: Record<string, number> = {};
  const hpp: Record<string, number> = {};
  const beban: Record<string, number> = {};
  let tp = 0, th = 0, tb = 0;

  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal || !jd.nominal) return;
    if (parseLocalDate(jd.tanggal) > e) return;

    const kr = String(jd.kredit || '').trim().toUpperCase();
    const dbName = String(jd.debit || '').trim().toUpperCase();
    const nm = Number(jd.nominal) || 0;

    if ((kr.includes('PENJUALAN') || kr.includes('PENDAPATAN')) && !kr.includes('DISKON')) {
      if (!pend[kr]) pend[kr] = 0;
      pend[kr] += nm;
      tp += nm;
    }
    if (dbName.includes('HPP')) {
      if (!hpp[dbName]) hpp[dbName] = 0;
      hpp[dbName] += nm;
      th += nm;
    }
    if (dbName.includes('BEBAN')) {
      if (!beban[dbName]) beban[dbName] = 0;
      beban[dbName] += nm;
      tb += nm;
    }
  });

  const lr = tp - th - tb;

  const persediaan: Record<string, number> = {};
  pSnap.forEach((doc) => {
    const pd = doc.data();
    const kat = String(pd.kategori || 'LAINNYA').toUpperCase();
    const val = (Number(pd.modal) || 0) * (Number(pd.stok) || 0);
    if (!persediaan[kat]) persediaan[kat] = 0;
    persediaan[kat] += val;
  });

  const bankKeys = ['BANK BRI', 'BANK MANDIRI', 'BANK BNI', 'BANK LAINNYA'];
  const asetLancir: { nama: string; saldo: number }[] = [];
  asetLancir.push({ nama: 'Kas', saldo: allBal['KAS'] || 0 });

  bankKeys.forEach((b) => {
    const sv = allBal[b] || 0;
    if (sv !== 0) asetLancir.push({ nama: b, saldo: sv });
  });

  const piutS = allBal['PIUTANG USAHA'] || 0;
  if (piutS !== 0) asetLancir.push({ nama: 'Piutang Usaha', saldo: piutS });

  for (const kat in persediaan) {
    if (persediaan[kat] !== 0) asetLancir.push({ nama: 'Persediaan ' + kat, saldo: persediaan[kat] });
  }

  let totalAsetLancir = 0;
  asetLancir.forEach((a) => (totalAsetLancir += a.saldo));

  // ---- ASET TETAP ----
  // Blok ini sebelumnya dipaku nol. Padahal COA sudah punya PERALATAN KANTOR,
  // KENDARAAN, dan AKUMULASI PENYUSUTAN, dan modul Pengeluaran memang boleh
  // mendebit akun-akun itu. Akibatnya membeli kendaraan mengurangi Kas tanpa
  // memunculkan asetnya, sehingga neraca timpang persis sebesar pembelian.
  const katMap: Record<string, string> = {};
  accounts.forEach((a) => (katMap[a.nama.toUpperCase()] = a.kategori || ''));

  const asetTetapList: { nama: string; saldo: number }[] = [];
  let totalPerolehanAT = 0;
  let totalPenyusutan = 0;

  for (const ak in allBal) {
    if (!allBal[ak]) continue;
    const kel = kelMap[ak];
    const kat = katMap[ak];

    if (kel === 'Aset' && kat === 'Aset Tetap') {
      asetTetapList.push({ nama: ak, saldo: allBal[ak] });
      totalPerolehanAT += allBal[ak];
    } else if (kel === 'Kontra Aset' || kat === 'Kontra Aset') {
      // Akumulasi penyusutan bersaldo normal kredit -> tampil sebagai pengurang.
      const akum = Math.abs(allBal[ak]);
      asetTetapList.push({ nama: ak, saldo: -akum });
      totalPenyusutan += akum;
    }
  }

  const asetTetapNetto = totalPerolehanAT - totalPenyusutan;
  const totalAset = totalAsetLancir + asetTetapNetto;

  const kewajiban: { nama: string; saldo: number }[] = [];
  const kwKeys = ['UTANG USAHA', 'UTANG BANK BRI', 'UTANG BANK MANDIRI', 'UTANG BANK BNI', 'UTANG BANK LAINNYA'];
  kwKeys.forEach((k) => {
    const sv = allBal[k] || 0;
    if (sv !== 0) kewajiban.push({ nama: k, saldo: Math.abs(sv) });
  });

  for (const ak in allBal) {
    if (kelMap[ak] === 'Kewajiban' && !kwKeys.includes(ak) && allBal[ak] !== 0) {
      kewajiban.push({ nama: ak, saldo: Math.abs(allBal[ak]) });
    }
  }

  let totalKewajiban = 0;
  kewajiban.forEach((k) => (totalKewajiban += k.saldo));

  let initialModal = 0, lrToModal = 0;
  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal || !jd.nominal) return;
    if (parseLocalDate(jd.tanggal) > e) return;

    const dd = String(jd.debit || '').trim().toUpperCase();
    const kk = String(jd.kredit || '').trim().toUpperCase();
    const nn = Number(jd.nominal) || 0;
    const bukti = String(jd.bukti || '').trim();

    if (dd === 'MODAL PEMILIK' || kk === 'MODAL PEMILIK') {
      if (bukti.startsWith('JPT')) {
        if (kk === 'MODAL PEMILIK') lrToModal += nn;
      } else {
        if (kk === 'MODAL PEMILIK') initialModal += nn;
        else initialModal -= nn;
      }
    }
  });

  const prive = allBal['PRIVE'] || 0;
  let modalAwal = 0, modalAkhir = 0;
  if (lrToModal > 0) {
    modalAwal = initialModal;
    modalAkhir = allBal['MODAL PEMILIK'] || 0;
  } else {
    modalAwal = allBal['MODAL PEMILIK'] || 0;
    modalAkhir = modalAwal + lr - prive;
  }

  let kasMasuk = 0, kasKeluar = 0, utangBankKeluar = 0;
  jSnap.forEach((doc) => {
    const jd = doc.data();
    if (!jd.tanggal || !jd.nominal) return;
    if (parseLocalDate(jd.tanggal) > e) return;

    const dd = String(jd.debit || '').trim().toUpperCase();
    const kk = String(jd.kredit || '').trim().toUpperCase();
    const nn = Number(jd.nominal) || 0;

    if (dd === 'KAS') kasMasuk += nn;
    if (kk === 'KAS') kasKeluar += nn;
    for (let b = 0; b < bankKeys.length; b++) {
      if (dd.includes('UTANG') && kk === bankKeys[b]) utangBankKeluar += nn;
    }
  });

  return {
    periode: endDate,
    pend,
    tp,
    hpp,
    th,
    beban,
    tb,
    lr,
    asetLancir,
    totalAsetLancir,
    asetTetapList,
    asetTetapNetto,
    totalPerolehanAT,
    totalAset,
    kewajiban,
    totalKewajiban,
    modalAwal,
    prive,
    modalAkhir,
    kasMasuk,
    kasKeluar,
    bankMasuk: {},
    bankKeluar: {},
    bankKeys,
    utangBankKeluar
  };
}

// ==================== JURNAL PENUTUP ====================
export async function saveJurnalPenutup(dataStr: string) {
  const data = JSON.parse(dataStr);
  for (let i = 0; i < data.entries.length; i++) {
    const en = data.entries[i];
    await addDoc(collection(db, 'journals'), {
      tanggal: data.tanggal,
      bukti: en.bukti,
      debit: en.debit,
      kredit: en.kredit,
      ket: en.keterangan,
      nominal: Number(en.nominal),
      createdAt: serverTimestamp()
    });
  }
  return { ok: true };
}

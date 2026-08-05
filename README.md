# HAYBIKE SYSTEM v2.1

Aplikasi PWA Kasir (POS) dan Akuntansi Dagang real-time untuk Toko Sepeda
HayBike — Talaga Wetan, Majalengka.

Dibangun dengan React 19, TypeScript, Vite, Tailwind CSS 4, dan Firebase
(Authentication + Cloud Firestore).

---

## Menjalankan secara lokal

**Prasyarat:** Node.js 18 atau lebih baru.

```bash
npm install
cp .env.example .env.local   # lalu isi konfigurasi Firebase Anda
npm run dev                  # http://localhost:3000
```

Perintah lain:

```bash
npm run lint      # pemeriksaan tipe TypeScript
npm run build     # bundel produksi ke dist/
npm run preview   # uji hasil build
```

---

## ⚠️ Baca dulu sebelum dipakai berjualan

Aplikasi ini **tidak akan bisa login** sampai Anda menyelesaikan
[`KEAMANAN-SETUP.md`](./KEAMANAN-SETUP.md). Ada empat langkah wajib:
mematikan anonymous sign-in, membuat akun admin pertama dari Firebase Console,
mempublikasikan `firestore.rules`, dan membersihkan data password lama.

Ini disengaja. Versi sebelumnya bisa langsung dipakai justru karena tidak ada
pengaman sama sekali.

---

## Model keamanan singkat

- **Identitas** — Firebase Authentication (Email/Password). Kasir boleh
  mengetik username saja; sistem memetakannya ke alamat internal
  `username@haybike.local`.
- **Otorisasi** — dokumen `/users/{uid}` menyimpan `role` dan `status`.
  Tidak pernah menyimpan password.
- **Penegakan** — `firestore.rules`. Penyaringan menu di React hanyalah
  kenyamanan tampilan; keputusan sesungguhnya diambil di server.

Menonaktifkan sebuah akun memutus sesinya seketika di semua perangkat.

---

## Peta modul

| Menu | Akses | Fungsi |
|---|---|---|
| Kasir POS | Kasir & Admin | Penjualan barang, jasa service, pendapatan lain |
| Riwayat & Laporan Harian | Kasir & Admin | Struk dan rekap penjualan |
| Cek Stok | Kasir (baca) / Admin (kelola) | Katalog, restock, opname, impor Excel |
| Penerimaan & Pengeluaran | Admin | Arus kas dan bank |
| Utang & Piutang | Admin | Utang supplier, piutang pelanggan, pinjaman bank |
| Payroll | Admin | Penggajian staf dan mekanik |
| Jurnal & Laporan Akuntansi | Admin | Jurnal umum, buku besar, laba rugi, neraca |
| Master COA & Pengaturan | Admin | Bagan akun, profil toko, struk, akun pengguna |

---

## Struktur direktori

```
src/
├── lib/firebase.ts          Inisialisasi Firebase, sesi, instance sekunder
├── services/
│   ├── firebaseService.ts   Seluruh logika data & akuntansi
│   └── initialData.ts       Bagan akun (COA) dan produk contoh
├── modules/                 Satu folder per modul fungsional
├── components/              Komponen bersama (Header, Sidebar, modal)
├── types.ts                 Definisi tipe bersama
└── App.tsx                  Sesi, otorisasi halaman, dan perutean
```

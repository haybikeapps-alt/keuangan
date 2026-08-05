# HayBike System — Panduan Penerapan Keamanan

Dokumen ini wajib dijalankan **satu kali** sebelum aplikasi dipakai di toko.
Tanpa langkah-langkah ini, perbaikan di sisi kode tidak ada artinya: pengaman
yang sesungguhnya hidup di Firebase Console, bukan di dalam berkas React.

---

## Ringkas: apa yang berubah

| Sebelum | Sesudah |
|---|---|
| `allow read, write: if true` | Aturan berbasis role, default **tolak** |
| Password teks polos di Firestore | Firebase Authentication, tidak ada password di database |
| `signInAnonymously()` untuk semua pengunjung | Tidak ada sesi tanpa login |
| Role disimpan di `sessionStorage` | Role dari dokumen `/users/{uid}`, ditegakkan di server |
| Pintu belakang `admin/admin`, `kasir/1234` | Dihapus |

---

## Langkah 1 — Matikan Anonymous Sign-in

Firebase Console → **Authentication** → **Sign-in method**

1. Pastikan **Email/Password** berstatus *Enabled*.
2. Pastikan **Anonymous** berstatus *Disabled*.

Langkah kedua tidak boleh dilewati. Selama anonymous aktif, siapa pun yang
membuka alamat aplikasi otomatis memperoleh sesi yang sah.

---

## Langkah 2 — Buat akun Admin pertama secara manual

Akun pertama sengaja **tidak** bisa dibuat dari dalam aplikasi. Kalau bisa,
berarti ada jalur yang memungkinkan orang asing mengangkat dirinya jadi admin.
Karena itu prosesnya lewat Console:

**2a. Buat kredensialnya**

Console → **Authentication** → **Users** → *Add user*

- Email: `admin@haybike.com` (atau surel asli Anda — sangat disarankan,
  supaya fitur "Lupa password" bisa dipakai)
- Password: minimal 8 karakter, jangan pakai kata `admin`
- Salin **User UID** yang muncul setelah tersimpan

**2b. Buat profil & rolenya**

Console → **Firestore Database** → koleksi `users` → *Add document*

- **Document ID**: tempel **User UID** dari langkah 2a (harus persis sama)
- Field:

| Field | Tipe | Nilai |
|---|---|---|
| `username` | string | `admin` |
| `email` | string | `admin@haybike.com` |
| `name` | string | `Pemilik Toko` |
| `role` | string | `admin` |
| `status` | string | `active` |

> Kaitannya: Document ID **harus** sama dengan UID. Aturan keamanan mencari
> profil di `/users/{uid}`. Kalau ID-nya berbeda, login akan berhasil tetapi
> ditolak masuk dengan pesan "belum diberi hak akses".

---

## Langkah 3 — Publikasikan aturan keamanan

```bash
firebase deploy --only firestore:rules
```

Atau salin isi `firestore.rules` ke Console → Firestore → **Rules** → *Publish*.

Verifikasi cepat: buka Console → Firestore → **Rules Playground**, simulasikan
`get` pada `/products/apa-saja` dalam keadaan tidak terautentikasi.
Hasil yang benar: **Denied**.

---

## Langkah 4 — Bersih-bersih data lama

Data warisan versi lama masih membawa risiko:

1. Buka koleksi `users`, **hapus semua dokumen lama** yang punya field
   `password` atau `pin`. Dokumen itu berisi password teks polos dan sudah
   tidak dipakai sistem baru.
2. Buka koleksi `settings` → dokumen `config`, hapus field `password` dan
   `cashierPin` bila masih ada.
3. Buat ulang akun setiap karyawan dari dalam aplikasi
   (menu **Pembuatan Akun**), bukan dengan menyunting Firestore.

---

## Langkah 5 — Uji sebelum dipakai berjualan

- [ ] Login sebagai admin berhasil, Dashboard tampil
- [ ] Buat satu akun kasir dari menu Pembuatan Akun — **sesi admin tidak terputus**
- [ ] Logout, lalu login sebagai kasir tersebut
- [ ] Menu kasir hanya berisi: Kasir POS, Riwayat, Laporan Harian, Cek Stok
- [ ] Di halaman Cek Stok, tombol Restock / Import Excel / Opname **tidak muncul**
- [ ] Kembali sebagai admin, ubah status kasir jadi Non-Aktif →
      sesi kasir di perangkat lain **langsung terputus**
- [ ] Login dengan password sembarangan → ditolak

---

## Batas kemampuan yang perlu Anda ketahui

Beberapa hal tidak bisa dikerjakan dari peramban dan memang begitu desainnya:

- **Admin tidak bisa mengganti password karyawan secara langsung.** Firebase
  hanya mengizinkan itu lewat Admin SDK di server. Yang tersedia: kirim tautan
  atur ulang (untuk akun ber-email asli), atau cabut akun lalu buat baru.
- **Menghapus akun hanya menghapus profilnya.** Kredensial di Authentication
  tetap ada. Ini aman: tanpa profil, kredensial itu tidak bisa membaca maupun
  menulis apa pun. Untuk membersihkannya betul-betul, hapus manual dari
  Console → Authentication → Users.
- **Akun berbasis username tidak punya kotak surat**, jadi tidak bisa menerima
  tautan reset. Bila Anda ingin semua karyawan mandiri, daftarkan pakai email asli.

---

## Kalau ke depan butuh lebih

Sebuah Cloud Function dengan Admin SDK akan melengkapi tiga hal: reset password
oleh admin, penghapusan akun sampai ke Authentication, dan pemindahan role ke
*custom claims* sehingga aturan keamanan tidak perlu membaca dokumen profil
setiap kali (lebih cepat dan lebih murah). Itu di luar cakupan perbaikan ini.

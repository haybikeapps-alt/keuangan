export interface Account {
  id?: string;
  kode: string;
  nama: string;
  kelompok: string;
  kategori: string;
}

export interface PaymentMethod {
  val: string;
  label: string;
}

export interface Product {
  id?: string;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  modal: number;
  jual: number;
  stok: number;
  updatedAt?: any;
}

export interface CartDiscount {
  type: 'pct' | 'coret' | null;
  pct: number;
  price: number;
}

export interface CartItem {
  kode: string;
  nama: string;
  kategori: string;
  modal: number;
  jual: number;
  qty: number;
  stok: number;
  satuan: string;
  hargaAwal?: number;
  disc?: CartDiscount | null;
}

export interface SaleTransaction {
  id: string;
  tanggal: string;
  tipe: 'Penjualan Barang' | 'Jasa Service' | 'Pendapatan Lainnya';
  itemsJson: string;
  total: number;
  metode: string;
  status: 'Lunas' | 'Belum Lunas';
  namaPembeli?: string;
  kontakPembeli?: string;
  kasirName?: string;
  shiftId?: string;
  createdAt?: any;
}

export interface KasirShift {
  id: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  modalAwal: number;
  status: 'open' | 'closed';
  notes?: string;
  totalTunai?: number;
  totalNonTunai?: number;
  totalPiutang?: number;
  kasAktual?: number;
  selisih?: number;
}

export interface JournalEntry {
  id?: string;
  tanggal: string;
  bukti: string;
  debit: string;
  kredit: string;
  ket: string;
  nominal: number;
  createdAt?: any;
}

export interface PiutangItem {
  id: string;
  tanggal: string;
  namaPembeli: string;
  kontak: string;
  keterangan: string;
  nominal: number;
  dibayar: number;
  sisa: number;
  status: string;
}

export interface PiutangBayar {
  id?: string;
  piutangId: string;
  tanggal: string;
  jumlah: number;
  metode: string;
  keterangan: string;
  sisa: number;
}

export interface UtangItem {
  id: string;
  tanggal: string;
  namaSupplier: string;
  kontak: string;
  keterangan: string;
  nominal: number;
  dibayar: number;
  sisa: number;
  status: string;
}

export interface UtangBayar {
  id?: string;
  utangId: string;
  tanggal: string;
  jumlah: number;
  metode: string;
  keterangan: string;
  sisa: number;
}

export interface UtangBankItem {
  id: string;
  tanggalPencairan: string;
  namaKreditur: string;
  nomorKontrak: string;
  plafonPinjaman: number;
  sisaPokok: number;
  bungaPctAnual: number;
  tenorBulan: number;
  dendaPctBulan: number;
  rekeningPencairan: string;
  keterangan?: string;
  status: 'Aktif' | 'Lunas';
  dibayarPokok?: number;
  dibayarBunga?: number;
  dibayarDenda?: number;
  createdAt?: any;
}

export interface UtangBankBayarItem {
  id?: string;
  utangBankId: string;
  tanggal: string;
  angsuranKe: number;
  pokok: number;
  bunga: number;
  denda: number;
  totalBayar: number;
  metode: string;
  keterangan: string;
  sisaPokokSesudah: number;
  createdAt?: any;
}

export interface MutasiKasBank {
  id?: string;
  tanggal: string;
  bukti: string;
  tipe: 'Kas ke Bank' | 'Bank ke Kas';
  bank: string;
  keterangan: string;
  nominal: number;
}

export interface StockOpnameItem {
  kode: string;
  qtyFisik: number;
}

export interface JurnalPenyesuaianItem {
  id?: string;
  tanggal: string;
  bukti: string;
  debit: string;
  kredit: string;
  ket: string;
  nominal: number;
}

export interface DashboardData {
  tItems: number;
  pItems: number;
  tRev: number;
  pRev: number;
  kasM: number;
  kasK: number;
  bankFlows: Record<string, { masuk: number; keluar: number }>;
  best: [string, { qty: number; rev: number }][];
  pop: [string, { total: number; count: number }][];
  txns: {
    id: string;
    tanggal: string;
    tipe: string;
    total: number;
    metode: string;
    status: string;
  }[];
}

export interface LaporanLabaRugi {
  pend: Record<string, number>;
  hpp: Record<string, number>;
  beban: Record<string, number>;
  tp: number;
  th: number;
  tb: number;
  lr: number;
}

export interface LapKeuanganFull extends LaporanLabaRugi {
  periode: string;
  modalAwal: number;
  prive: number;
  modalAkhir: number;
  kasMasuk: number;
  kasKeluar: number;
  bankMasuk: Record<string, number>;
  bankKeluar: Record<string, number>;
  bankKeys: string[];
  asetLancir: { nama: string; saldo: number }[];
  asetTetapList: { nama: string; saldo: number }[];
  totalAsetLancir: number;
  asetTetapNetto: number;
  totalPerolehanAT: number;
  totalAset: number;
  kewajiban: { nama: string; saldo: number }[];
  totalKewajiban: number;
  utangBankKeluar: number;
}

export interface KartuStokItem {
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  modal: number;
  stokAwal: number;
  stokAkhir: number;
  totalMasuk: number;
  totalKeluar: number;
  movements: {
    tgl: string;
    bukti: string;
    ket: string;
    masuk: number | null;
    keluar: number | null;
  }[];
}

export interface BukuBesarItem {
  akun: string;
  kelompok: string;
  kategori: string;
  isDN: boolean;
  saldoAwal: number;
  saldoAkhir: number;
  entries: {
    tgl: string;
    bukti: string;
    ket: string;
    d: number | null;
    k: number | null;
    saldo: number;
  }[];
}

export interface AppSettings {
  namaToko: string;
  alamatToko: string;
  kotaToko: string;
  teleponToko: string;
  emailToko: string;
  headerStruk: string;
  footerMessage: string;
  footerGreeting: string;
  showKasirName: boolean;
  thermalWidth: '58mm' | '80mm';
  autoPrintReceipt: boolean;
  logoUrl?: string;
}

/**
 * Profil pengguna yang tersimpan di Firestore (/users/{uid}).
 *
 * PENTING: tidak ada field `password` maupun `pin` di sini, dan itu disengaja.
 * Kredensial sepenuhnya dikelola Firebase Authentication; Firestore hanya
 * menyimpan identitas dan hak akses. `id` selalu sama dengan Firebase Auth UID.
 */
export interface UserAccount {
  id?: string;
  username: string;
  email?: string;
  name: string;
  role: 'admin' | 'kasir';
  status: 'active' | 'nonactive';
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
}

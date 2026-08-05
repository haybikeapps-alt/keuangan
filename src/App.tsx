import React, { useState, useEffect } from 'react';
import {
  subscribeAccounts,
  subscribePaymentMethods,
  subscribeSettings,
  initializeInitialData,
  savePembayaranPiutang,
  savePembayaranUtang,
  subscribeAuth,
  subscribeCurrentProfile,
  getUserProfile,
  logoutUser,
  formatISO,
  DEFAULT_SETTINGS
} from './services/firebaseService';
import { Account, PaymentMethod, PiutangItem, UtangItem, AppSettings, UserAccount } from './types';

// Components
import { Toast } from './components/Toast';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { PrintReceiptModal } from './components/PrintReceiptModal';
import { PaymentModal } from './components/PaymentModal';

// Modules
import { LoginForm } from './modules/auth/LoginForm';
import { DashboardModule } from './modules/dashboard/DashboardModule';
import { KasirModule } from './modules/kasir/KasirModule';
import { MutasiModule } from './modules/mutasi/MutasiModule';
import { PenerimaanModule } from './modules/penerimaan/PenerimaanModule';
import { PengeluaranModule } from './modules/pengeluaran/PengeluaranModule';
import { PembelianUtangModule } from './modules/pembelian/PembelianUtangModule';
import { StokModule } from './modules/stok/StokModule';
import { OpnameModule } from './modules/stok/OpnameModule';
import { UtangPiutangModule } from './modules/utangpiutang/UtangPiutangModule';
import { PayrollModule } from './modules/payroll/PayrollModule';
import { JurnalModule } from './modules/transaksi/JurnalModule';
import { LaporanAkuntansiModule } from './modules/laporan/LaporanAkuntansiModule';
import { MasterAkunModule } from './modules/master/MasterAkunModule';
import { SettingsModule } from './modules/settings/SettingsModule';

export default function App() {
  // ================= OTENTIKASI =================
  // Sumber kebenaran satu-satunya adalah sesi Firebase Auth + dokumen profil,
  // bukan sessionStorage. Versi lama menyimpan `haybike_auth=true` dan
  // `haybike_user_role=admin` di sessionStorage, sehingga siapa pun bisa
  // membuka Console peramban, menulis dua baris, lalu masuk sebagai pemilik
  // toko tanpa pernah tahu satu pun password.
  const [authStatus, setAuthStatus] = useState<'memeriksa' | 'keluar' | 'masuk'>('memeriksa');
  const [profile, setProfile] = useState<UserAccount | null>(null);

  const userRole: 'admin' | 'kasir' = profile?.role === 'admin' ? 'admin' : 'kasir';
  const cashierName = profile?.name || 'Pengguna';
  const isAuthenticated = authStatus === 'masuk' && !!profile;

  const [activePage, setActivePage] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') return window.innerWidth >= 768;
    return true;
  });

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  // Toast
  const [toastMsg, setToastMsg] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Print Receipt Modal
  const [printData, setPrintData] = useState<{
    title: string;
    data: any;
    type: 'sale' | 'service';
  } | null>(null);

  // Payment Modal (Piutang / Utang)
  const [payModalItem, setPayModalItem] = useState<{
    id: string;
    type: 'piutang' | 'utang';
    title: string;
    sisa: number;
  } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ msg, type });
  };

  const clearSession = () => {
    sessionStorage.removeItem('haybike_cashier_name');
    sessionStorage.removeItem('haybike_last_activity');
    setProfile(null);
    setAuthStatus('keluar');
  };

  // Memulihkan sesi saat aplikasi dibuka / setelah login.
  useEffect(() => {
    const unsub = subscribeAuth(async (user) => {
      if (!user) {
        clearSession();
        return;
      }
      const p = await getUserProfile(user.uid);
      if (!p || p.status !== 'active') {
        await logoutUser();
        clearSession();
        return;
      }
      sessionStorage.setItem('haybike_cashier_name', p.name);
      setProfile(p);
      setAuthStatus('masuk');
      setActivePage(p.role === 'kasir' ? 'kasir' : 'dashboard');
    });
    return () => unsub();
  }, []);

  // Pantau profil secara langsung: begitu admin menonaktifkan akun atau
  // menurunkan rolenya, sesi yang sedang berjalan ikut menyesuaikan seketika.
  useEffect(() => {
    const uid = profile?.id;
    if (!uid) return;
    const unsub = subscribeCurrentProfile(uid, (p) => {
      if (!p || p.status !== 'active') {
        logoutUser().catch(() => {});
        clearSession();
        showToast('Akses akun Anda dicabut oleh Admin.', 'error');
        return;
      }
      setProfile((prev) => (prev && prev.id === p.id ? { ...prev, ...p } : prev));
    });
    return () => unsub();
  }, [profile?.id]);

  // Langganan data master (hanya setelah benar-benar terautentikasi).
  useEffect(() => {
    if (!isAuthenticated) return;

    if (userRole === 'admin') {
      // Penyemaian data awal butuh hak tulis Admin; kasir cukup membaca.
      initializeInitialData();
    }

    const unsubAcc = subscribeAccounts((accs) => setAccounts(accs));
    const unsubPm = subscribePaymentMethods((pms) => setPaymentMethods(pms));
    const unsubSet = subscribeSettings((st) => setAppSettings(st));

    return () => {
      unsubAcc();
      unsubPm();
      unsubSet();
    };
  }, [isAuthenticated, userRole]);

  const handleLoginSuccess = (role: 'admin' | 'kasir' = 'admin', name?: string) => {
    // Status sesungguhnya ditetapkan oleh listener onAuthStateChanged di atas.
    sessionStorage.setItem('haybike_last_activity', Date.now().toString());
    if (name) sessionStorage.setItem('haybike_cashier_name', name);
    showToast(
      role === 'kasir'
        ? `Selamat bertugas, ${name || 'Kasir'}!`
        : `Selamat datang kembali, ${name || 'Admin'}.`,
      'success'
    );
  };

  const handleLogout = async () => {
    await logoutUser();
    clearSession();
    showToast('Berhasil keluar dari sistem', 'success');
  };

  // Keluar otomatis setelah 8 jam tanpa aktivitas.
  useEffect(() => {
    if (!isAuthenticated) return;

    const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;
    const KEY = 'haybike_last_activity';

    const forceLogout = () => {
      logoutUser().catch(() => {});
      clearSession();
      showToast('Sesi berakhir otomatis karena tidak ada aktivitas selama 8 jam.', 'error');
    };

    const updateActivity = () => sessionStorage.setItem(KEY, Date.now().toString());

    const lastActStr = sessionStorage.getItem(KEY);
    if (!lastActStr) {
      updateActivity();
    } else if (Date.now() - Number(lastActStr) >= EIGHT_HOURS_MS) {
      forceLogout();
      return;
    }

    let lastUpdate = 0;
    const handleUserInteraction = () => {
      const current = Date.now();
      if (current - lastUpdate > 15000) {
        lastUpdate = current;
        updateActivity();
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, handleUserInteraction, { passive: true }));

    const interval = setInterval(() => {
      const last = Number(sessionStorage.getItem(KEY) || Date.now());
      if (Date.now() - last >= EIGHT_HOURS_MS) forceLogout();
    }, 30000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserInteraction));
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  const handlePayModalSubmit = async (nominal: number, metode: string) => {
    if (!payModalItem) return;

    try {
      if (payModalItem.type === 'piutang') {
        const res = await savePembayaranPiutang(
          payModalItem.id,
          nominal,
          metode,
          formatISO(new Date())
        );
        if (res && res.ok) {
          showToast(`Pembayaran piutang ${payModalItem.id} berhasil!`);
        } else {
          showToast(res?.msg || 'Gagal memproses pembayaran piutang', 'error');
        }
      } else {
        const res = await savePembayaranUtang(
          payModalItem.id,
          nominal,
          metode,
          formatISO(new Date())
        );
        if (res && res.ok) {
          showToast(`Pembayaran utang ${payModalItem.id} berhasil!`);
        } else {
          showToast(res?.msg || 'Gagal memproses pembayaran utang', 'error');
        }
      }
      setPayModalItem(null);
    } catch (e: any) {
      showToast(e.message || 'Terjadi kesalahan', 'error');
    }
  };

  if (authStatus === 'memeriksa') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-3 bg-emerald-950 text-emerald-100">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-emerald-400"></i>
        <p className="text-xs font-semibold tracking-wide">Memeriksa sesi Anda...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  // Gerbang otorisasi tingkat halaman. Menu sudah disaring di Sidebar, tetapi
  // penyaringan menu hanyalah kosmetik: state `activePage` masih bisa diubah
  // dari luar. Lapisan ini menutup celah tersebut, dan `firestore.rules`
  // menjadi lapisan terakhir bila keduanya berhasil dilewati.
  const HALAMAN_KHUSUS_ADMIN = new Set([
    'dashboard', 'penerimaan', 'pengeluaran', 'mutasi', 'utang-piutang',
    'pembelian', 'opname-stok', 'payroll', 'jurnal', 'laporan-akuntansi',
    'master-akun', 'pengaturan', 'pembuatan-akun'
  ]);

  const halamanDitolak = userRole === 'kasir' && HALAMAN_KHUSUS_ADMIN.has(activePage);

  const pageTitleMap: Record<string, string> = {
    dashboard: 'Executive Dashboard Utama',
    kasir: 'Kasir POS & Penjualan Struk/Faktur',
    'riwayat-kasir': 'Riwayat & Struk Penjualan Kasir',
    'laporan-kasir': 'Laporan Penjualan Harian Kasir',
    penerimaan: 'Penerimaan Kas & Rekening (Uang Masuk)',
    pengeluaran: 'Pengeluaran Uang & Biaya Operasional',
    mutasi: 'Mutasi & Transfer Rekening Kas/Bank',
    'utang-piutang': 'Manajemen Utang Supplier & Piutang Pelanggan',
    stok: 'Master Stok Barang, Sparepart & Sepeda',
    pembelian: 'Pembelian Barang & Stok Masuk',
    'opname-stok': 'Stok Opname & Penyesuaian Fisik',
    payroll: 'Payroll & Penggajian Staff/Mekanik',
    jurnal: 'Jurnal Umum Transaksi (Real-time)',
    'laporan-akuntansi': 'Laporan Keuangan & Akuntansi (Laba Rugi, Buku Besar, Neraca)',
    'master-akun': 'Master Chart of Accounts (COA)',
    pengaturan: 'Pengaturan Toko, Profil & Printer Struk',
    'pembuatan-akun': 'Pembuatan & Kelola Akun Kasir'
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100 font-sans text-gray-900 flex flex-col antialiased selection:bg-emerald-500 selection:text-white">
      {/* Toast Notification */}
      {toastMsg && (
        <Toast
          message={toastMsg.msg}
          type={toastMsg.type}
          onClose={() => setToastMsg(null)}
        />
      )}

      {/* Main Print Receipt Modal */}
      {printData && (
        <PrintReceiptModal
          isOpen={true}
          title={printData.title}
          data={printData.data}
          type={printData.type}
          settings={appSettings}
          onClose={() => setPrintData(null)}
        />
      )}

      {/* Main Payment Modal */}
      {payModalItem && (
        <PaymentModal
          item={payModalItem}
          paymentMethods={paymentMethods}
          onClose={() => setPayModalItem(null)}
          onSubmit={handlePayModalSubmit}
        />
      )}

      {/* Top Header */}
      <Header
        pageTitle={pageTitleMap[activePage] || 'HayBike ERP Pro'}
        userRole={userRole}
        cashierName={cashierName}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onRefresh={() => {
          showToast('Data disinkronkan!', 'success');
        }}
      />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Background Watermark Pattern (Transparent icon.png) */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-15 bg-repeat mix-blend-multiply transition-opacity duration-300"
          style={{
            backgroundImage: "url('/icon.png')",
            backgroundSize: '160px 160px',
            backgroundPosition: 'center center'
          }}
        ></div>

        {/* Floating Decorative Sporty Watermarks */}
        <div className="absolute -top-12 -right-12 w-96 h-96 bg-emerald-300/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-96 h-96 bg-teal-300/20 rounded-full blur-3xl pointer-events-none"></div>

        {/* Sidebar */}
        <Sidebar
          activePage={activePage}
          userRole={userRole}
          cashierName={cashierName}
          onSelectPage={(page) => {
            setActivePage(page);
            if (window.innerWidth < 768) {
              setSidebarOpen(false);
            }
          }}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />

        {/* Content View */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-6 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-green-50/80 relative z-10">

          {halamanDitolak ? (
            <div className="max-w-md mx-auto mt-10 bg-white border border-rose-200 rounded-2xl p-6 text-center shadow-sm">
              <i className="fa-solid fa-lock text-3xl text-rose-500 mb-3 block"></i>
              <h3 className="font-bold text-rose-900 text-sm mb-1">Akses Ditolak</h3>
              <p className="text-xs text-slate-600">
                Halaman ini hanya untuk Pemilik / Admin toko. Silakan kembali ke menu Kasir POS.
              </p>
              <button
                type="button"
                onClick={() => setActivePage('kasir')}
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Kembali ke Kasir POS
              </button>
            </div>
          ) : null}

          {!halamanDitolak && activePage === 'dashboard' && (
            <DashboardModule
              onNavigate={setActivePage}
              onOpenPayModalPiutang={(item: PiutangItem) =>
                setPayModalItem({
                  id: item.id,
                  type: 'piutang',
                  title: `Terima Piutang: ${item.namaPembeli}`,
                  sisa: item.sisa
                })
              }
              onOpenPayModalUtang={(item: UtangItem) =>
                setPayModalItem({
                  id: item.id,
                  type: 'utang',
                  title: `Bayar Utang Supplier: ${item.namaSupplier || item.id}`,
                  sisa: item.sisa
                })
              }
            />
          )}

          {!halamanDitolak && activePage === 'kasir' && (
            <KasirModule
              paymentMethods={paymentMethods}
              userRole={userRole}
              cashierName={cashierName}
              initialTab="barang"
              standaloneView={false}
              onOpenReceipt={(title, data, type) => setPrintData({ title, data, type })}
              onOpenPayModal={(type, item) =>
                setPayModalItem({
                  id: item.id,
                  type: 'piutang',
                  title: `Terima Piutang: ${item.namaPembeli}`,
                  sisa: item.sisa
                })
              }
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'riwayat-kasir' && (
            <KasirModule
              paymentMethods={paymentMethods}
              userRole={userRole}
              cashierName={cashierName}
              initialTab="riwayat"
              standaloneView={true}
              onOpenReceipt={(title, data, type) => setPrintData({ title, data, type })}
              onOpenPayModal={(type, item) =>
                setPayModalItem({
                  id: item.id,
                  type: 'piutang',
                  title: `Terima Piutang: ${item.namaPembeli}`,
                  sisa: item.sisa
                })
              }
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'laporan-kasir' && (
            <KasirModule
              paymentMethods={paymentMethods}
              userRole={userRole}
              cashierName={cashierName}
              initialTab="laporan_harian"
              standaloneView={true}
              onOpenReceipt={(title, data, type) => setPrintData({ title, data, type })}
              onOpenPayModal={(type, item) =>
                setPayModalItem({
                  id: item.id,
                  type: 'piutang',
                  title: `Terima Piutang: ${item.namaPembeli}`,
                  sisa: item.sisa
                })
              }
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'penerimaan' && (
            <PenerimaanModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'pengeluaran' && (
            <PengeluaranModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'mutasi' && (
            <MutasiModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'utang-piutang' && (
            <UtangPiutangModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'stok' && (
            <StokModule
              paymentMethods={paymentMethods}
              userRole={userRole}
              onOpenPayModalUtang={(item: UtangItem) =>
                setPayModalItem({
                  id: item.id,
                  type: 'utang',
                  title: `Bayar Utang Supplier: ${item.namaSupplier || item.id}`,
                  sisa: item.sisa
                })
              }
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'pembelian' && (
            <PembelianUtangModule
              onNavigate={setActivePage}
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'opname-stok' && (
            <OpnameModule
              onNavigate={setActivePage}
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'payroll' && (
            <PayrollModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'jurnal' && <JurnalModule />}

          {!halamanDitolak && activePage === 'laporan-akuntansi' && (
            <LaporanAkuntansiModule
              accounts={accounts}
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'master-akun' && (
            <MasterAkunModule
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'pengaturan' && (
            <SettingsModule
              settings={appSettings}
              initialTab="profil"
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}

          {!halamanDitolak && activePage === 'pembuatan-akun' && (
            <SettingsModule
              settings={appSettings}
              initialTab="akun"
              onSuccess={(msg) => showToast(msg, 'success')}
              onError={(msg) => showToast(msg, 'error')}
            />
          )}
        </main>
      </div>
    </div>
  );
}

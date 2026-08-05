import React from 'react';
import sidebarBg from '../assets/images/icon_1784888441655.jpg';

export type PageName =
  | 'dashboard'
  | 'kasir'
  | 'riwayat-kasir'
  | 'laporan-kasir'
  | 'penerimaan'
  | 'pengeluaran'
  | 'mutasi'
  | 'utang-piutang'
  | 'stok'
  | 'pembelian'
  | 'opname-stok'
  | 'payroll'
  | 'jurnal'
  | 'laporan-akuntansi'
  | 'master-akun'
  | 'pengaturan'
  | 'pembuatan-akun';

interface SidebarProps {
  activePage: string;
  isOpen: boolean;
  userRole?: 'admin' | 'kasir';
  cashierName?: string;
  onSelectPage: (page: string) => void;
  onClose?: () => void;
  onLogout: () => void;
}

interface NavGroup {
  category: string;
  items: {
    id: PageName;
    label: string;
    icon: string;
    badge?: string;
    adminOnly?: boolean;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    category: 'UTAMA',
    items: [{ id: 'dashboard', label: 'Executive Dashboard', icon: 'fa-solid fa-chart-pie', adminOnly: true }]
  },
  {
    category: 'KASIR & PENJUALAN',
    items: [
      { id: 'kasir', label: 'Kasir POS & Penjualan', icon: 'fa-solid fa-cash-register', badge: 'POS UTAMA' },
      { id: 'riwayat-kasir', label: 'Riwayat & Struk Penjualan', icon: 'fa-solid fa-clock-rotate-left' },
      { id: 'laporan-kasir', label: 'Laporan Harian Kasir', icon: 'fa-solid fa-chart-line' }
    ]
  },
  {
    category: 'STOK & KATALOG',
    items: [
      { id: 'stok', label: 'Cek Stok & Harga Barang', icon: 'fa-solid fa-boxes-stacked' }
    ]
  },
  {
    category: 'OPERASIONAL KAS/BANK',
    items: [
      { id: 'penerimaan', label: 'Penerimaan Uang (Masuk)', icon: 'fa-solid fa-circle-arrow-down', adminOnly: true },
      { id: 'pengeluaran', label: 'Pengeluaran Uang (Keluar)', icon: 'fa-solid fa-circle-arrow-up', adminOnly: true },
      { id: 'mutasi', label: 'Mutasi Kas & Rekening', icon: 'fa-solid fa-right-left', adminOnly: true }
    ]
  },
  {
    category: 'UTANG & PIUTANG',
    items: [
      { id: 'utang-piutang', label: 'Kelola Utang & Piutang', icon: 'fa-solid fa-handshake-simple', adminOnly: true }
    ]
  },
  {
    category: 'PEMBELIAN & OPNAME',
    items: [
      { id: 'pembelian', label: 'Pembelian & Stok Masuk', icon: 'fa-solid fa-truck-field', adminOnly: true },
      { id: 'opname-stok', label: 'Stok Opname (Audit)', icon: 'fa-solid fa-clipboard-check', adminOnly: true }
    ]
  },
  {
    category: 'PAYROLL',
    items: [
      { id: 'payroll', label: 'Gaji Staff & Mekanik', icon: 'fa-solid fa-users-gear', adminOnly: true }
    ]
  },
  {
    category: 'KEUANGAN & AKUNTANSI',
    items: [
      { id: 'jurnal', label: 'Jurnal Umum Transaksi', icon: 'fa-solid fa-book-bookmark', adminOnly: true },
      { id: 'laporan-akuntansi', label: 'Laporan Keuangan & Akuntansi', icon: 'fa-solid fa-file-invoice-dollar', adminOnly: true }
    ]
  },
  {
    category: 'PENGATURAN',
    items: [
      { id: 'master-akun', label: 'Master COA Akun', icon: 'fa-solid fa-sitemap', adminOnly: true },
      { id: 'pengaturan', label: 'Profil Toko & Struk', icon: 'fa-solid fa-sliders', adminOnly: true },
      { id: 'pembuatan-akun', label: 'Pembuatan Akun', icon: 'fa-solid fa-user-plus', adminOnly: true }
    ]
  }
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  isOpen,
  userRole = 'admin',
  cashierName = 'Kasir',
  onSelectPage,
  onClose,
  onLogout
}) => {
  return (
    <>
      {/* Mobile Backdrop Overlay with smooth fade */}
      <div
        className={`fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-30 transition-opacity duration-300 ease-in-out md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      <aside
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.70), rgba(2, 6, 23, 0.85)), url(${sidebarBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
        className={`text-slate-200 w-64 min-w-[256px] h-full flex flex-col z-40 shadow-2xl border-r border-slate-800/80 shrink-0 transition-all duration-300 ease-in-out transform ${
          isOpen
            ? 'fixed md:static inset-y-0 left-0 translate-x-0 md:ml-0'
            : 'fixed md:static inset-y-0 left-0 -translate-x-full md:translate-x-0 md:-ml-64'
        }`}
      >
        {/* BRAND HEADER */}
        <div className="p-3 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden relative">
          {/* Mobile Close Button */}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              title="Tutup Sidebar"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          )}

          <img
            src="/logo.png"
            alt="Logo"
            className="w-full h-auto max-h-12 object-contain mx-auto py-0.5"
          />
          {/* User Role Banner */}
          <div className="w-full mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] px-1">
            <div className="flex items-center gap-1.5 truncate">
              <span
                className={`w-2 h-2 rounded-full ${
                  userRole === 'kasir' ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400 animate-pulse'
                }`}
              ></span>
              <span className="font-bold truncate text-slate-200">
                {userRole === 'kasir' ? `Kasir: ${cashierName}` : 'Role: Pemilik / Admin'}
              </span>
            </div>
            <span
              className={`px-1.5 py-0.5 rounded font-black tracking-wider uppercase text-[9px] ${
                userRole === 'kasir'
                  ? 'bg-cyan-900/80 text-cyan-300 border border-cyan-400/30'
                  : 'bg-emerald-900/80 text-emerald-300 border border-emerald-400/30'
              }`}
            >
              {userRole === 'kasir' ? 'KASIR' : 'ADMIN'}
            </span>
          </div>
        </div>

        {/* NAVIGATION GROUP LIST */}
        <nav className="flex-1 py-3 overflow-y-auto px-2 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
          {NAV_GROUPS.map((group) => {
            const visibleItems = group.items.filter((item) => userRole !== 'kasir' || !item.adminOnly);
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.category} className="space-y-1">
                <div className="px-3 text-[10px] font-extrabold text-slate-400 tracking-wider uppercase mb-1 flex items-center justify-between">
                  <span>{group.category}</span>
                </div>
                {visibleItems.map((item) => {
                  const isActive = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectPage(item.id)}
                      className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs font-semibold transition-all duration-200 ease-in-out group ${
                        isActive
                          ? userRole === 'kasir'
                            ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white font-bold shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-400/40 translate-x-1'
                            : 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-bold shadow-md shadow-emerald-950 translate-x-1'
                          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white hover:translate-x-1'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <i
                          className={`${item.icon} w-4 text-center transition-transform duration-200 group-hover:scale-110 ${
                            isActive
                              ? 'text-white'
                              : userRole === 'kasir'
                              ? 'text-cyan-400 group-hover:text-cyan-300'
                              : 'text-emerald-400 group-hover:text-emerald-300'
                          }`}
                        ></i>
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase transition-colors ${
                            isActive
                              ? 'bg-white text-cyan-900'
                              : userRole === 'kasir'
                              ? 'bg-cyan-900/60 text-cyan-300 border border-cyan-500/30'
                              : 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* FOOTER USER / LOGOUT */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-2 px-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-slate-300 text-[10px] font-medium">System Online</span>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono font-bold">
              {userRole === 'kasir' ? 'POS Online' : 'ERP Full'}
            </span>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full px-3 py-2 rounded-xl text-rose-300 hover:text-white hover:bg-rose-900/40 active:scale-98 text-xs font-bold flex items-center justify-center gap-2 transition duration-200 border border-rose-500/20 cursor-pointer"
          >
            <i className="fa-solid fa-right-from-bracket"></i>
            Keluar Sistem (Logout)
          </button>
        </div>
      </aside>
    </>
  );
};

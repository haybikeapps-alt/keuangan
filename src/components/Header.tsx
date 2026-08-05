import React from 'react';

interface HeaderProps {
  pageTitle: string;
  userRole?: 'admin' | 'kasir';
  cashierName?: string;
  onToggleSidebar: () => void;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({ pageTitle, userRole = 'admin', cashierName = 'Kasir', onToggleSidebar, onRefresh }) => {
  const dateStr = React.useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }, []);

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-emerald-100 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          title="Buka / Tutup Navigasi Sidebar"
          className="text-emerald-800 text-base p-1.5 rounded-xl hover:bg-emerald-100/80 active:scale-95 transition-all flex items-center justify-center cursor-pointer border border-emerald-200/60 shadow-sm"
        >
          <i className="fa-solid fa-bars text-emerald-700"></i>
        </button>
        <h2 className="text-sm font-bold text-emerald-900">{pageTitle}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
            userRole === 'kasir'
              ? 'bg-cyan-50 text-cyan-800 border border-cyan-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          <i
            className={`fa-solid ${
              userRole === 'kasir' ? 'fa-cash-register text-cyan-600' : 'fa-user-shield text-emerald-600'
            }`}
          ></i>
          <span>{userRole === 'kasir' ? `Kasir: ${cashierName}` : 'Role: Pemilik / Admin'}</span>
        </div>

        <span className="text-[11px] text-emerald-600 font-medium hidden md:block">
          <i className="fa-solid fa-calendar-day mr-1.5 text-emerald-500"></i>
          {dateStr}
        </span>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-lg border-2 border-emerald-200 text-emerald-900 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-600 transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-rotate text-emerald-500"></i>
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </header>
  );
};

import React, { useState, useEffect } from 'react';
import { Account } from '../../types';
import { subscribeAccounts, addAccount, updateAccount, deleteAccount } from '../../services/firebaseService';

interface MasterAkunModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const MasterAkunModule: React.FC<MasterAkunModuleProps> = ({ onSuccess, onError }) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKelompok, setFilterKelompok] = useState<string>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formKode, setFormKode] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formKelompok, setFormKelompok] = useState('Beban');
  const [formKategori, setFormKategori] = useState('');

  useEffect(() => {
    const unsub = subscribeAccounts((accs) => {
      setAccounts(accs);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleOpenAdd = () => {
    setEditId(null);
    setFormKode('');
    setFormNama('');
    setFormKelompok('Beban');
    setFormKategori('');
    setShowModal(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setEditId(acc.id || null);
    setFormKode(acc.kode);
    setFormNama(acc.nama);
    setFormKelompok(acc.kelompok);
    setFormKategori(acc.kategori || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKode.trim() || !formNama.trim()) {
      onError('Kode dan Nama Akun wajib diisi!');
      return;
    }

    try {
      if (editId) {
        await updateAccount(editId, {
          kode: formKode.trim(),
          nama: formNama.trim().toUpperCase(),
          kelompok: formKelompok,
          kategori: formKategori.trim()
        });
        onSuccess('Akun berhasil diperbarui!');
      } else {
        await addAccount({
          kode: formKode.trim(),
          nama: formNama.trim().toUpperCase(),
          kelompok: formKelompok,
          kategori: formKategori.trim()
        });
        onSuccess('Akun baru berhasil ditambahkan!');
      }
      setShowModal(false);
    } catch (err: any) {
      onError(err.message || 'Gagal menyimpan akun');
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Yakin ingin menghapus akun ini dari Chart of Accounts?')) return;
    try {
      await deleteAccount(id);
      onSuccess('Akun berhasil dihapus');
    } catch (err: any) {
      onError(err.message || 'Gagal menghapus akun');
    }
  };

  const filtered = accounts.filter((a) => {
    const matchSearch =
      a.kode.toLowerCase().includes(search.toLowerCase()) ||
      a.nama.toLowerCase().includes(search.toLowerCase()) ||
      (a.kategori || '').toLowerCase().includes(search.toLowerCase());
    const matchKel = filterKelompok === 'ALL' || a.kelompok === filterKelompok;
    return matchSearch && matchKel;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-900 to-slate-900 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-emerald-300 text-2xl shrink-0">
            <i className="fa-solid fa-sitemap"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold">Master Akun (Chart of Accounts / COA)</h2>
            <p className="text-xs text-emerald-200">
              Kelola struktur bagan akun standar akuntansi untuk Kas, Bank, Piutang, Utang, Modal, Pendapatan, dan Beban.
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-extrabold rounded-xl text-xs transition shadow-md flex items-center gap-2 shrink-0"
        >
          <i className="fa-solid fa-plus-circle text-sm"></i>
          Tambah Akun Baru
        </button>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col sm:flex-row justify-between gap-3">
        <div className="flex-1 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode akun, nama, atau kategori..."
            className="w-full pl-9 pr-3 py-2 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="flex gap-2 items-center overflow-x-auto pb-1 sm:pb-0">
          {['ALL', 'Aset', 'Kewajiban', 'Modal', 'Pendapatan', 'HPP', 'Beban'].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilterKelompok(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                filterKelompok === k
                  ? 'bg-emerald-800 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              {k === 'ALL' ? 'Semua Kelompok' : k}
            </button>
          ))}
        </div>
      </div>

      {/* ACCOUNT LIST TABLE */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-emerald-600 text-xs">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>
            Memuat daftar Chart of Accounts...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs">
            <i className="fa-solid fa-folder-open text-3xl mb-2 text-emerald-200 block"></i>
            Tidak ada akun yang sesuai pencarian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-emerald-900 text-emerald-100 text-[11px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="p-3">Kode Akun</th>
                  <th className="p-3">Nama Akun</th>
                  <th className="p-3">Kelompok Header</th>
                  <th className="p-3">Kategori Detail</th>
                  <th className="p-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50 font-medium">
                {filtered.map((acc, idx) => (
                  <tr key={acc.id || `${acc.kode}-${idx}`} className="hover:bg-emerald-50/50 transition">
                    <td className="p-3 font-mono font-bold text-emerald-900">{acc.kode}</td>
                    <td className="p-3 font-bold text-gray-800">{acc.nama}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          acc.kelompok === 'Aset'
                            ? 'bg-blue-100 text-blue-800'
                            : acc.kelompok === 'Kewajiban'
                            ? 'bg-amber-100 text-amber-800'
                            : acc.kelompok === 'Modal'
                            ? 'bg-purple-100 text-purple-800'
                            : acc.kelompok === 'Pendapatan'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {acc.kelompok}
                      </span>
                    </td>
                    <td className="p-3 text-gray-500">{acc.kategori || '-'}</td>
                    <td className="p-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded font-bold text-[10px]"
                      >
                        <i className="fa-solid fa-pen-to-square"></i> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(acc.id)}
                        className="px-2 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded font-bold text-[10px]"
                      >
                        <i className="fa-solid fa-trash"></i> Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ADD/EDIT */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-900 text-white p-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <i className="fa-solid fa-pen-nib text-emerald-300"></i>
                {editId ? 'Edit Akun Akuntansi' : 'Tambah Akun Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-emerald-200 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Kode Akun <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formKode}
                  onChange={(e) => setFormKode(e.target.value)}
                  placeholder="Contoh: 1-1001"
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Nama Akun <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  placeholder="Contoh: KAS TOKO UTAMA"
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Kelompok Utama <span className="text-red-500">*</span></label>
                <select
                  value={formKelompok}
                  onChange={(e) => setFormKelompok(e.target.value)}
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500 font-bold bg-white"
                >
                  <option value="Aset">Aset (Harta)</option>
                  <option value="Kewajiban">Kewajiban (Utang)</option>
                  <option value="Modal">Modal (Ekuitas)</option>
                  <option value="Pendapatan">Pendapatan</option>
                  <option value="HPP">Harga Pokok Penjualan (HPP)</option>
                  <option value="Beban">Beban Operasional</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Kategori Detail (Opsional)</label>
                <input
                  type="text"
                  value={formKategori}
                  onChange={(e) => setFormKategori(e.target.value)}
                  placeholder="Contoh: Aset Lancar / Beban Operasional"
                  className="w-full px-3 py-2 border border-emerald-200 rounded-lg focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold shadow-sm"
                >
                  Simpan Akun
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

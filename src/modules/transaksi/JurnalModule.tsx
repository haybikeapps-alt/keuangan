import React, { useState, useEffect } from 'react';
import { formatISO, formatRupiah, getJurnal } from '../../services/firebaseService';
import { JournalEntry } from '../../types';

export const JurnalModule: React.FC = () => {
  const [sDate, setSDate] = useState(() => {
    const n = new Date();
    return formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
  });
  const [eDate, setEDate] = useState(() => formatISO(new Date()));
  const [search, setSearch] = useState('');

  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJurnal = async (start = sDate, end = eDate) => {
    setLoading(true);
    try {
      const res = await getJurnal(start, end);
      setJournals(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJurnal();
  }, []);

  const handleBulanIni = () => {
    const n = new Date();
    const s = formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
    const e = formatISO(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    setSDate(s);
    setEDate(e);
    fetchJurnal(s, e);
  };

  const filtered = journals.filter((j) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      j.bukti.toLowerCase().includes(q) ||
      j.debit.toLowerCase().includes(q) ||
      j.kredit.toLowerCase().includes(q) ||
      j.ket.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
        <input
          type="date"
          value={sDate}
          onChange={(e) => setSDate(e.target.value)}
          className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
        />
        <span className="text-emerald-700 font-semibold text-xs">s/d</span>
        <input
          type="date"
          value={eDate}
          onChange={(e) => setEDate(e.target.value)}
          className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
        />
        <button
          type="button"
          onClick={() => fetchJurnal()}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-filter"></i> Tampilkan
        </button>
        <button
          type="button"
          onClick={handleBulanIni}
          className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition"
        >
          Bulan Ini
        </button>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari kata kunci..."
          className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500 bg-white ml-auto max-w-xs"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-100/70 text-emerald-900 border-b border-emerald-200 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-3 whitespace-nowrap">Tanggal</th>
                <th className="p-3">No Bukti</th>
                <th className="p-3">Akun Debit</th>
                <th className="p-3">Akun Kredit</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-emerald-600">
                    <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                    Memuat jurnal umum...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-emerald-400">
                    Tidak ada jurnal pada periode ini
                  </td>
                </tr>
              ) : (
                filtered.map((j, i) => (
                  <tr key={i} className="hover:bg-emerald-50/50">
                    <td className="p-3 text-gray-700 whitespace-nowrap font-medium">{j.tanggal}</td>
                    <td className="p-3 font-mono text-[10px] text-emerald-700 font-semibold">{j.bukti}</td>
                    <td className="p-3 font-semibold text-blue-900">{j.debit}</td>
                    <td className="p-3 font-semibold text-emerald-800">{j.kredit}</td>
                    <td className="p-3 text-gray-700 font-medium">{j.ket}</td>
                    <td className="p-3 text-right font-bold text-emerald-900">{formatRupiah(j.nominal)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

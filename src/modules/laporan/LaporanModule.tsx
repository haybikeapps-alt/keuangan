import React, { useState, useEffect } from 'react';
import { formatISO, formatRupiah, getLaporan } from '../../services/firebaseService';
import { LaporanLabaRugi } from '../../types';

interface LaporanModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const LaporanModule: React.FC<LaporanModuleProps> = ({ onSuccess, onError }) => {
  const [sDate, setSDate] = useState(() => {
    const n = new Date();
    return formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
  });
  const [eDate, setEDate] = useState(() => formatISO(new Date()));

  const [data, setData] = useState<LaporanLabaRugi | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchLaporan = async (start = sDate, end = eDate) => {
    setLoading(true);
    try {
      const res = await getLaporan(start, end);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLaporan();
  }, []);

  const handleBulanIni = () => {
    const n = new Date();
    const s = formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
    const e = formatISO(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    setSDate(s);
    setEDate(e);
    fetchLaporan(s, e);
  };

  const handleDownloadCSV = () => {
    if (!data) {
      onError('Tidak ada data laporan');
      return;
    }

    let csv = 'KOMPONEN,NAMA AKUN,NOMINAL\n';
    Object.entries(data.pend).forEach(([k, v]) => {
      csv += `"Pendapatan","${k}",${v}\n`;
    });
    csv += `"","Total Pendapatan",${data.tp}\n\n`;

    Object.entries(data.hpp).forEach(([k, v]) => {
      csv += `"HPP","${k}",${v}\n`;
    });
    csv += `"","Total HPP",${data.th}\n\n`;

    csv += `"","Laba Kotor",${data.tp - data.th}\n\n`;

    Object.entries(data.beban).forEach(([k, v]) => {
      csv += `"Beban Operasional","${k}",${v}\n`;
    });
    csv += `"","Total Beban Operasional",${data.tb}\n\n`;

    csv += `"","LABA BERSIH",${data.lr}\n`;

    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_LR_${sDate}_sd_${eDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onSuccess('File CSV berhasil diunduh!');
  };

  const labaKotor = data ? data.tp - data.th : 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
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
          onClick={() => fetchLaporan()}
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

        <button
          type="button"
          onClick={handleDownloadCSV}
          className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold transition ml-auto flex items-center gap-1.5"
        >
          <i className="fa-solid fa-file-csv text-emerald-600"></i> Unduh CSV
        </button>
      </div>

      {/* Laporan Card */}
      <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm space-y-6">
        <div className="text-center pb-4 border-b-2 border-emerald-100">
          <h2 className="text-lg font-black text-emerald-950 tracking-wide">TOKO HAYBIKE</h2>
          <p className="text-sm font-bold text-emerald-800">LAPORAN LABA RUGI</p>
          <p className="text-xs text-emerald-600 font-medium">Periode: {sDate} s/d {eDate}</p>
        </div>

        {loading ? (
          <div className="text-center py-12 text-emerald-600">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-1 block"></i>
            <p className="text-xs font-semibold">Kalkulasi laba rugi real-time...</p>
          </div>
        ) : !data ? null : (
          <div className="space-y-5 text-xs">
            {/* PENDAPATAN */}
            <div>
              <div className="flex justify-between font-bold text-emerald-900 border-b-2 border-emerald-400 pb-1 mb-2">
                <span>PENDAPATAN USULAN</span>
                <span>{formatRupiah(data.tp)}</span>
              </div>
              {Object.keys(data.pend || {}).length === 0 ? (
                <p className="text-gray-400 pl-4 py-1 italic">Tidak ada pendapatan</p>
              ) : (
                Object.entries(data.pend || {}).map(([k, v], idx) => (
                  <div key={k} className="flex justify-between py-1 pl-4 border-b border-emerald-50">
                    <span className="text-gray-700 font-medium">{idx + 1}. {k}</span>
                    <span className="font-semibold text-emerald-900">{formatRupiah(Number(v))}</span>
                  </div>
                ))
              )}
            </div>

            {/* HPP */}
            <div>
              <div className="flex justify-between font-bold text-emerald-900 border-b-2 border-emerald-400 pb-1 mb-2">
                <span>HARGA POKOK PENJUALAN (HPP)</span>
                <span>{formatRupiah(data.th)}</span>
              </div>
              {Object.keys(data.hpp || {}).length === 0 ? (
                <p className="text-gray-400 pl-4 py-1 italic">Tidak ada HPP</p>
              ) : (
                Object.entries(data.hpp || {}).map(([k, v], idx) => (
                  <div key={k} className="flex justify-between py-1 pl-4 border-b border-emerald-50">
                    <span className="text-gray-700 font-medium">{idx + 1}. {k}</span>
                    <span className="font-semibold text-emerald-900">{formatRupiah(Number(v))}</span>
                  </div>
                ))
              )}
            </div>

            {/* LABA KOTOR */}
            <div className="flex justify-between font-bold text-sm bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-emerald-900">LABA KOTOR</span>
              <span className="text-emerald-700">{formatRupiah(labaKotor)}</span>
            </div>

            {/* BEBAN */}
            <div>
              <div className="flex justify-between font-bold text-emerald-900 border-b-2 border-emerald-400 pb-1 mb-2">
                <span>BEBAN OPERASIONAL</span>
                <span>{formatRupiah(data.tb)}</span>
              </div>
              {Object.keys(data.beban || {}).length === 0 ? (
                <p className="text-gray-400 pl-4 py-1 italic">Tidak ada beban operasional</p>
              ) : (
                Object.entries(data.beban || {}).map(([k, v], idx) => (
                  <div key={k} className="flex justify-between py-1 pl-4 border-b border-emerald-50">
                    <span className="text-gray-700 font-medium">{idx + 1}. {k}</span>
                    <span className="font-semibold text-emerald-900">{formatRupiah(Number(v))}</span>
                  </div>
                ))
              )}
            </div>

            {/* LABA BERSIH */}
            <div
              className={`flex justify-between font-black text-sm p-4 rounded-xl text-white shadow-lg ${
                data.lr >= 0 ? 'bg-emerald-600' : 'bg-red-600'
              }`}
            >
              <span>{data.lr >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH'}</span>
              <span>{formatRupiah(Math.abs(data.lr))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

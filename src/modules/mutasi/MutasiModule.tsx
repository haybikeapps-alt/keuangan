import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  getSaldoKasBank,
  getMutasiKasBank,
  saveMutasiKasBank
} from '../../services/firebaseService';
import { MutasiKasBank } from '../../types';

interface MutasiModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const MutasiModule: React.FC<MutasiModuleProps> = ({ onSuccess, onError }) => {
  const [mtType, setMtType] = useState<'kb' | 'bk'>('kb');
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [bank, setBank] = useState('BANK BRI');
  const [nominal, setNominal] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const [sDate, setSDate] = useState(() => formatISO(new Date()));
  const [eDate, setEDate] = useState(() => formatISO(new Date()));

  const [balances, setBalances] = useState<Record<string, number>>({});
  const [history, setHistory] = useState<MutasiKasBank[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadSaldo();
    loadHistory();
  }, []);

  const loadSaldo = async () => {
    try {
      const res = await getSaldoKasBank();
      setBalances(res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async (start = sDate, end = eDate) => {
    setLoadingHistory(true);
    try {
      const res = await getMutasiKasBank(start, end);
      setHistory(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleHariIni = () => {
    const t = formatISO(new Date());
    setSDate(t);
    setEDate(t);
    loadHistory(t, t);
  };

  const handleBulanIni = () => {
    const n = new Date();
    const s = formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
    const e = formatISO(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    setSDate(s);
    setEDate(e);
    loadHistory(s, e);
  };

  const handleSubmitMutasi = async () => {
    if (!tgl) {
      onError('Isi tanggal mutasi!');
      return;
    }
    if (!bank) {
      onError('Pilih bank!');
      return;
    }
    const num = parseInt(nominal.replace(/\D/g, '')) || 0;
    if (num <= 0) {
      onError('Nominal mutasi harus lebih dari 0!');
      return;
    }

    const defaultKet = mtType === 'kb' ? `Setoran ke ${bank}` : `Tarik tunai dari ${bank}`;
    const finalKet = keterangan.trim() || defaultKet;
    const tipeLabel = mtType === 'kb' ? 'Kas ke Bank' : 'Bank ke Kas';

    if (!window.confirm(`${tipeLabel} ${bank} sebesar ${formatRupiah(num)}?`)) return;

    setIsSubmitting(true);
    try {
      const res = await saveMutasiKasBank(
        JSON.stringify({
          tanggal: tgl,
          tipe: tipeLabel,
          bank,
          nominal: num,
          keterangan: finalKet
        })
      );

      if (res && res.ok) {
        onSuccess(`Mutasi kas/bank berhasil! No Bukti: ${res.id}`);
        setNominal('');
        setKeterangan('');
        loadSaldo();
        loadHistory();
      } else {
        onError(res?.msg || 'Gagal menyimpan mutasi');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bankOrder = ['KAS', 'BANK BRI', 'BANK MANDIRI', 'BANK BNI', 'BANK LAINNYA'];
  const totalLiquid = bankOrder.reduce((sum, key) => sum + (balances[key] || 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* INPUT FORM */}
        <div className="lg:col-span-2 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-right-left text-emerald-500"></i>
            Input Mutasi Kas / Bank
          </h3>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMtType('kb')}
              className={`p-3 rounded-xl border-2 font-bold text-xs transition flex flex-col items-center justify-center gap-1 ${
                mtType === 'kb'
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-emerald-200 text-emerald-800 hover:border-emerald-400'
              }`}
            >
              <i className="fa-solid fa-money-bill-transfer text-base text-blue-600"></i>
              <span>Kas ke Bank</span>
              <span className="text-[9px] font-normal text-gray-500">(Setoran Tunai)</span>
            </button>

            <button
              type="button"
              onClick={() => setMtType('bk')}
              className={`p-3 rounded-xl border-2 font-bold text-xs transition flex flex-col items-center justify-center gap-1 ${
                mtType === 'bk'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
                  : 'border-emerald-200 text-emerald-800 hover:border-emerald-400'
              }`}
            >
              <i className="fa-solid fa-building-columns text-base text-emerald-600"></i>
              <span>Bank ke Kas</span>
              <span className="text-[9px] font-normal text-gray-500">(Tarik Tunai)</span>
            </button>
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Tanggal</label>
            <input
              type="date"
              value={tgl}
              onChange={(e) => setTgl(e.target.value)}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">
              {mtType === 'kb' ? 'Pilih Bank Tujuan *' : 'Pilih Bank Asal *'}
            </label>
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
            >
              <option>BANK BRI</option>
              <option>BANK MANDIRI</option>
              <option>BANK BNI</option>
              <option>BANK LAINNYA</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Nominal (Rp) *</label>
            <input
              type="text"
              value={nominal ? formatRupiah(parseInt(nominal.replace(/\D/g, '')) || 0) : ''}
              onChange={(e) => setNominal(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Keterangan</label>
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="Contoh: Setoran hasil penjualan harian"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitMutasi}
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {isSubmitting ? 'Memproses...' : 'Simpan Mutasi'}
          </button>
        </div>

        {/* SALDO CARDS */}
        <div className="lg:col-span-3 bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between space-y-3">
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-wallet text-emerald-500"></i>
                Informasi Saldo Real-Time
              </h3>
              <button
                type="button"
                onClick={loadSaldo}
                className="px-2.5 py-1 border border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {bankOrder.map((key) => {
                const val = balances[key] || 0;
                const shortName = key.replace('BANK ', '');
                const isKas = key === 'KAS';

                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 transition"
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${
                        isKas
                          ? 'bg-emerald-200 text-emerald-800'
                          : shortName === 'BRI'
                          ? 'bg-blue-100 text-blue-700'
                          : shortName === 'MANDIRI'
                          ? 'bg-amber-100 text-amber-800'
                          : shortName === 'BNI'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      <i className={isKas ? 'fa-solid fa-money-bill-wave' : 'fa-solid fa-building-columns'}></i>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-emerald-700">{shortName}</p>
                      <p className={`text-xs font-bold ${val >= 0 ? 'text-emerald-950' : 'text-red-500'}`}>
                        {formatRupiah(val)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t-2 border-emerald-200 flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <i className="fa-solid fa-coins text-amber-500"></i>
              Total Aset Likuid (Kas + Bank)
            </span>
            <span className={`text-lg font-black ${totalLiquid >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
              {formatRupiah(totalLiquid)}
            </span>
          </div>
        </div>
      </div>

      {/* MUTASI HISTORY */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={() => loadHistory()}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-filter"></i> Tampilkan
          </button>
          <button
            type="button"
            onClick={handleHariIni}
            className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition"
          >
            Hari Ini
          </button>
          <button
            type="button"
            onClick={handleBulanIni}
            className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition"
          >
            Bulan Ini
          </button>
          <span className="text-xs text-emerald-600 font-medium ml-auto">{history.length} transaksi</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-100/70 text-emerald-900 border-b border-emerald-200 uppercase font-bold text-[10px] tracking-wider">
                <th className="p-2.5">Tanggal</th>
                <th className="p-2.5">No Bukti</th>
                <th className="p-2.5">Arah Transfer</th>
                <th className="p-2.5">Bank</th>
                <th className="p-2.5">Keterangan</th>
                <th className="p-2.5 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50">
              {loadingHistory ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-emerald-600">
                    <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                    Memuat riwayat...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-emerald-400">
                    Belum ada riwayat mutasi
                  </td>
                </tr>
              ) : (
                history.map((h, i) => {
                  const isKB = h.tipe === 'Kas ke Bank';
                  return (
                    <tr key={i} className="hover:bg-emerald-50/50">
                      <td className="p-2.5 text-gray-700 whitespace-nowrap">{h.tanggal}</td>
                      <td className="p-2.5 font-mono text-[10px] text-emerald-700 font-semibold">{h.bukti}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isKB ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {isKB ? 'Kas → Bank' : 'Bank → Kas'}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-gray-800">{h.bank.replace('BANK ', '')}</td>
                      <td className="p-2.5 text-emerald-800">{h.keterangan}</td>
                      <td className="p-2.5 text-right font-bold text-emerald-900">{formatRupiah(h.nominal)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  getAkunDebitPengeluaran,
  getAkunKreditPengeluaran,
  savePengeluaran,
  getRecentPengeluaran
} from '../../services/firebaseService';

interface PengeluaranModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface HistoryItem {
  id: string;
  bukti: string;
  tanggal: string;
  akunDebit: string;
  akunKredit: string;
  keterangan: string;
  nominal: number;
}

export const PengeluaranModule: React.FC<PengeluaranModuleProps> = ({ onSuccess, onError }) => {
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [akunDebit, setAkunDebit] = useState(''); // Keperluan / Jenis Biaya (DEBIT)
  const [akunKredit, setAkunKredit] = useState(''); // Sumber Uang Pembayar (KREDIT)
  const [keterangan, setKeterangan] = useState('');
  const [nominal, setNominal] = useState('');

  const [debitOptions, setDebitOptions] = useState<string[]>([]);
  const [kreditOptions, setKreditOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const loadData = async () => {
    try {
      const [dOpts, kOpts] = await Promise.all([
        getAkunDebitPengeluaran(),
        getAkunKreditPengeluaran()
      ]);
      setDebitOptions(dOpts);
      if (dOpts.length > 0) setAkunDebit(dOpts[0]);

      setKreditOptions(kOpts);
      if (kOpts.length > 0) setAkunKredit(kOpts[0]);

      fetchHistory();
    } catch (e) {
      console.error('Error loading pengeluaran options:', e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const rec = await getRecentPengeluaran(20);
      setHistory(rec);
    } catch (err) {
      console.error('Error fetching pengeluaran history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const numNominal = parseInt(nominal.replace(/\D/g, '')) || 0;

  // Skenario Cepat Lapangan
  const applyPreset = (presetType: string) => {
    if (presetType === 'listrik') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('LISTRIK') || o.toUpperCase().includes('PDAM'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Bayar Tagihan Listrik PLN & Air PDAM Toko');
    } else if (presetType === 'gaji') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('GAJI'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Pembayaran Gaji / Uang Makan Staff & Mekanik Bengkel');
    } else if (presetType === 'transport') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('TRANSPORT'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Biaya Bensin, Tol & Ongkos Angkut / Ekspedisi Goods');
    } else if (presetType === 'perlengkapan') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('PERLENGKAPAN'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Beli Kertas Struk, Kantong Plastik & Perlengkapan Toko');
    } else if (presetType === 'utang') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('UTANG USAHA'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Pelunasan Tagihan Faktur Supplier / Distributor');
    } else if (presetType === 'prive') {
      const matched = debitOptions.find((o) => o.toUpperCase().includes('PRIVE'));
      if (matched) setAkunDebit(matched);
      setKeterangan('Pengambilan Kas Toko untuk Keperluan Pribadi Pemilik');
    }
  };

  const addAmount = (amount: number) => {
    const current = numNominal;
    setNominal(String(current + amount));
  };

  const handlePosting = async () => {
    if (!tgl || !akunDebit || !akunKredit || !nominal) {
      onError('Mohon lengkapi seluruh formulir pengeluaran!');
      return;
    }
    if (akunDebit === akunKredit) {
      onError('Keperluan Biaya dan Sumber Pembayaran Kas/Bank tidak boleh sama!');
      return;
    }
    if (numNominal <= 0) {
      onError('Nominal pengeluaran harus lebih dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePengeluaran(
        JSON.stringify({
          tanggal: tgl,
          akunDebit,
          akunKredit,
          keterangan: keterangan.trim() || 'Pengeluaran Kas/Bank',
          nominal: numNominal
        })
      );

      if (res && res.ok) {
        onSuccess(`Pengeluaran Uang Berhasil Dicatat! No. Bukti: ${res.id}`);
        setKeterangan('');
        setNominal('');
        fetchHistory();
      } else {
        onError('Gagal memposting pengeluaran');
      }
    } catch (e: any) {
      onError(e.message || 'Terjadi kesalahan saat memproses');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredHistory = history.filter((h) => {
    if (!searchHistory.trim()) return true;
    const q = searchHistory.toLowerCase();
    return (
      (h.bukti || '').toLowerCase().includes(q) ||
      (h.keterangan || '').toLowerCase().includes(q) ||
      (h.akunDebit || '').toLowerCase().includes(q) ||
      (h.akunKredit || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-gradient-to-r from-rose-800 via-rose-700 to-red-800 p-5 rounded-2xl text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-rose-200 text-2xl shrink-0">
              <i className="fa-solid fa-circle-arrow-up"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold">Pengeluaran & Biaya Operasional (Uang Keluar)</h2>
              <p className="text-xs text-rose-100">
                Pencatatan kas/bank untuk listrik, gaji, pelunasan utang supplier, transport, dan prive.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-rose-900/40 px-3 py-1.5 rounded-lg border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse"></span>
            <span className="font-medium text-rose-200">Format Praktis & Jurnal Otomatis</span>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INPUT FORM */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-rose-100 pb-3">
              <h3 className="font-bold text-rose-900 text-xs flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-minus"></i>
                </span>
                Formulir Pengeluaran Uang
              </h3>
              <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded font-semibold border border-rose-200">
                Uang Keluar (-)
              </span>
            </div>

            {/* PRESET SKENARIO LAPANGAN */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1.5">
                ⚡ Tombol Cepat Skenario Lapangan:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPreset('listrik')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  ⚡ Listrik & Air Toko
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('gaji')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  👥 Gaji & Bonus Staff
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('utang')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  🛒 Pelunasan Utang Supplier
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('transport')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  🚚 Bensin & Transport
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('perlengkapan')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  🏪 Perlengkapan Toko
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('prive')}
                  className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold border border-rose-200 transition flex items-center gap-1"
                >
                  🙋‍♂️ Tarik Prive Pemilik
                </button>
              </div>
            </div>

            {/* STEP 1: KEPERLUAN BIAYA (DEBIT) */}
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-file-invoice-dollar text-rose-600"></i>
                  1. Uang Digunakan Untuk Apa? (Keperluan / Jenis Biaya) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-rose-700 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded">
                  DEBIT
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Pilih jenis beban operasional, pelunasan utang supplier, atau penarikan prive.
              </p>
              <select
                value={akunDebit}
                onChange={(e) => setAkunDebit(e.target.value)}
                className="w-full mt-1 px-3 py-2 border-2 border-rose-200 rounded-lg text-xs font-bold focus:outline-none focus:border-rose-500 bg-white text-rose-900 shadow-sm"
              >
                {debitOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    📌 {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* STEP 2: REKENING PEMBAYAR (KREDIT) */}
            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-100 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-wallet text-rose-600"></i>
                  2. Dibayar Pakai Uang Dari Mana? (Kas / Bank Pembayar) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-rose-700 font-extrabold bg-rose-100 px-1.5 py-0.5 rounded">
                  KREDIT (-)
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Pilih kas toko atau rekening bank yang berkurang uangnya.
              </p>
              <select
                value={akunKredit}
                onChange={(e) => setAkunKredit(e.target.value)}
                className="w-full mt-1 px-3 py-2 border-2 border-rose-200 rounded-lg text-xs font-bold focus:outline-none focus:border-rose-500 bg-white text-rose-900 shadow-sm"
              >
                {kreditOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    💵 {opt} (Aset Berkurang)
                  </option>
                ))}
              </select>
            </div>

            {/* STEP 3: TANGGAL, NOMINAL, DETAIL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-rose-900 block mb-1">
                  📅 Tanggal Pengeluaran
                </label>
                <input
                  type="date"
                  value={tgl}
                  onChange={(e) => setTgl(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-rose-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-rose-900 block mb-1">
                  💰 Jumlah / Nominal Uang Keluar (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nominal ? formatRupiah(numNominal) : ''}
                  onChange={(e) => setNominal(e.target.value)}
                  placeholder="Rp 0"
                  className="w-full px-3 py-2 border-2 border-rose-200 rounded-lg text-xs font-bold focus:outline-none focus:border-rose-500 text-rose-900 bg-white"
                />
                <div className="flex gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => addAmount(20000)}
                    className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold"
                  >
                    +20rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(50000)}
                    className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold"
                  >
                    +50rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(100000)}
                    className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold"
                  >
                    +100rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(500000)}
                    className="px-2 py-0.5 rounded bg-rose-100 hover:bg-rose-200 text-rose-800 text-[10px] font-bold"
                  >
                    +500rb
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-rose-900 block mb-1">
                📝 Catatan / Keterangan Transaksi
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Bayar token listrik PLN toko bulan ini"
                className="w-full px-3 py-2 border-2 border-rose-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-rose-500 bg-white"
              />
            </div>

            {/* INFORMASI JURNAL AKUNTANSI OTOMATIS */}
            <div className="p-3.5 bg-gradient-to-r from-rose-50 to-red-50 rounded-xl border border-rose-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-rose-900">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-calculator text-rose-600"></i>
                  Aturan Akuntansi (Jurnal Otomatis)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-700 text-white text-[10px]">
                  Pengeluaran (Uang Keluar)
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-gray-700 pt-1 border-t border-rose-200/80">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600"><strong>DEBIT</strong> (Keperluan / Jenis Biaya):</span>
                  <span className="font-bold text-rose-900 bg-rose-100/70 px-2 py-0.5 rounded">
                    {akunDebit || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600"><strong>KREDIT</strong> (Kas / Bank Berkurang):</span>
                  <span className="font-bold text-rose-900 bg-rose-100/70 px-2 py-0.5 rounded">
                    {akunKredit || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-rose-200/60">
                  <span className="text-gray-600 font-medium">Nominal Transaksi:</span>
                  <span className="font-extrabold text-rose-700 text-sm">
                    {formatRupiah(numNominal)}
                  </span>
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={handlePosting}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fa-solid fa-check-circle text-sm"></i>
                {isSubmitting ? 'Memproses Pengeluaran...' : 'Simpan & Posting Pengeluaran'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeterangan('');
                  setNominal('');
                }}
                className="px-4 py-3 border-2 border-rose-200 text-rose-800 font-bold rounded-xl text-xs hover:bg-rose-50 transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORY */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-rose-100 pb-2.5">
              <h3 className="font-bold text-rose-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-rose-600"></i>
                Riwayat Pengeluaran Uang
              </h3>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-[10px] text-rose-700 hover:text-rose-900 font-bold flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari bukti, keterangan, atau akun..."
              className="w-full px-3 py-1.5 border border-rose-200 rounded-lg text-xs focus:outline-none focus:border-rose-500"
            />

            {loadingHistory ? (
              <div className="text-center py-8 text-rose-600 text-xs">
                <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                Memuat riwayat...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs bg-rose-50/30 rounded-xl border border-dashed border-rose-200">
                <i className="fa-solid fa-inbox text-2xl mb-1 text-rose-300 block"></i>
                Belum ada transaksi pengeluaran tercatat.
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-rose-100 bg-rose-50/20 hover:bg-rose-50/60 transition space-y-1"
                  >
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-rose-900 block">{item.bukti}</span>
                        <span className="text-[10px] text-gray-400">{item.tanggal}</span>
                      </div>
                      <span className="font-extrabold text-rose-700 text-xs bg-rose-100/80 px-2 py-0.5 rounded-full">
                        -{formatRupiah(item.nominal)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 font-medium line-clamp-2">
                      {item.keterangan || item.akunDebit}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-rose-100/80">
                      <span>📌 <strong>Dr:</strong> {item.akunDebit}</span>
                      <span>💵 <strong>Kr:</strong> {item.akunKredit}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

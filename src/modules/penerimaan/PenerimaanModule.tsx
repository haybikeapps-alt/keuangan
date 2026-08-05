import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  getAkunDebitPenerimaan,
  getAkunKreditPenerimaan,
  savePenerimaan,
  getRecentPenerimaan
} from '../../services/firebaseService';

interface PenerimaanModuleProps {
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

export const PenerimaanModule: React.FC<PenerimaanModuleProps> = ({ onSuccess, onError }) => {
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [akunDebit, setAkunDebit] = useState(''); // Kas / Rekening tempat uang diterima (DEBIT)
  const [akunKredit, setAkunKredit] = useState(''); // Kategori / Asal Uang (KREDIT)
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
        getAkunDebitPenerimaan(),
        getAkunKreditPenerimaan()
      ]);
      setDebitOptions(dOpts);
      if (dOpts.length > 0) setAkunDebit(dOpts[0]);

      setKreditOptions(kOpts);
      if (kOpts.length > 0) setAkunKredit(kOpts[0]);

      fetchHistory();
    } catch (e) {
      console.error('Error loading options:', e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const rec = await getRecentPenerimaan(20);
      setHistory(rec);
    } catch (err) {
      console.error('Error fetching history:', err);
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
    if (presetType === 'servis') {
      const matched = kreditOptions.find((o) => o.toUpperCase().includes('JASA') || o.toUpperCase().includes('PENDAPATAN'));
      if (matched) setAkunKredit(matched);
      setKeterangan('Penerimaan Ongkos Jasa Servis & Perbaikan Sepeda');
    } else if (presetType === 'piutang') {
      const matched = kreditOptions.find((o) => o.toUpperCase().includes('PIUTANG'));
      if (matched) setAkunKredit(matched);
      setKeterangan('Pelunasan Tagihan Piutang dari Pelanggan');
    } else if (presetType === 'modal') {
      const matched = kreditOptions.find((o) => o.toUpperCase().includes('MODAL'));
      if (matched) setAkunKredit(matched);
      setKeterangan('Setoran Tambahan Modal Usaha Pemilik');
    } else if (presetType === 'pinjaman') {
      const matched = kreditOptions.find((o) => o.toUpperCase().includes('UTANG') || o.toUpperCase().includes('BANK'));
      if (matched) setAkunKredit(matched);
      setKeterangan('Pencairan Pinjaman Kredit Modal Kerja Bank');
    } else if (presetType === 'lainnya') {
      const matched = kreditOptions.find((o) => o.toUpperCase().includes('LAIN'));
      if (matched) setAkunKredit(matched);
      setKeterangan('Penerimaan Pendapatan Lain-Lain Toko');
    }
  };

  const addAmount = (amount: number) => {
    const current = numNominal;
    setNominal(String(current + amount));
  };

  const handlePosting = async () => {
    if (!tgl || !akunDebit || !akunKredit || !nominal) {
      onError('Mohon lengkapi seluruh formulir penerimaan!');
      return;
    }
    if (akunDebit === akunKredit) {
      onError('Rekening Tujuan dan Kategori Sumber Uang tidak boleh sama!');
      return;
    }
    if (numNominal <= 0) {
      onError('Nominal uang masuk harus lebih dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePenerimaan(
        JSON.stringify({
          tanggal: tgl,
          akunDebit,
          akunKredit,
          keterangan: keterangan.trim() || 'Penerimaan Kas/Bank',
          nominal: numNominal
        })
      );

      if (res && res.ok) {
        onSuccess(`Penerimaan Uang Masuk Berhasil Dicatat! No. Bukti: ${res.id}`);
        setKeterangan('');
        setNominal('');
        fetchHistory();
      } else {
        onError('Gagal memposting penerimaan');
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
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 p-5 rounded-2xl text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-emerald-200 text-2xl shrink-0">
              <i className="fa-solid fa-circle-arrow-down"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold">Penerimaan Kas & Rekening (Uang Masuk)</h2>
              <p className="text-xs text-emerald-100">
                Pencatatan kas/bank untuk pendapatan servis, pelunasan piutang, setoran modal, dan pinjaman.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs bg-emerald-900/40 px-3 py-1.5 rounded-lg border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-emerald-200">Format Praktis & Jurnal Otomatis</span>
          </div>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: INPUT FORM */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
              <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-plus"></i>
                </span>
                Formulir Penerimaan Uang
              </h3>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold border border-emerald-200">
                Uang Masuk (+)
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
                  onClick={() => applyPreset('servis')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                >
                  🛠️ Ongkos Jasa Servis
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('piutang')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                >
                  🤝 Pelunasan Piutang
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('modal')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                >
                  💼 Setoran Modal Pemilik
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('pinjaman')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                >
                  🏦 Pencairan Pinjaman Bank
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('lainnya')}
                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition flex items-center gap-1"
                >
                  🎁 Pendapatan Lain-Lain
                </button>
              </div>
            </div>

            {/* STEP 1: REKENING PENERIMA (DEBIT) */}
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-wallet text-emerald-600"></i>
                  1. Uang Diterima Ke Mana? (Kas / Rekening Bank) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">
                  DEBIT (+)
                </span>
              </div>
              <p className="text-[11px] text-gray-500">Pilih rekening kas toko atau rekening bank tempat uang masuk.</p>
              <select
                value={akunDebit}
                onChange={(e) => setAkunDebit(e.target.value)}
                className="w-full mt-1 px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500 bg-white text-emerald-900 shadow-sm"
              >
                {debitOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    💵 {opt} (Aset Bertambah)
                  </option>
                ))}
              </select>
            </div>

            {/* STEP 2: ASAL UANG / KATEGORI (KREDIT) */}
            <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-tag text-emerald-600"></i>
                  2. Asal Uang / Kategori Sumber Penerimaan <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded">
                  KREDIT
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                Pilih jenis pendapatan, pelunasan piutang, setoran modal, atau pinjaman.
              </p>
              <select
                value={akunKredit}
                onChange={(e) => setAkunKredit(e.target.value)}
                className="w-full mt-1 px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500 bg-white text-emerald-900 shadow-sm"
              >
                {kreditOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    📊 {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* STEP 3: TANGGAL, NOMINAL, DETAIL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-emerald-900 block mb-1">
                  📅 Tanggal Penerimaan
                </label>
                <input
                  type="date"
                  value={tgl}
                  onChange={(e) => setTgl(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-900 block mb-1">
                  💰 Jumlah / Nominal Uang Masuk (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nominal ? formatRupiah(numNominal) : ''}
                  onChange={(e) => setNominal(e.target.value)}
                  placeholder="Rp 0"
                  className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-bold focus:outline-none focus:border-emerald-500 text-emerald-900 bg-white"
                />
                <div className="flex gap-1 mt-1.5">
                  <button
                    type="button"
                    onClick={() => addAmount(50000)}
                    className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold"
                  >
                    +50rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(100000)}
                    className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold"
                  >
                    +100rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(500000)}
                    className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold"
                  >
                    +500rb
                  </button>
                  <button
                    type="button"
                    onClick={() => addAmount(1000000)}
                    className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold"
                  >
                    +1Jt
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-emerald-900 block mb-1">
                📝 Catatan / Keterangan Transaksi
              </label>
              <input
                type="text"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                placeholder="Contoh: Pembayaran ongkos servis ganti rantai & tune-up Pak Budi"
                className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
              />
            </div>

            {/* INFORMASI JURNAL AKUNTANSI OTOMATIS */}
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                <span className="flex items-center gap-1.5">
                  <i className="fa-solid fa-calculator text-emerald-600"></i>
                  Aturan Akuntansi (Jurnal Otomatis)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px]">
                  Penerimaan (Uang Masuk)
                </span>
              </div>
              <div className="text-xs space-y-1.5 text-gray-700 pt-1 border-t border-emerald-200/80">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600"><strong>DEBIT</strong> (Kas / Bank Bertambah):</span>
                  <span className="font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {akunDebit || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600"><strong>KREDIT</strong> (Asal / Sumber Uang):</span>
                  <span className="font-bold text-emerald-900 bg-emerald-100/70 px-2 py-0.5 rounded">
                    {akunKredit || '-'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-emerald-200/60">
                  <span className="text-gray-600 font-medium">Nominal Transaksi:</span>
                  <span className="font-extrabold text-emerald-700 text-sm">
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
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fa-solid fa-check-circle text-sm"></i>
                {isSubmitting ? 'Memproses Penerimaan...' : 'Simpan & Posting Penerimaan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeterangan('');
                  setNominal('');
                }}
                className="px-4 py-3 border-2 border-emerald-200 text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-50 transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: HISTORY */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2.5">
              <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-emerald-600"></i>
                Riwayat Penerimaan Uang
              </h3>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari bukti, keterangan, atau akun..."
              className="w-full px-3 py-1.5 border border-emerald-200 rounded-lg text-xs focus:outline-none focus:border-emerald-500"
            />

            {loadingHistory ? (
              <div className="text-center py-8 text-emerald-600 text-xs">
                <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                Memuat riwayat...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs bg-emerald-50/30 rounded-xl border border-dashed border-emerald-200">
                <i className="fa-solid fa-inbox text-2xl mb-1 text-emerald-300 block"></i>
                Belum ada transaksi penerimaan tercatat.
              </div>
            ) : (
              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50/60 transition space-y-1"
                  >
                    <div className="flex justify-between items-start text-xs">
                      <div>
                        <span className="font-bold text-emerald-900 block">{item.bukti}</span>
                        <span className="text-[10px] text-gray-400">{item.tanggal}</span>
                      </div>
                      <span className="font-extrabold text-emerald-700 text-xs bg-emerald-100/80 px-2 py-0.5 rounded-full">
                        +{formatRupiah(item.nominal)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-700 font-medium line-clamp-2">
                      {item.keterangan || item.akunKredit}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1 border-t border-emerald-100/80">
                      <span>📥 <strong>Dr:</strong> {item.akunDebit}</span>
                      <span>📊 <strong>Kr:</strong> {item.akunKredit}</span>
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

import React, { useState, useEffect } from 'react';
import { formatISO, formatRupiah, getAkunKreditPengeluaran, savePayroll, getRecentPayroll } from '../../services/firebaseService';

interface PayrollModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface PayrollHistory {
  id: string;
  bukti: string;
  tanggal: string;
  namaKaryawan: string;
  jabatan: string;
  gajiPokok: number;
  uangMakan: number;
  bonusKomisi: number;
  potongan: number;
  totalGaji: number;
  metodeBayar: string;
}

export const PayrollModule: React.FC<PayrollModuleProps> = ({ onSuccess, onError }) => {
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [namaKaryawan, setNamaKaryawan] = useState('');
  const [jabatan, setJabatan] = useState('Mekanik Bengkel');
  const [gajiPokok, setGajiPokok] = useState('');
  const [uangMakan, setUangMakan] = useState('');
  const [bonusKomisi, setBonusKomisi] = useState('');
  const [potongan, setPotongan] = useState('');
  const [akunKredit, setAkunKredit] = useState('KAS'); // Sumber Pembayaran
  const [catatan, setCatatan] = useState('');

  const [paymentOptions, setPaymentOptions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [history, setHistory] = useState<PayrollHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');

  const loadData = async () => {
    try {
      const pOpts = await getAkunKreditPengeluaran();
      setPaymentOptions(pOpts);
      if (pOpts.length > 0) setAkunKredit(pOpts[0]);
      fetchHistory();
    } catch (e) {
      console.error('Error loading payroll options:', e);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const list = await getRecentPayroll(25);
      setHistory(list);
    } catch (e) {
      console.error('Error fetching payroll history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const numGajiPokok = parseInt(gajiPokok.replace(/\D/g, '')) || 0;
  const numUangMakan = parseInt(uangMakan.replace(/\D/g, '')) || 0;
  const numBonusKomisi = parseInt(bonusKomisi.replace(/\D/g, '')) || 0;
  const numPotongan = parseInt(potongan.replace(/\D/g, '')) || 0;

  const totalGaji = numGajiPokok + numUangMakan + numBonusKomisi - numPotongan;

  const applyPresetStaff = (nama: string, jbt: string, gapok: number, makan: number) => {
    setNamaKaryawan(nama);
    setJabatan(jbt);
    setGajiPokok(String(gapok));
    setUangMakan(String(makan));
    setBonusKomisi('');
    setPotongan('');
    setCatatan(`Gaji & Insentif Periode ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`);
  };

  const handlePosting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaKaryawan.trim()) {
      onError('Nama karyawan / mekanik wajib diisi!');
      return;
    }
    if (totalGaji <= 0) {
      onError('Total penerimaan gaji harus lebih dari Rp 0!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePayroll(
        JSON.stringify({
          tanggal: tgl,
          namaKaryawan: namaKaryawan.trim(),
          jabatan,
          gajiPokok: numGajiPokok,
          uangMakan: numUangMakan,
          bonusKomisi: numBonusKomisi,
          potongan: numPotongan,
          totalGaji,
          akunDebit: 'BEBAN GAJI KARYAWAN',
          akunKredit,
          catatan: catatan.trim() || `Slip Gaji ${namaKaryawan}`
        })
      );

      if (res && res.ok) {
        onSuccess(`Penggajian ${namaKaryawan} berhasil diposting ke Jurnal Umum! Bukti: ${res.id}`);
        setNamaKaryawan('');
        setGajiPokok('');
        setUangMakan('');
        setBonusKomisi('');
        setPotongan('');
        setCatatan('');
        fetchHistory();
      } else {
        onError('Gagal memposting penggajian');
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
      (h.namaKaryawan || '').toLowerCase().includes(q) ||
      (h.jabatan || '').toLowerCase().includes(q) ||
      (h.bukti || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-blue-300 text-2xl shrink-0">
            <i className="fa-solid fa-users-gear"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold">Payroll & Penggajian (Staff & Mekanik)</h2>
            <p className="text-xs text-blue-200">
              Pencatatan gaji pokok, uang makan, komisi pengerjaan servis, potongan kasbon, dan slip gaji terintegrasi jurnal.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs bg-blue-950/60 px-3 py-1.5 rounded-lg border border-blue-400/30">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
          <span className="font-medium text-blue-200">Jurnal Otomatis Beban Gaji</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM INPUT */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <h3 className="font-bold text-indigo-900 text-xs flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs">
                  <i className="fa-solid fa-file-invoice"></i>
                </span>
                Formulir Hitung & Slip Gaji
              </h3>
              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-semibold border border-indigo-200">
                Pengeluaran Gaji (-)
              </span>
            </div>

            {/* PRESET KARYAWAN */}
            <div>
              <label className="text-[11px] font-bold text-gray-700 block mb-1.5">
                ⚡ Isi Cepat Template Staff/Mekanik:
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => applyPresetStaff('Agus (Senior)', 'Mekanik Utama', 2500000, 500000)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition"
                >
                  🔧 Mekanik Utama
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetStaff('Budi (Junior)', 'Mekanik Helper', 1800000, 400000)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition"
                >
                  🛠️ Mekanik Helper
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetStaff('Siti (Kasir)', 'Kasir & Admin Toko', 2200000, 450000)}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-bold border border-indigo-200 transition"
                >
                  💻 Kasir / Admin Toko
                </button>
              </div>
            </div>

            <form onSubmit={handlePosting} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Nama Karyawan / Mekanik <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={namaKaryawan}
                    onChange={(e) => setNamaKaryawan(e.target.value)}
                    placeholder="Nama lengkap staff"
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-semibold focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Jabatan / Posisi</label>
                  <select
                    value={jabatan}
                    onChange={(e) => setJabatan(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-semibold focus:outline-none focus:border-indigo-500 bg-white"
                  >
                    <option value="Mekanik Bengkel">Mekanik Bengkel</option>
                    <option value="Kasir Toko">Kasir Toko</option>
                    <option value="Kepala Bengkel">Kepala Bengkel</option>
                    <option value="Admin & Gudang">Admin & Gudang</option>
                    <option value="Staff Umum">Staff Umum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Tanggal Pembayaran Gaji</label>
                  <input
                    type="date"
                    value={tgl}
                    onChange={(e) => setTgl(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-semibold focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">
                    Metode Pembayaran (Kas/Bank) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={akunKredit}
                    onChange={(e) => setAkunKredit(e.target.value)}
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-bold focus:outline-none focus:border-indigo-500 bg-white text-indigo-900"
                  >
                    {paymentOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        💵 {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* GAJI POKOK & UANG MAKAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div>
                  <label className="font-bold text-indigo-950 block mb-1">Gaji Pokok (Rp)</label>
                  <input
                    type="text"
                    value={gajiPokok ? formatRupiah(numGajiPokok) : ''}
                    onChange={(e) => setGajiPokok(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-bold focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>

                <div>
                  <label className="font-bold text-indigo-950 block mb-1">Uang Makan / Transp (Rp)</label>
                  <input
                    type="text"
                    value={uangMakan ? formatRupiah(numUangMakan) : ''}
                    onChange={(e) => setUangMakan(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-bold focus:outline-none focus:border-indigo-500 bg-white"
                  />
                </div>
              </div>

              {/* BONUS & POTONGAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                <div>
                  <label className="font-bold text-emerald-800 block mb-1">
                    + Bonus / Komisi Servis (Rp)
                  </label>
                  <input
                    type="text"
                    value={bonusKomisi ? formatRupiah(numBonusKomisi) : ''}
                    onChange={(e) => setBonusKomisi(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 border border-emerald-200 rounded-lg font-bold focus:outline-none focus:border-emerald-500 bg-white text-emerald-800"
                  />
                </div>

                <div>
                  <label className="font-bold text-rose-800 block mb-1">
                    - Potongan / Kasbon (Rp)
                  </label>
                  <input
                    type="text"
                    value={potongan ? formatRupiah(numPotongan) : ''}
                    onChange={(e) => setPotongan(e.target.value)}
                    placeholder="Rp 0"
                    className="w-full px-3 py-2 border border-rose-200 rounded-lg font-bold focus:outline-none focus:border-rose-500 bg-white text-rose-800"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Catatan / Periode Kerja</label>
                <input
                  type="text"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Contoh: Gaji Bulan Juli 2026 + Komisi 12 Pekerjaan Tune Up"
                  className="w-full px-3 py-2 border border-indigo-200 rounded-lg font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* RINGKASAN REKAPITULASI */}
              <div className="p-3.5 bg-gradient-to-r from-indigo-900 to-slate-900 text-white rounded-xl space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-indigo-200 font-medium">TOTAL PENERIMAAN BERSIH (TAKE HOME PAY):</span>
                  <span className="text-lg font-extrabold text-emerald-300">
                    {formatRupiah(totalGaji)}
                  </span>
                </div>
                <div className="text-[11px] text-indigo-200 pt-1 border-t border-indigo-800 flex justify-between">
                  <span>
                    Debit: <strong>BEBAN GAJI KARYAWAN</strong>
                  </span>
                  <span>
                    Kredit: <strong>{akunKredit}</strong>
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-700 hover:bg-indigo-800 active:bg-indigo-900 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <i className="fa-solid fa-paper-plane text-sm"></i>
                {isSubmitting ? 'Memproses Penggajian...' : 'Posting Penggajian & Buat Slip'}
              </button>
            </form>
          </div>
        </div>

        {/* RIWAYAT PAYROLL */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
              <h3 className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-indigo-600"></i>
                Riwayat Penggajian Staff
              </h3>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-[10px] text-indigo-700 hover:text-indigo-900 font-bold flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            <input
              type="text"
              value={searchHistory}
              onChange={(e) => setSearchHistory(e.target.value)}
              placeholder="Cari nama karyawan / bukti..."
              className="w-full px-3 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500"
            />

            {loadingHistory ? (
              <div className="text-center py-8 text-indigo-600 text-xs">
                <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                Memuat riwayat...
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs bg-indigo-50/30 rounded-xl border border-dashed border-indigo-200">
                <i className="fa-solid fa-folder-open text-2xl mb-1 text-indigo-300 block"></i>
                Belum ada penggajian tercatat.
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-indigo-100 bg-indigo-50/20 hover:bg-indigo-50/60 transition space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-indigo-950 block">{item.namaKaryawan}</span>
                        <span className="text-[10px] text-indigo-600 font-semibold">{item.jabatan}</span>
                      </div>
                      <span className="font-extrabold text-indigo-900 bg-indigo-100 px-2 py-0.5 rounded-full text-xs">
                        {formatRupiah(item.totalGaji)}
                      </span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 pt-1 border-t border-indigo-100">
                      <span>📅 {item.tanggal} ({item.bukti})</span>
                      <span>💵 {item.metodeBayar}</span>
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

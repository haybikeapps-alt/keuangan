import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  getPiutangDetail,
  getUtang,
  getUtangBank,
  savePembayaranPiutang,
  savePembayaranUtang,
  savePencairanUtangBank,
  savePembayaranUtangBank,
  getRiwayatBayarUtangBank,
  deleteUtangBank,
  getPaymentMethods,
  getAccounts
} from '../../services/firebaseService';
import { PiutangItem, UtangItem, UtangBankItem, UtangBankBayarItem, PaymentMethod, Account } from '../../types';

interface UtangPiutangModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const UtangPiutangModule: React.FC<UtangPiutangModuleProps> = ({ onSuccess, onError }) => {
  const [tab, setTab] = useState<'piutang' | 'utang' | 'utangBank'>('piutang');

  const [piutangList, setPiutangList] = useState<PiutangItem[]>([]);
  const [utangList, setUtangList] = useState<UtangItem[]>([]);
  const [utangBankList, setUtangBankList] = useState<UtangBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Payment Methods & Bank Accounts
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Supplier & Piutang Pay Modal
  const [payModalItem, setPayModalItem] = useState<{
    id: string;
    type: 'piutang' | 'utang';
    title: string;
    sisa: number;
  } | null>(null);
  const [bayarNominal, setBayarNominal] = useState('');
  const [metodeBayar, setMetodeBayar] = useState('Kas');

  // ================= UTANG BANK MODALS & STATES =================
  const [showPencairanModal, setShowPencairanModal] = useState(false);
  const [showSimulasiModal, setShowSimulasiModal] = useState(false);
  const [payBankModalItem, setPayBankModalItem] = useState<UtangBankItem | null>(null);
  const [historyBankModalItem, setHistoryBankModalItem] = useState<UtangBankItem | null>(null);
  const [historyBankList, setHistoryBankList] = useState<UtangBankBayarItem[]>([]);
  const [loadingHistoryBank, setLoadingHistoryBank] = useState(false);
  const [historyTab, setHistoryTab] = useState<'riwayat' | 'simulasi'>('riwayat');

  // Form State: Pencairan Bank Baru
  const [pencairanTgl, setPencairanTgl] = useState(() => formatISO(new Date()));
  const [pencairanKreditur, setPencairanKreditur] = useState('Bank BRI KUR');
  const [pencairanNoKontrak, setPencairanNoKontrak] = useState('');
  const [pencairanPlafon, setPencairanPlafon] = useState('');
  const [pencairanBungaPct, setPencairanBungaPct] = useState('6.0'); // 6% per tahun (KUR)
  const [pencairanTenor, setPencairanTenor] = useState(12); // 12 bulan
  const [pencairanDendaPct, setPencairanDendaPct] = useState('1.0'); // 1% denda keterlambatan
  const [pencairanRekening, setPencairanRekening] = useState('KAS');
  const [pencairanKet, setPencairanKet] = useState('Pencairan Kredit Modal Kerja untuk Operasional & Stok Toko');

  // Form State: Bayar Angsuran Bank
  const [payBankTgl, setPayBankTgl] = useState(() => formatISO(new Date()));
  const [payBankPokok, setPayBankPokok] = useState('');
  const [payBankBunga, setPayBankBunga] = useState('');
  const [payBankDenda, setPayBankDenda] = useState('0');
  const [payBankMetode, setPayBankMetode] = useState('Kas');
  const [payBankKet, setPayBankKet] = useState('');

  // Form State: Kalkulator Simulasi Standalone
  const [simPlafon, setSimPlafon] = useState('50000000');
  const [simBungaPct, setSimBungaPct] = useState('6.0');
  const [simTenor, setSimTenor] = useState(12);
  const [simDendaPct, setSimDendaPct] = useState('1.0');

  const loadData = async () => {
    setLoading(true);
    try {
      const [pData, uData, ubData, pMethods, accs] = await Promise.all([
        getPiutangDetail(),
        getUtang(),
        getUtangBank(),
        getPaymentMethods(),
        getAccounts()
      ]);
      setPiutangList(pData);
      setUtangList(uData);
      setUtangBankList(ubData);
      setPaymentMethods(pMethods);
      setAccounts(accs);
      if (pMethods.length > 0) setMetodeBayar(pMethods[0].val);
    } catch (e) {
      console.error('Error loading utang piutang data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalPiutang = piutangList.reduce((acc, curr) => acc + (curr.sisa || 0), 0);
  const totalUtangSupplier = utangList.reduce((acc, curr) => acc + (curr.sisa || 0), 0);

  // Stats Bank Loans
  const activeBankLoans = utangBankList.filter((b) => b.status === 'Aktif');
  const totalPlafonBank = activeBankLoans.reduce((acc, curr) => acc + (curr.plafonPinjaman || 0), 0);
  const totalSisaPokokBank = activeBankLoans.reduce((acc, curr) => acc + (curr.sisaPokok || 0), 0);
  const totalBungaPaidBank = utangBankList.reduce((acc, curr) => acc + (curr.dibayarBunga || 0), 0);
  const totalDendaPaidBank = utangBankList.reduce((acc, curr) => acc + (curr.dibayarDenda || 0), 0);

  // Open Modal Pay Supplier/Piutang
  const handleOpenPay = (id: string, type: 'piutang' | 'utang', title: string, sisa: number) => {
    setPayModalItem({ id, type, title, sisa });
    setBayarNominal(String(sisa));
  };

  const handleConfirmPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalItem) return;

    const num = parseInt(bayarNominal.replace(/\D/g, '')) || 0;
    if (num <= 0) {
      onError('Nominal pembayaran harus lebih dari Rp 0!');
      return;
    }
    if (num > payModalItem.sisa) {
      onError(`Nominal pembayaran melebihi sisa tagihan (${formatRupiah(payModalItem.sisa)})!`);
      return;
    }

    setIsSubmitting(true);
    try {
      if (payModalItem.type === 'piutang') {
        await savePembayaranPiutang(payModalItem.id, num, metodeBayar);
        onSuccess(`Pelunasan Piutang ${payModalItem.title} sebesar ${formatRupiah(num)} Berhasil!`);
      } else {
        await savePembayaranUtang(payModalItem.id, num, metodeBayar);
        onSuccess(`Pembayaran Utang ${payModalItem.title} sebesar ${formatRupiah(num)} Berhasil!`);
      }
      setPayModalItem(null);
      loadData();
    } catch (err: any) {
      onError(err.message || 'Gagal memproses pembayaran');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ================= HANDLERS FOR BANK LOANS =================
  const handleOpenPayBank = (item: UtangBankItem) => {
    setPayBankModalItem(item);
    setPayBankTgl(formatISO(new Date()));

    // Estimate monthly principal & monthly interest
    const numPlafon = item.plafonPinjaman;
    const numSisa = item.sisaPokok;
    const tenor = item.tenorBulan || 12;
    const estPokok = Math.min(numSisa, Math.round(numPlafon / tenor));
    const estBunga = Math.round((numSisa * (item.bungaPctAnual / 100)) / 12);

    setPayBankPokok(String(estPokok));
    setPayBankBunga(String(estBunga));
    setPayBankDenda('0');
    setPayBankMetode(paymentMethods[0]?.val || 'Kas');
    setPayBankKet(`Angsuran Pinjaman ${item.namaKreditur}`);
  };

  const handleConfirmPayBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payBankModalItem) return;

    const p = parseInt(payBankPokok.replace(/\D/g, '')) || 0;
    const b = parseInt(payBankBunga.replace(/\D/g, '')) || 0;
    const d = parseInt(payBankDenda.replace(/\D/g, '')) || 0;

    if (p + b + d <= 0) {
      onError('Total pembayaran angsuran (Pokok + Bunga + Denda) harus lebih dari Rp 0!');
      return;
    }
    if (p > payBankModalItem.sisaPokok) {
      onError(`Angsuran pokok (${formatRupiah(p)}) melebihi Sisa Pokok Pinjaman (${formatRupiah(payBankModalItem.sisaPokok)})!`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePembayaranUtangBank(
        JSON.stringify({
          utangBankId: payBankModalItem.id,
          tanggal: payBankTgl,
          pokok: p,
          bunga: b,
          denda: d,
          metode: payBankMetode,
          keterangan: payBankKet
        })
      );

      if (res && res.ok) {
        onSuccess(
          `Pembayaran Angsuran Ke-${res.angsuranKe} ${payBankModalItem.namaKreditur} sebesar ${formatRupiah(
            res.totalBayar
          )} Berhasil Tersimpan!`
        );
        setPayBankModalItem(null);
        loadData();
      } else {
        onError(res?.msg || 'Gagal memproses pembayaran angsuran bank.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat memproses pembayaran bank.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmPencairanBank = async (e: React.FormEvent) => {
    e.preventDefault();

    const plafonNum = parseInt(pencairanPlafon.replace(/\D/g, '')) || 0;
    if (plafonNum <= 0) {
      onError('Plafon pinjaman bank harus lebih dari Rp 0!');
      return;
    }
    if (!pencairanKreditur.trim()) {
      onError('Nama Bank / Kreditur wajib diisi!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await savePencairanUtangBank(
        JSON.stringify({
          tanggalPencairan: pencairanTgl,
          namaKreditur: pencairanKreditur,
          nomorKontrak: pencairanNoKontrak || `PK-${Date.now().toString().slice(-6)}`,
          plafonPinjaman: plafonNum,
          bungaPctAnual: parseFloat(pencairanBungaPct) || 0,
          tenorBulan: pencairanTenor || 12,
          dendaPctBulan: parseFloat(pencairanDendaPct) || 0,
          rekeningPencairan: pencairanRekening,
          keterangan: pencairanKet
        })
      );

      if (res && res.ok) {
        onSuccess(
          `Pencairan Pinjaman ${pencairanKreditur} sebesar ${formatRupiah(
            plafonNum
          )} Berhasil Masuk ke Kas/Bank!`
        );
        setShowPencairanModal(false);
        setPencairanPlafon('');
        setPencairanNoKontrak('');
        loadData();
      } else {
        onError(res?.msg || 'Gagal mencairkan pinjaman bank.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat menyimpan data pencairan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenHistoryBank = async (item: UtangBankItem) => {
    setHistoryBankModalItem(item);
    setHistoryTab('riwayat');
    setLoadingHistoryBank(true);
    try {
      const list = await getRiwayatBayarUtangBank(item.id);
      setHistoryBankList(list);
    } catch (e) {
      console.error('Error load bank history:', e);
    } finally {
      setLoadingHistoryBank(false);
    }
  };

  const handleDeleteBankLoan = async (item: UtangBankItem) => {
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus catatan pinjaman ${item.namaKreditur} (Plafon: ${formatRupiah(
          item.plafonPinjaman
        )})?`
      )
    ) {
      return;
    }

    try {
      const res = await deleteUtangBank(item.id);
      if (res && res.ok) {
        onSuccess(`Pinjaman Bank ${item.namaKreditur} berhasil dihapus.`);
        loadData();
      } else {
        onError(res?.msg || 'Gagal menghapus pinjaman bank.');
      }
    } catch (err: any) {
      onError(err.message || 'Error saat menghapus data.');
    }
  };

  // Helper calculation for Loan Amortization Schedule Simulation Table
  const generateAmortizationTable = (plafon: number, bungaAnualPct: number, tenorBulan: number) => {
    const table = [];
    let sisa = plafon;
    const pokokPerBln = tenorBulan > 0 ? Math.round(plafon / tenorBulan) : 0;

    for (let i = 1; i <= tenorBulan; i++) {
      const bungaBln = Math.round((sisa * (bungaAnualPct / 100)) / 12);
      const pokok = i === tenorBulan ? sisa : Math.min(sisa, pokokPerBln);
      const totalBayar = pokok + bungaBln;
      sisa = Math.max(0, sisa - pokok);

      table.push({
        bulanKe: i,
        pokok,
        bunga: bungaBln,
        totalBayar,
        sisaPokok: sisa
      });
    }
    return table;
  };

  const filteredPiutang = piutangList.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (p.namaPembeli || '').toLowerCase().includes(q) ||
      (p.keterangan || '').toLowerCase().includes(q) ||
      (p.id || '').toLowerCase().includes(q)
    );
  });

  const filteredUtang = utangList.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (u.namaSupplier || '').toLowerCase().includes(q) ||
      (u.keterangan || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    );
  });

  const filteredUtangBank = utangBankList.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.namaKreditur || '').toLowerCase().includes(q) ||
      (b.nomorKontrak || '').toLowerCase().includes(q) ||
      (b.keterangan || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-900/40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 backdrop-blur border border-amber-400/30 flex items-center justify-center text-amber-300 text-2xl shrink-0">
            <i className="fa-solid fa-handshake"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Manajemen Utang, Piutang & Pinjaman Bank
              <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Terintegrasi Total
              </span>
            </h2>
            <p className="text-xs text-amber-200/90">
              Kelola piutang pelanggan, utang supplier, pencairan pinjaman bank modal kerja, serta angsuran bunga & denda realistis.
            </p>
          </div>
        </div>

        {/* TABS SELECTOR */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setTab('piutang')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'piutang'
                ? 'bg-emerald-400 text-slate-950 shadow-md font-extrabold'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🤝 Piutang Pelanggan ({piutangList.length})
          </button>
          <button
            onClick={() => setTab('utang')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'utang'
                ? 'bg-rose-400 text-slate-950 shadow-md font-extrabold'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🛒 Utang Supplier ({utangList.length})
          </button>
          <button
            onClick={() => setTab('utangBank')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              tab === 'utangBank'
                ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold ring-2 ring-amber-300'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            🏦 Utang & Pinjaman Bank ({utangBankList.length})
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}
      {tab === 'utangBank' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-amber-900 uppercase">Sisa Pokok Pinjaman Bank</span>
              <span className="w-7 h-7 rounded-lg bg-amber-200 text-amber-800 flex items-center justify-center text-xs">
                <i className="fa-solid fa-building-columns"></i>
              </span>
            </div>
            <div className="text-xl font-black text-amber-950">{formatRupiah(totalSisaPokokBank)}</div>
            <p className="text-[10px] text-amber-700 mt-0.5">Kewajiban pokok yang harus dilunasi.</p>
          </div>

          <div className="bg-slate-50 border border-slate-300 p-4 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-slate-800 uppercase">Total Plafon Aktif</span>
              <span className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center text-xs">
                <i className="fa-solid fa-file-contract"></i>
              </span>
            </div>
            <div className="text-xl font-black text-slate-900">{formatRupiah(totalPlafonBank)}</div>
            <p className="text-[10px] text-slate-600 mt-0.5">Dari {activeBankLoans.length} fasilitas kredit aktif.</p>
          </div>

          <div className="bg-emerald-50 border border-emerald-300 p-4 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-emerald-900 uppercase">Total Bunga Terbayar</span>
              <span className="w-7 h-7 rounded-lg bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs">
                <i className="fa-solid fa-percent"></i>
              </span>
            </div>
            <div className="text-xl font-black text-emerald-900">{formatRupiah(totalBungaPaidBank)}</div>
            <p className="text-[10px] text-emerald-700 mt-0.5">Tercatat ke Beban Bunga Bank di Rugi Laba.</p>
          </div>

          <div className="bg-rose-50 border border-rose-300 p-4 rounded-2xl shadow-sm">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-rose-900 uppercase">Denda Keterlambatan</span>
              <span className="w-7 h-7 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center text-xs">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </span>
            </div>
            <div className="text-xl font-black text-rose-900">{formatRupiah(totalDendaPaidBank)}</div>
            <p className="text-[10px] text-rose-700 mt-0.5">Tercatat ke Beban Denda di Rugi Laba.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            onClick={() => setTab('piutang')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              tab === 'piutang'
                ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-400'
                : 'bg-white border-gray-200 hover:border-emerald-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                Total Sisa Piutang Usaha (Tagihan Pelanggan)
              </span>
              <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                <i className="fa-solid fa-circle-arrow-down"></i>
              </span>
            </div>
            <div className="text-xl font-black text-emerald-800">{formatRupiah(totalPiutang)}</div>
            <p className="text-[11px] text-gray-500 mt-1">Uang toko yang belum ditagih/dibayar oleh pelanggan.</p>
          </div>

          <div
            onClick={() => setTab('utang')}
            className={`p-4 rounded-2xl border transition cursor-pointer ${
              tab === 'utang'
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-400'
                : 'bg-white border-gray-200 hover:border-rose-300'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-rose-900 uppercase tracking-wide">
                Total Sisa Utang Usaha (Tagihan Supplier)
              </span>
              <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-sm">
                <i className="fa-solid fa-circle-arrow-up"></i>
              </span>
            </div>
            <div className="text-xl font-black text-rose-800">{formatRupiah(totalUtangSupplier)}</div>
            <p className="text-[11px] text-gray-500 mt-1">Kewajiban bayar toko atas barang/faktur dari distributor.</p>
          </div>
        </div>
      )}

      {/* SEARCH BAR & QUICK ACTION BUTTONS */}
      <div className="bg-white p-4 rounded-2xl border border-amber-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex-1 relative">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-3 text-gray-400 text-xs"></i>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === 'piutang'
                ? 'Cari nama pelanggan atau keterangan...'
                : tab === 'utang'
                ? 'Cari nama supplier atau keterangan...'
                : 'Cari nama bank / kreditur, nomor kontrak, atau keterangan...'
            }
            className="w-full pl-9 pr-3 py-2 border border-amber-200 rounded-xl text-xs focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {tab === 'utangBank' && (
            <>
              <button
                type="button"
                onClick={() => setShowSimulasiModal(true)}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-sm transition cursor-pointer"
              >
                <i className="fa-solid fa-calculator text-amber-300"></i> Kalkulator Simulasi
              </button>
              <button
                type="button"
                onClick={() => setShowPencairanModal(true)}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer"
              >
                <i className="fa-solid fa-plus-circle"></i> + Pencairan Pinjaman Bank
              </button>
            </>
          )}

          <button
            onClick={loadData}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0 cursor-pointer"
          >
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/* MAIN CONTENT TABLE */}
      <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-amber-700 text-xs font-bold">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 block"></i>
            Memuat data...
          </div>
        ) : tab === 'piutang' ? (
          filteredPiutang.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              <i className="fa-solid fa-circle-check text-3xl mb-2 text-emerald-300 block"></i>
              Tidak ada tagihan piutang aktif / semua sudah lunas!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-emerald-900 text-emerald-100 text-[11px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Pelanggan</th>
                    <th className="p-3">No. Bukti / Tgl</th>
                    <th className="p-3">Total Transaksi</th>
                    <th className="p-3">Terbayar</th>
                    <th className="p-3">Sisa Piutang</th>
                    <th className="p-3 text-right">Aksi Pelunasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50 font-medium">
                  {filteredPiutang.map((item) => (
                    <tr key={item.id} className="hover:bg-emerald-50/40 transition">
                      <td className="p-3">
                        <span className="font-bold text-emerald-950 block">{item.namaPembeli || 'Pelanggan Umum'}</span>
                        <span className="text-[10px] text-gray-500">{item.keterangan}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-gray-800 block">{item.id}</span>
                        <span className="text-[10px] text-gray-400">{item.tanggal}</span>
                      </td>
                      <td className="p-3 font-semibold text-gray-700">{formatRupiah(item.nominal)}</td>
                      <td className="p-3 font-semibold text-emerald-700">{formatRupiah(item.dibayar || 0)}</td>
                      <td className="p-3">
                        <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          {formatRupiah(item.sisa)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenPay(item.id, 'piutang', item.namaPembeli || item.id, item.sisa)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <i className="fa-solid fa-money-bill-wave"></i> Bayar Piutang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === 'utang' ? (
          filteredUtang.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-xs">
              <i className="fa-solid fa-circle-check text-3xl mb-2 text-rose-300 block"></i>
              Tidak ada utang supplier aktif / semua sudah lunas!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-900 text-rose-100 text-[11px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Supplier / Distributor</th>
                    <th className="p-3">No. Faktur / Tgl</th>
                    <th className="p-3">Total Utang</th>
                    <th className="p-3">Terbayar</th>
                    <th className="p-3">Sisa Utang</th>
                    <th className="p-3 text-right">Aksi Pelunasan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-50 font-medium">
                  {filteredUtang.map((item) => (
                    <tr key={item.id} className="hover:bg-rose-50/40 transition">
                      <td className="p-3">
                        <span className="font-bold text-rose-950 block">{item.namaSupplier || 'Supplier'}</span>
                        <span className="text-[10px] text-gray-500">{item.keterangan}</span>
                      </td>
                      <td className="p-3">
                        <span className="font-mono font-bold text-gray-800 block">{item.id}</span>
                        <span className="text-[10px] text-gray-400">{item.tanggal}</span>
                      </td>
                      <td className="p-3 font-semibold text-gray-700">{formatRupiah(item.nominal)}</td>
                      <td className="p-3 font-semibold text-emerald-700">{formatRupiah(item.dibayar || 0)}</td>
                      <td className="p-3">
                        <span className="font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          {formatRupiah(item.sisa)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenPay(item.id, 'utang', item.namaSupplier || item.id, item.sisa)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs shadow-sm flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <i className="fa-solid fa-receipt"></i> Bayar Utang
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* TAB 3: UTANG & PINJAMAN BANK */
          filteredUtangBank.length === 0 ? (
            <div className="text-center py-14 p-6 text-gray-500 text-xs space-y-3">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 text-3xl mx-auto">
                <i className="fa-solid fa-building-columns"></i>
              </div>
              <p className="font-bold text-sm text-slate-800">Belum Ada Catatan Pinjaman / Kredit Bank</p>
              <p className="max-w-md mx-auto text-gray-500">
                Catat pencairan kredit modal kerja (BRI KUR, Mandiri, BCA, dll) untuk memantau sisa pokok, perhitungan bunga %, denda, dan otomatis terhubung ke Kas/Bank & Rugi Laba.
              </p>
              <button
                type="button"
                onClick={() => setShowPencairanModal(true)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl text-xs inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-plus-circle"></i> Catat Pencairan Pinjaman Baru
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900 text-amber-300 text-[11px] uppercase tracking-wider font-bold">
                  <tr>
                    <th className="p-3">Kreditur / Bank</th>
                    <th className="p-3">No. Kontrak & Tgl</th>
                    <th className="p-3">Plafon Pinjaman</th>
                    <th className="p-3">Bunga & Tenor</th>
                    <th className="p-3">Sisa Pokok</th>
                    <th className="p-3">Estimasi Angsuran/Bln</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredUtangBank.map((item) => {
                    const estPokokBln = Math.round(item.plafonPinjaman / item.tenorBulan);
                    const estBungaBln = Math.round((item.sisaPokok * (item.bungaPctAnual / 100)) / 12);
                    const estTotalAngsuran = estPokokBln + estBungaBln;

                    return (
                      <tr key={item.id} className="hover:bg-amber-50/40 transition">
                        <td className="p-3">
                          <span className="font-black text-slate-950 block text-xs flex items-center gap-1.5">
                            <i className="fa-solid fa-building-columns text-amber-600"></i>
                            {item.namaKreditur}
                          </span>
                          <span className="text-[10px] text-gray-500">{item.keterangan || '-'}</span>
                        </td>
                        <td className="p-3">
                          <span className="font-mono font-bold text-slate-800 block">{item.nomorKontrak}</span>
                          <span className="text-[10px] text-gray-400">Cair: {item.tanggalPencairan}</span>
                        </td>
                        <td className="p-3 font-bold text-slate-900">{formatRupiah(item.plafonPinjaman)}</td>
                        <td className="p-3">
                          <span className="font-bold text-amber-900 block">{item.bungaPctAnual}% / thn</span>
                          <span className="text-[10px] text-gray-500">{item.tenorBulan} Bulan (Denda {item.dendaPctBulan}%)</span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`font-black px-2 py-0.5 rounded text-xs ${
                              item.sisaPokok > 0
                                ? 'bg-amber-100 text-amber-950 border border-amber-300'
                                : 'bg-emerald-100 text-emerald-900'
                            }`}
                          >
                            {formatRupiah(item.sisaPokok)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{formatRupiah(estTotalAngsuran)}</span>
                          <span className="text-[10px] text-gray-500">
                            Pokok: {formatRupiah(estPokokBln)} + Bunga: {formatRupiah(estBungaBln)}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                              item.status === 'Lunas'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            }`}
                          >
                            {item.status === 'Lunas' ? '✅ Lunas' : '⏳ Aktif'}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          {item.status === 'Aktif' && (
                            <button
                              type="button"
                              onClick={() => handleOpenPayBank(item)}
                              className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-lg text-xs shadow-sm inline-flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fa-solid fa-credit-card"></i> Bayar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenHistoryBank(item)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs shadow-sm inline-flex items-center gap-1 cursor-pointer"
                          >
                            <i className="fa-solid fa-clock-rotate-left"></i> Riwayat
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBankLoan(item)}
                            className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 inline-flex items-center gap-1 cursor-pointer"
                            title="Hapus Catatan Pinjaman Bank"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ================= MODAL PENCAIRAN PINJAMAN BANK BARU ================= */}
      {showPencairanModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-4 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <i className="fa-solid fa-building-columns"></i>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Pencairan Pinjaman Bank / Kredit Modal Kerja</h3>
                  <p className="text-[10px] text-amber-200">Uang masuk otomatis dicatat ke Kas/Bank & Jurnal Keuangan</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPencairanModal(false)}
                className="text-white hover:text-amber-300 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPencairanBank} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Nama Bank / Kreditur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pencairanKreditur}
                    onChange={(e) => setPencairanKreditur(e.target.value)}
                    placeholder="misal: Bank BRI KUR, Bank Mandiri, BPR"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Nomor Perjanjian / Kontrak</label>
                  <input
                    type="text"
                    value={pencairanNoKontrak}
                    onChange={(e) => setPencairanNoKontrak(e.target.value)}
                    placeholder="misal: PK-BRI/2026/08"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Tanggal Pencairan <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={pencairanTgl}
                    onChange={(e) => setPencairanTgl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">
                    Plafon Pinjaman Pokok (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={pencairanPlafon ? formatRupiah(parseInt(pencairanPlafon.replace(/\D/g, '')) || 0) : ''}
                    onChange={(e) => setPencairanPlafon(e.target.value)}
                    placeholder="Rp 50.000.000"
                    className="w-full px-3 py-2 border-2 border-amber-400 rounded-lg text-sm font-black text-amber-950 focus:outline-none focus:border-amber-600 bg-amber-50/50"
                    required
                  />
                </div>
              </div>

              {/* TIKET SUKU BUNGA & TENOR */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-slate-900 font-extrabold text-[11px] uppercase tracking-wide border-b pb-1.5">
                  <span>⚙️ Skema Bunga & Tenor Realistis</span>
                  <span className="text-amber-700 font-bold">Standard Bank / KUR</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Bunga (% / thn)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pencairanBungaPct}
                      onChange={(e) => setPencairanBungaPct(e.target.value)}
                      placeholder="6.0"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-extrabold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Tenor (Bulan)</label>
                    <select
                      value={pencairanTenor}
                      onChange={(e) => setPencairanTenor(parseInt(e.target.value) || 12)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-extrabold text-slate-900 bg-white"
                    >
                      <option value={6}>6 Bulan</option>
                      <option value={12}>12 Bulan (1 Thn)</option>
                      <option value={24}>24 Bulan (2 Thn)</option>
                      <option value={36}>36 Bulan (3 Thn)</option>
                      <option value={48}>48 Bulan (4 Thn)</option>
                      <option value={60}>60 Bulan (5 Thn)</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Denda Telat (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={pencairanDendaPct}
                      onChange={(e) => setPencairanDendaPct(e.target.value)}
                      placeholder="1.0"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* SIMULATION PREVIEW CARD */}
                {parseInt(pencairanPlafon.replace(/\D/g, '')) > 0 && (
                  <div className="p-3 bg-amber-100/70 border border-amber-300 rounded-lg text-slate-900 space-y-1 text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span>Estimasi Angsuran Pokok / Bln:</span>
                      <span>
                        {formatRupiah(
                          Math.round(parseInt(pencairanPlafon.replace(/\D/g, '')) / pencairanTenor)
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-amber-900">
                      <span>Estimasi Bunga Bulan-1:</span>
                      <span>
                        {formatRupiah(
                          Math.round(
                            (parseInt(pencairanPlafon.replace(/\D/g, '')) *
                              ((parseFloat(pencairanBungaPct) || 0) / 100)) /
                              12
                          )
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between font-black text-xs pt-1 border-t border-amber-300/80 text-amber-950">
                      <span>Total Angsuran Bulan-1:</span>
                      <span>
                        {formatRupiah(
                          Math.round(parseInt(pencairanPlafon.replace(/\D/g, '')) / pencairanTenor) +
                            Math.round(
                              (parseInt(pencairanPlafon.replace(/\D/g, '')) *
                                ((parseFloat(pencairanBungaPct) || 0) / 100)) /
                                12
                            )
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Rekening Penerima Uang Pencairan <span className="text-rose-500">*</span>
                </label>
                <select
                  value={pencairanRekening}
                  onChange={(e) => setPencairanRekening(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-900 bg-white"
                >
                  <option value="KAS">Kas Tunai Toko</option>
                  <option value="BANK BRI">BANK BRI</option>
                  <option value="BANK MANDIRI">BANK MANDIRI</option>
                  <option value="BANK BNI">BANK BNI</option>
                  <option value="BANK LAINNYA">BANK LAINNYA</option>
                </select>
                <p className="text-[10px] text-gray-500 mt-1">
                  Pencairan uang tunai/transfer akan menambah saldo akun Kas/Bank pilihan Anda.
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Keterangan / Tujuan Pinjaman</label>
                <input
                  type="text"
                  value={pencairanKet}
                  onChange={(e) => setPencairanKet(e.target.value)}
                  placeholder="Keterangan tambahan..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPencairanModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 font-extrabold text-white rounded-lg shadow-md cursor-pointer"
                >
                  {isSubmitting ? 'Memproses...' : 'Proses & Simpan Pencairan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL BAYAR ANGSURAN BANK ================= */}
      {payBankModalItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-4 bg-gradient-to-r from-amber-900 via-slate-900 to-slate-950 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <i className="fa-solid fa-credit-card text-amber-400"></i>
                  Pembayaran Angsuran: {payBankModalItem.namaKreditur}
                </h3>
                <p className="text-[10px] text-amber-200">
                  No. Kontrak: {payBankModalItem.nomorKontrak} | Sisa Pokok: {formatRupiah(payBankModalItem.sisaPokok)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayBankModalItem(null)}
                className="text-white hover:text-amber-300 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPayBank} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tanggal Pembayaran</label>
                  <input
                    type="date"
                    value={payBankTgl}
                    onChange={(e) => setPayBankTgl(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Sumber Kas / Rekening</label>
                  <select
                    value={payBankMetode}
                    onChange={(e) => setPayBankMetode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-slate-800 bg-white"
                  >
                    {paymentMethods.map((m) => (
                      <option key={m.val} value={m.val}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* INPUT RINCIAN ANGSURAN */}
              <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-3">
                <span className="font-extrabold text-[11px] text-amber-950 uppercase tracking-wide block border-b border-amber-200 pb-1">
                  💵 Rincian Alokasi Pembayaran
                </span>

                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between font-bold text-slate-800 mb-1">
                      <span>1. Angsuran Pokok (Mengurangi Utang)</span>
                      <span className="text-[10px] text-gray-500">
                        Max: {formatRupiah(payBankModalItem.sisaPokok)}
                      </span>
                    </div>
                    <input
                      type="text"
                      value={payBankPokok ? formatRupiah(parseInt(payBankPokok.replace(/\D/g, '')) || 0) : ''}
                      onChange={(e) => setPayBankPokok(e.target.value)}
                      placeholder="Rp 0"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-extrabold text-slate-900 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-800 mb-1">
                      <span>2. Bunga Pinjaman (Diakui Beban Bunga)</span>
                      <span className="text-[10px] text-amber-700 font-semibold">
                        Suku Bunga: {payBankModalItem.bungaPctAnual}%/thn
                      </span>
                    </div>
                    <input
                      type="text"
                      value={payBankBunga ? formatRupiah(parseInt(payBankBunga.replace(/\D/g, '')) || 0) : ''}
                      onChange={(e) => setPayBankBunga(e.target.value)}
                      placeholder="Rp 0"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-extrabold text-amber-900 bg-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between font-bold text-slate-800 mb-1">
                      <span>3. Denda Keterlambatan (Jika Telat)</span>
                      <span className="text-[10px] text-rose-700">Tarif Denda: {payBankModalItem.dendaPctBulan}%</span>
                    </div>
                    <input
                      type="text"
                      value={payBankDenda ? formatRupiah(parseInt(payBankDenda.replace(/\D/g, '')) || 0) : ''}
                      onChange={(e) => setPayBankDenda(e.target.value)}
                      placeholder="Rp 0"
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-extrabold text-rose-900 bg-white"
                    />
                  </div>
                </div>

                {/* TOTAL SUMMARY */}
                <div className="p-2.5 bg-slate-900 text-amber-300 rounded-lg flex justify-between items-center font-black text-xs shadow-inner">
                  <span>TOTAL KAS KELUAR:</span>
                  <span className="text-sm">
                    {formatRupiah(
                      (parseInt(payBankPokok.replace(/\D/g, '')) || 0) +
                        (parseInt(payBankBunga.replace(/\D/g, '')) || 0) +
                        (parseInt(payBankDenda.replace(/\D/g, '')) || 0)
                    )}
                  </span>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">Catatan Keterangan</label>
                <input
                  type="text"
                  value={payBankKet}
                  onChange={(e) => setPayBankKet(e.target.value)}
                  placeholder="Catatan angsuran..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayBankModalItem(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 font-extrabold text-slate-950 rounded-lg shadow-md cursor-pointer"
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Pembayaran Angsuran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL RIWAYAT & JADWAL AMORTISASI ================= */}
      {historyBankModalItem && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <i className="fa-solid fa-clock-rotate-left text-amber-400"></i>
                  Riwayat & Jadwal Pinjaman: {historyBankModalItem.namaKreditur}
                </h3>
                <p className="text-[10px] text-amber-200">
                  Plafon: {formatRupiah(historyBankModalItem.plafonPinjaman)} | Tenor: {historyBankModalItem.tenorBulan} Bln | Bunga: {historyBankModalItem.bungaPctAnual}%
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex bg-slate-800 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setHistoryTab('riwayat')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                      historyTab === 'riwayat'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Riwayat Pembayaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab('simulasi')}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold transition cursor-pointer ${
                      historyTab === 'simulasi'
                        ? 'bg-amber-400 text-slate-950 shadow'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Jadwal Amortisasi
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryBankModalItem(null)}
                  className="text-white hover:text-amber-300 font-bold text-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto">
              {historyTab === 'riwayat' ? (
                loadingHistoryBank ? (
                  <div className="text-center py-8 text-xs font-bold text-slate-600">
                    <i className="fa-solid fa-spinner fa-spin text-xl mb-2 block text-amber-600"></i>
                    Memuat riwayat angsuran...
                  </div>
                ) : historyBankList.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">
                    Belum ada catatan angsuran yang dibayar untuk pinjaman ini.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-800 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="p-2.5">Angsuran Ke</th>
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">Pokok</th>
                          <th className="p-2.5">Bunga</th>
                          <th className="p-2.5">Denda</th>
                          <th className="p-2.5">Total Bayar</th>
                          <th className="p-2.5">Sisa Pokok</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium">
                        {historyBankList.map((h) => (
                          <tr key={h.id || h.angsuranKe} className="hover:bg-slate-50">
                            <td className="p-2.5 font-bold text-slate-900">Ke-{h.angsuranKe}</td>
                            <td className="p-2.5 text-gray-600">{h.tanggal}</td>
                            <td className="p-2.5 font-semibold text-slate-800">{formatRupiah(h.pokok)}</td>
                            <td className="p-2.5 font-semibold text-amber-700">{formatRupiah(h.bunga)}</td>
                            <td className="p-2.5 font-semibold text-rose-700">{formatRupiah(h.denda)}</td>
                            <td className="p-2.5 font-black text-emerald-800">{formatRupiah(h.totalBayar)}</td>
                            <td className="p-2.5 font-bold text-slate-700">{formatRupiah(h.sisaPokokSesudah)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                /* TAB JADWAL AMORTISASI PROJECTED */
                <div className="space-y-3">
                  <p className="text-[11px] text-gray-600 italic">
                    Proyeksi jadwal angsuran bulanan berdasarkan Plafon {formatRupiah(historyBankModalItem.plafonPinjaman)}, Bunga {historyBankModalItem.bungaPctAnual}%/thn, Tenor {historyBankModalItem.tenorBulan} Bulan:
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-900 text-amber-200 text-[10px] uppercase font-bold">
                        <tr>
                          <th className="p-2.5">Bulan Ke</th>
                          <th className="p-2.5">Angsuran Pokok</th>
                          <th className="p-2.5">Bunga (Estimasi)</th>
                          <th className="p-2.5">Total Angsuran</th>
                          <th className="p-2.5">Sisa Pokok Pinjaman</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100 font-medium text-[11px]">
                        {generateAmortizationTable(
                          historyBankModalItem.plafonPinjaman,
                          historyBankModalItem.bungaPctAnual,
                          historyBankModalItem.tenorBulan
                        ).map((row) => (
                          <tr key={row.bulanKe} className="hover:bg-amber-50/50">
                            <td className="p-2 font-bold text-slate-900">Bulan Ke-{row.bulanKe}</td>
                            <td className="p-2 font-semibold text-slate-800">{formatRupiah(row.pokok)}</td>
                            <td className="p-2 font-semibold text-amber-800">{formatRupiah(row.bunga)}</td>
                            <td className="p-2 font-extrabold text-emerald-800">{formatRupiah(row.totalBayar)}</td>
                            <td className="p-2 font-bold text-slate-700">{formatRupiah(row.sisaPokok)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 text-right">
              <button
                type="button"
                onClick={() => setHistoryBankModalItem(null)}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg font-bold text-xs hover:bg-slate-900 cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL KALKULATOR SIMULASI STANDALONE ================= */}
      {showSimulasiModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 border border-slate-200 my-8">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <i className="fa-solid fa-calculator text-amber-400"></i>
                Kalkulator Simulasi Angsuran & Bunga Bank Realistis
              </h3>
              <button
                type="button"
                onClick={() => setShowSimulasiModal(false)}
                className="text-white hover:text-amber-300 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">Plafon Pinjaman (Rp)</label>
                  <input
                    type="text"
                    value={simPlafon ? formatRupiah(parseInt(simPlafon.replace(/\D/g, '')) || 0) : ''}
                    onChange={(e) => setSimPlafon(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Bunga (% / tahun)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={simBungaPct}
                    onChange={(e) => setSimBungaPct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-extrabold text-slate-900"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">Tenor (Bulan)</label>
                  <select
                    value={simTenor}
                    onChange={(e) => setSimTenor(parseInt(e.target.value) || 12)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-extrabold text-slate-900 bg-white"
                  >
                    <option value={6}>6 Bulan</option>
                    <option value={12}>12 Bulan (1 Thn)</option>
                    <option value={24}>24 Bulan (2 Thn)</option>
                    <option value={36}>36 Bulan (3 Thn)</option>
                    <option value={48}>48 Bulan (4 Thn)</option>
                    <option value={60}>60 Bulan (5 Thn)</option>
                  </select>
                </div>
              </div>

              {/* RESULT PREVIEW */}
              {parseInt(simPlafon.replace(/\D/g, '')) > 0 && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="text-[10px] text-gray-500 font-bold block uppercase">Angsuran Pokok / Bln</span>
                      <span className="text-sm font-black text-slate-900">
                        {formatRupiah(Math.round(parseInt(simPlafon.replace(/\D/g, '')) / simTenor))}
                      </span>
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl">
                      <span className="text-[10px] text-amber-800 font-bold block uppercase">Estimasi Bunga / Bln</span>
                      <span className="text-sm font-black text-amber-950">
                        {formatRupiah(
                          Math.round(
                            (parseInt(simPlafon.replace(/\D/g, '')) * ((parseFloat(simBungaPct) || 0) / 100)) / 12
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-900 text-white rounded-xl flex justify-between items-center font-extrabold">
                    <span>ESTIMASI ANGSURAN BULANAN:</span>
                    <span className="text-base text-amber-300">
                      {formatRupiah(
                        Math.round(parseInt(simPlafon.replace(/\D/g, '')) / simTenor) +
                          Math.round(
                            (parseInt(simPlafon.replace(/\D/g, '')) * ((parseFloat(simBungaPct) || 0) / 100)) / 12
                          )
                      )}
                    </span>
                  </div>

                  {/* AMORTIZATION PREVIEW TABLE */}
                  <div className="max-h-52 overflow-y-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-800 text-[10px] uppercase font-bold sticky top-0">
                        <tr>
                          <th className="p-2">Bln</th>
                          <th className="p-2">Pokok</th>
                          <th className="p-2">Bunga</th>
                          <th className="p-2">Total Bayar</th>
                          <th className="p-2">Sisa Pokok</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-[11px]">
                        {generateAmortizationTable(
                          parseInt(simPlafon.replace(/\D/g, '')) || 0,
                          parseFloat(simBungaPct) || 0,
                          simTenor
                        ).map((r) => (
                          <tr key={r.bulanKe} className="hover:bg-slate-50">
                            <td className="p-2 font-bold">{r.bulanKe}</td>
                            <td className="p-2">{formatRupiah(r.pokok)}</td>
                            <td className="p-2 text-amber-700">{formatRupiah(r.bunga)}</td>
                            <td className="p-2 font-bold text-emerald-800">{formatRupiah(r.totalBayar)}</td>
                            <td className="p-2 text-gray-600">{formatRupiah(r.sisaPokok)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowSimulasiModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 cursor-pointer"
                >
                  Tutup Kalkulator
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL BAYAR ANGSURAN / PELUNASAN SUPPLIER / PIUTANG ================= */}
      {payModalItem && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div
              className={`p-4 text-white flex justify-between items-center ${
                payModalItem.type === 'piutang' ? 'bg-emerald-900' : 'bg-rose-900'
              }`}
            >
              <h3 className="font-bold text-sm flex items-center gap-2">
                <i className="fa-solid fa-calculator"></i>
                {payModalItem.type === 'piutang'
                  ? `Pelunasan Piutang: ${payModalItem.title}`
                  : `Pembayaran Utang: ${payModalItem.title}`}
              </h3>
              <button
                onClick={() => setPayModalItem(null)}
                className="text-white hover:text-gray-200 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmPay} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 flex justify-between items-center">
                <span className="font-bold text-gray-700">Sisa Tagihan Saat Ini:</span>
                <span className="font-extrabold text-sm text-gray-900">{formatRupiah(payModalItem.sisa)}</span>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Nominal Pembayaran / Angsuran (Rp) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bayarNominal ? formatRupiah(parseInt(bayarNominal.replace(/\D/g, '')) || 0) : ''}
                  onChange={(e) => setBayarNominal(e.target.value)}
                  placeholder="Rp 0"
                  className="w-full px-3 py-2 border-2 border-amber-300 rounded-lg text-sm font-extrabold focus:outline-none focus:border-amber-500 text-amber-950 bg-white"
                  required
                />
                <div className="flex gap-1.5 mt-2">
                  <button
                    type="button"
                    onClick={() => setBayarNominal(String(payModalItem.sisa))}
                    className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] cursor-pointer"
                  >
                    Bayar Lunas (100%)
                  </button>
                  {payModalItem.sisa >= 200000 && (
                    <button
                      type="button"
                      onClick={() => setBayarNominal(String(Math.round(payModalItem.sisa / 2)))}
                      className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold rounded text-[10px] cursor-pointer"
                    >
                      Bayar 50%
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Metode Pembayaran Kas/Bank <span className="text-red-500">*</span>
                </label>
                <select
                  value={metodeBayar}
                  onChange={(e) => setMetodeBayar(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-bold text-gray-800 bg-white"
                >
                  {paymentMethods.map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setPayModalItem(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`px-4 py-2 font-bold text-white rounded-lg shadow-sm cursor-pointer ${
                    payModalItem.type === 'piutang'
                      ? 'bg-emerald-700 hover:bg-emerald-800'
                      : 'bg-rose-700 hover:bg-rose-800'
                  }`}
                >
                  {isSubmitting ? 'Memproses...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

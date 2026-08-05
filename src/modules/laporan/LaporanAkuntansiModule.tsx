import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  getJurnal,
  getBukuBesarData,
  getPiutangDetail,
  getUtang,
  getAllRiwayatBayar,
  getKartuStokAll,
  getJurnalPenyesuaianAll,
  saveJurnalPenyesuaianEntry,
  getLapKeuanganFull,
  saveJurnalPenutup
} from '../../services/firebaseService';
import { Account } from '../../types';

interface LaporanAkuntansiModuleProps {
  accounts: Account[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const LaporanAkuntansiModule: React.FC<LaporanAkuntansiModuleProps> = ({
  accounts,
  onSuccess,
  onError
}) => {
  const [sDate, setSDate] = useState(() => {
    const n = new Date();
    return formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
  });
  const [eDate, setEDate] = useState(() => formatISO(new Date()));

  const [activeTab, setActiveTab] = useState<
    'ju' | 'jk' | 'bb' | 'bbp' | 'ks' | 'ns' | 'jp' | 'nl' | 'lk' | 'jpt'
  >('ju');

  const [subTabBBP, setSubTabBBP] = useState<'piutang' | 'utang'>('piutang');
  const [subTabLK, setSubTabLK] = useState<'lr' | 'ek' | 'npk' | 'ak' | 'calk'>('lr');

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Penyesuaian Form
  const [showJPForm, setShowJPForm] = useState(false);
  const [jpTgl, setJpTgl] = useState(() => formatISO(new Date()));
  const [jpBukti, setJpBukti] = useState('');
  const [jpDb, setJpDb] = useState('');
  const [jpKr, setJpKr] = useState('');
  const [jpKet, setJpKet] = useState('');
  const [jpNom, setJpNom] = useState('');

  const fetchTabContent = async () => {
    setLoading(true);
    setData(null);
    try {
      if (activeTab === 'ju' || activeTab === 'jk') {
        const res = await getJurnal(sDate, eDate);
        setData(res || []);
      } else if (activeTab === 'bb' || activeTab === 'ns') {
        const res = await getBukuBesarData(sDate, eDate);
        setData(res || []);
      } else if (activeTab === 'bbp') {
        if (subTabBBP === 'piutang') {
          const [piuts, pays] = await Promise.all([
            getPiutangDetail(),
            getAllRiwayatBayar('piutang')
          ]);
          setData({ piuts: piuts || [], pays: pays || [] });
        } else {
          const [utangs, pays] = await Promise.all([
            getUtang(),
            getAllRiwayatBayar('utang')
          ]);
          setData({ utangs: utangs || [], pays: pays || [] });
        }
      } else if (activeTab === 'ks') {
        const res = await getKartuStokAll(sDate, eDate);
        setData(res || []);
      } else if (activeTab === 'jp') {
        const res = await getJurnalPenyesuaianAll(sDate, eDate);
        setData(res || []);
      } else if (activeTab === 'nl') {
        const [bb, jp] = await Promise.all([
          getBukuBesarData(sDate, eDate),
          getJurnalPenyesuaianAll(sDate, eDate)
        ]);
        setData({ bb: bb || [], jp: jp || [] });
      } else if (activeTab === 'lk' || activeTab === 'jpt') {
        const res = await getLapKeuanganFull(eDate);
        setData(res || null);
      }
    } catch (e) {
      console.error(e);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTabContent();
  }, [activeTab, sDate, eDate, subTabBBP]);

  const handleBulanIni = () => {
    const n = new Date();
    const s = formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
    const e = formatISO(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    setSDate(s);
    setEDate(e);
  };

  // Submit Penyesuaian
  const handleSaveJP = async () => {
    if (!jpTgl || !jpBukti || !jpDb || !jpKr || !jpNom) {
      onError('Lengkapi semua data penyesuaian!');
      return;
    }
    if (jpDb === jpKr) {
      onError('Akun Debit dan Kredit tidak boleh sama!');
      return;
    }

    const num = parseInt(jpNom.replace(/\D/g, '')) || 0;
    if (num <= 0) {
      onError('Nominal harus lebih dari 0!');
      return;
    }

    try {
      const res = await saveJurnalPenyesuaianEntry(
        JSON.stringify({
          tanggal: jpTgl,
          bukti: jpBukti,
          debit: jpDb,
          kredit: jpKr,
          keterangan: jpKet,
          nominal: num
        })
      );

      if (res && res.ok) {
        onSuccess('Jurnal Penyesuaian berhasil disimpan!');
        setJpBukti('');
        setJpKet('');
        setJpNom('');
        setShowJPForm(false);
        fetchTabContent();
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    }
  };

  // Submit Closing Entry
  const handleExecPenutup = async () => {
    if (!data) return;
    if (!window.confirm('Jalankan jurnal penutup? Akun Pendapatan, HPP, dan Beban akan ditutup ke Modal Pemilik.')) return;

    try {
      const entries: any[] = [];
      const tgl = formatISO(new Date());
      let bIdx = 0;
      const bBase = 'JPT' + String(Date.now()).slice(-6);

      // Tutup Pendapatan
      Object.keys(data.pend).forEach((ak) => {
        entries.push({
          bukti: `${bBase}-${++bIdx}`,
          debit: ak,
          kredit: 'MODAL PEMILIK',
          keterangan: 'Tutup ' + ak,
          nominal: data.pend[ak]
        });
      });

      // Tutup HPP & Beban
      Object.keys(data.hpp).forEach((ak) => {
        entries.push({
          bukti: `${bBase}-${++bIdx}`,
          debit: 'MODAL PEMILIK',
          kredit: ak,
          keterangan: 'Tutup ' + ak,
          nominal: data.hpp[ak]
        });
      });

      Object.keys(data.beban).forEach((ak) => {
        entries.push({
          bukti: `${bBase}-${++bIdx}`,
          debit: 'MODAL PEMILIK',
          kredit: ak,
          keterangan: 'Tutup ' + ak,
          nominal: data.beban[ak]
        });
      });

      if (data.prive > 0) {
        entries.push({
          bukti: `${bBase}-${++bIdx}`,
          debit: 'MODAL PEMILIK',
          kredit: 'PRIVE',
          keterangan: 'Tutup Prive',
          nominal: data.prive
        });
      }

      const res = await saveJurnalPenutup(JSON.stringify({ tanggal: tgl, entries }));
      if (res && res.ok) {
        onSuccess('Jurnal penutup berhasil diposting!');
        fetchTabContent();
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    try {
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"/></head>
        <body>
          <h2>TOKO HAYBIKE - LAPORAN KEUANGAN</h2>
          <p>Periode: ${sDate} s/d ${eDate}</p>
          <p>Format Data Excel Lengkap HayBike System V2.0</p>
        </body>
        </html>
      `;
      const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/vnd.ms-excel' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan_Keuangan_Lengkap_${sDate}_sd_${eDate}.xls`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onSuccess('File Excel berhasil diunduh!');
    } catch (e: any) {
      onError(e.message || 'Gagal ekspor Excel');
    }
  };

  // Export PDF
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Top Controls */}
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
          onClick={fetchTabContent}
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

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleExportPDF}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <i className="fa-solid fa-file-pdf"></i> Ekspor PDF
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <i className="fa-solid fa-file-excel"></i> Ekspor Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 bg-white p-2 rounded-t-xl border-b border-emerald-200">
        {[
          ['ju', 'Jurnal Umum'],
          ['jk', 'Jurnal Khusus'],
          ['bb', 'Buku Besar'],
          ['bbp', 'BB Pembantu'],
          ['ks', 'Kartu Stok'],
          ['ns', 'Neraca Saldo'],
          ['jp', 'Jurnal Penyesuaian'],
          ['nl', 'Neraca Lajur'],
          ['lk', 'Lap. Keuangan'],
          ['jpt', 'Jurnal Penutup']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key as any)}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              activeTab === key
                ? 'bg-emerald-600 text-white shadow'
                : 'text-emerald-800 hover:bg-emerald-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm min-h-[350px]">
        {loading ? (
          <div className="text-center py-16 text-emerald-600">
            <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
            <p className="text-xs font-semibold">Menghitung laporan akuntansi...</p>
          </div>
        ) : !data ? (
          <p className="text-center text-emerald-400 py-12 text-xs">Tidak ada data</p>
        ) : (
          <>
            {/* 1. JURNAL UMUM */}
            {activeTab === 'ju' && Array.isArray(data) && (
              <div className="space-y-3">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">1. Jurnal Umum</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                        <th className="p-2.5">Tanggal</th>
                        <th className="p-2.5">No Bukti</th>
                        <th className="p-2.5">Akun Debit</th>
                        <th className="p-2.5">Akun Kredit</th>
                        <th className="p-2.5">Keterangan</th>
                        <th className="p-2.5 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {data.map((j: any, idx: number) => (
                        <tr key={idx} className="hover:bg-emerald-50/50">
                          <td className="p-2.5 whitespace-nowrap">{j.tanggal}</td>
                          <td className="p-2.5 font-mono text-[10px] text-emerald-700">{j.bukti}</td>
                          <td className="p-2.5 font-semibold text-blue-900">{j.debit}</td>
                          <td className="p-2.5 font-semibold text-emerald-900">{j.kredit}</td>
                          <td className="p-2.5">{j.ket}</td>
                          <td className="p-2.5 text-right font-bold">{formatRupiah(j.nominal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 2. JURNAL KHUSUS */}
            {activeTab === 'jk' && Array.isArray(data) && (
              <div className="space-y-4">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">2. Jurnal Khusus</h4>
                {['Pembelian', 'Penjualan', 'Penerimaan Kas', 'Pengeluaran Kas', 'Umum'].map((catName) => {
                  const items = data.filter((d: any) => {
                    const db = d.debit.toUpperCase();
                    const kr = d.kredit.toUpperCase();
                    if (catName === 'Pembelian') return db.includes('HPP') || kr.includes('PERSEDIAAN');
                    if (catName === 'Penjualan') return db.includes('PIUTANG') || (db === 'KAS' && kr.includes('PENJUALAN'));
                    if (catName === 'Penerimaan Kas') return db === 'KAS' || db.includes('BANK');
                    if (catName === 'Pengeluaran Kas') return kr === 'KAS' || kr.includes('BANK');
                    return true;
                  });

                  if (items.length === 0) return null;

                  return (
                    <div key={catName} className="space-y-2 border border-emerald-100 rounded-xl p-3 bg-emerald-50/30">
                      <h5 className="font-bold text-xs text-emerald-800">
                        Jurnal {catName} ({items.length})
                      </h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                              <th className="p-2">Tgl</th>
                              <th className="p-2">Bukti</th>
                              <th className="p-2">Debit</th>
                              <th className="p-2">Kredit</th>
                              <th className="p-2">Ket</th>
                              <th className="p-2 text-right">Nominal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-emerald-50">
                            {items.map((r: any, i: number) => (
                              <tr key={i} className="hover:bg-emerald-50">
                                <td className="p-2">{r.tanggal}</td>
                                <td className="p-2 font-mono text-[10px]">{r.bukti}</td>
                                <td className="p-2">{r.debit}</td>
                                <td className="p-2">{r.kredit}</td>
                                <td className="p-2">{r.ket}</td>
                                <td className="p-2 text-right font-bold">{formatRupiah(r.nominal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. BUKU BESAR */}
            {activeTab === 'bb' && Array.isArray(data) && (
              <div className="space-y-4">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">3. Buku Besar Akun</h4>
                {data.map((a: any, idx: number) => (
                  <div key={a.id || `${a.akun}-${idx}`} className="border border-emerald-200 rounded-xl p-3 bg-white space-y-2">
                    <div className="flex justify-between items-center bg-emerald-100 px-3 py-1.5 rounded-lg">
                      <h5 className="font-bold text-xs text-emerald-900">{a.akun}</h5>
                      <span className="text-[10px] text-emerald-700 font-semibold">
                        {a.kelompok} &bull; Saldo Akhir: {formatRupiah(Math.abs(a.saldoAkhir))}
                      </span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-emerald-50 font-bold text-[10px] text-emerald-800 border-b border-emerald-100 uppercase">
                            <th className="p-2">Tgl</th>
                            <th className="p-2">Bukti</th>
                            <th className="p-2">Keterangan</th>
                            <th className="p-2 text-right">Debit</th>
                            <th className="p-2 text-right">Kredit</th>
                            <th className="p-2 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          {(a.entries || []).map((e: any, i: number) => (
                            <tr key={i} className="hover:bg-emerald-50/50">
                              <td className="p-2">{e.tgl}</td>
                              <td className="p-2 font-mono text-[10px]">{e.bukti}</td>
                              <td className="p-2">{e.ket}</td>
                              <td className="p-2 text-right">{e.d ? formatRupiah(e.d) : '-'}</td>
                              <td className="p-2 text-right">{e.k ? formatRupiah(e.k) : '-'}</td>
                              <td className="p-2 text-right font-bold text-emerald-900">{formatRupiah(Math.abs(e.saldo))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 4. BB PEMBANTU */}
            {activeTab === 'bbp' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSubTabBBP('piutang')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      subTabBBP === 'piutang' ? 'bg-amber-600 text-white' : 'border border-amber-200 text-amber-800'
                    }`}
                  >
                    BB Pembantu Piutang Usaha
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTabBBP('utang')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      subTabBBP === 'utang' ? 'bg-red-600 text-white' : 'border border-red-200 text-red-800'
                    }`}
                  >
                    BB Pembantu Utang Usaha
                  </button>
                </div>

                {subTabBBP === 'piutang' && data && Array.isArray(data.piuts) && (
                  <div className="space-y-3">
                    {data.piuts.map((p: any) => {
                      const historyPays = (data.pays || []).filter((x: any) => x.id === p.id);
                      let runSaldo = p.nominal;

                      return (
                        <div key={p.id} className="border border-emerald-200 rounded-xl p-3 space-y-2">
                          <h5 className="font-bold text-xs text-amber-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                            {p.namaPembeli} &bull; Transaksi {p.id}
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-emerald-50 text-[10px] font-bold text-emerald-800 uppercase">
                                  <th className="p-2">Tgl</th>
                                  <th className="p-2">Keterangan</th>
                                  <th className="p-2 text-right">Debit</th>
                                  <th className="p-2 text-right">Kredit</th>
                                  <th className="p-2 text-right">Saldo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50">
                                <tr>
                                  <td className="p-2">{p.tanggal}</td>
                                  <td className="p-2">Penjualan Piutang: {p.keterangan}</td>
                                  <td className="p-2 text-right font-bold">{formatRupiah(p.nominal)}</td>
                                  <td className="p-2 text-right">-</td>
                                  <td className="p-2 text-right font-bold">{formatRupiah(p.nominal)}</td>
                                </tr>
                                {historyPays.map((hp: any, idx: number) => {
                                  runSaldo -= hp.jumlah;
                                  return (
                                    <tr key={idx}>
                                      <td className="p-2">{hp.tanggal}</td>
                                      <td className="p-2">Bayar via {hp.metode}</td>
                                      <td className="p-2 text-right">-</td>
                                      <td className="p-2 text-right text-emerald-600 font-bold">{formatRupiah(hp.jumlah)}</td>
                                      <td className="p-2 text-right font-bold">{formatRupiah(Math.max(0, runSaldo))}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {subTabBBP === 'utang' && data && Array.isArray(data.utangs) && (
                  <div className="space-y-3">
                    {data.utangs.map((u: any) => {
                      const historyPays = (data.pays || []).filter((x: any) => x.id === u.id);
                      let runSaldo = u.nominal;

                      return (
                        <div key={u.id} className="border border-emerald-200 rounded-xl p-3 space-y-2">
                          <h5 className="font-bold text-xs text-red-900 bg-red-50 p-2 rounded-lg border border-red-200">
                            Supplier: {u.namaSupplier} &bull; Invoice {u.id}
                          </h5>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-emerald-50 text-[10px] font-bold text-emerald-800 uppercase">
                                  <th className="p-2">Tgl</th>
                                  <th className="p-2">Keterangan</th>
                                  <th className="p-2 text-right">Kredit</th>
                                  <th className="p-2 text-right">Debit</th>
                                  <th className="p-2 text-right">Saldo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-emerald-50">
                                <tr>
                                  <td className="p-2">{u.tanggal}</td>
                                  <td className="p-2">Pembelian Utang: {u.keterangan}</td>
                                  <td className="p-2 text-right font-bold">{formatRupiah(u.nominal)}</td>
                                  <td className="p-2 text-right">-</td>
                                  <td className="p-2 text-right font-bold">{formatRupiah(u.nominal)}</td>
                                </tr>
                                {historyPays.map((hp: any, idx: number) => {
                                  runSaldo -= hp.jumlah;
                                  return (
                                    <tr key={idx}>
                                      <td className="p-2">{hp.tanggal}</td>
                                      <td className="p-2">Bayar via {hp.metode}</td>
                                      <td className="p-2 text-right">-</td>
                                      <td className="p-2 text-right text-emerald-600 font-bold">{formatRupiah(hp.jumlah)}</td>
                                      <td className="p-2 text-right font-bold">{formatRupiah(Math.max(0, runSaldo))}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* 5. KARTU STOK */}
            {activeTab === 'ks' && Array.isArray(data) && (
              <div className="space-y-4">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">5. Kartu Stok / Persediaan</h4>
                {data.map((c: any, idx: number) => (
                  <div key={c.id || `${c.kode}-${idx}`} className="border border-emerald-200 rounded-xl p-3 space-y-2">
                    <h5 className="font-bold text-xs text-emerald-900">
                      {c.nama} ({c.kode}) &bull; HPP Avg: {formatRupiah(c.modal)}
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                            <th className="p-2">Tgl</th>
                            <th className="p-2">Bukti</th>
                            <th className="p-2">Ket</th>
                            <th className="p-2 text-right">Masuk</th>
                            <th className="p-2 text-right">Keluar</th>
                            <th className="p-2 text-right">Saldo Qty</th>
                            <th className="p-2 text-right">Saldo Nilai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-50">
                          <tr className="bg-emerald-50 font-bold">
                            <td colSpan={3} className="p-2">Saldo Awal</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2 text-right">-</td>
                            <td className="p-2 text-right">{c.stokAwal}</td>
                            <td className="p-2 text-right">{formatRupiah(c.stokAwal * c.modal)}</td>
                          </tr>
                          {(c.movements || []).map((m: any, idx: number) => (
                            <tr key={idx}>
                              <td className="p-2">{m.tgl}</td>
                              <td className="p-2 font-mono text-[10px]">{m.bukti}</td>
                              <td className="p-2">{m.ket}</td>
                              <td className="p-2 text-right">{m.masuk || '-'}</td>
                              <td className="p-2 text-right">{m.keluar || '-'}</td>
                              <td className="p-2 text-right font-semibold">{c.stokAkhir}</td>
                              <td className="p-2 text-right font-bold">{formatRupiah(c.stokAkhir * c.modal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 6. NERACA SALDO */}
            {activeTab === 'ns' && Array.isArray(data) && (
              <div className="space-y-3">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">6. Neraca Saldo (Trial Balance)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                        <th className="p-2.5">No</th>
                        <th className="p-2.5">Nama Akun</th>
                        <th className="p-2.5">Kelompok</th>
                        <th className="p-2.5 text-right">Debit</th>
                        <th className="p-2.5 text-right">Kredit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {data.map((a: any, idx: number) => (
                        <tr key={a.id || `${a.akun}-${idx}`}>
                          <td className="p-2.5">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-emerald-950">{a.akun}</td>
                          <td className="p-2.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                              {a.kelompok}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-semibold">
                            {a.isDN ? formatRupiah(a.saldoAkhir) : '-'}
                          </td>
                          <td className="p-2.5 text-right font-semibold">
                            {!a.isDN ? formatRupiah(a.saldoAkhir) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. JURNAL PENYESUAIAN */}
            {activeTab === 'jp' && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">7. Jurnal Penyesuaian</h4>
                  <button
                    type="button"
                    onClick={() => setShowJPForm(!showJPForm)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <i className="fa-solid fa-plus"></i> Tambah Penyesuaian
                  </button>
                </div>

                {showJPForm && (
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={jpTgl}
                          onChange={(e) => setJpTgl(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">No Bukti</label>
                        <input
                          type="text"
                          value={jpBukti}
                          onChange={(e) => setJpBukti(e.target.value)}
                          placeholder="JP-001"
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">Akun Debit</label>
                        <select
                          value={jpDb}
                          onChange={(e) => setJpDb(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        >
                          <option value="">-- Pilih --</option>
                          {accounts.map((a, idx) => (
                            <option key={a.id || `${a.kode}-${idx}`} value={a.nama}>
                              {a.nama} ({a.kelompok})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">Akun Kredit</label>
                        <select
                          value={jpKr}
                          onChange={(e) => setJpKr(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        >
                          <option value="">-- Pilih --</option>
                          {accounts.map((a, idx) => (
                            <option key={a.id || `${a.kode}-${idx}`} value={a.nama}>
                              {a.nama} ({a.kelompok})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">Keterangan</label>
                        <input
                          type="text"
                          value={jpKet}
                          onChange={(e) => setJpKet(e.target.value)}
                          placeholder="Penyesuaian stok / penyusutan"
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-emerald-800 block mb-1">Nominal (Rp)</label>
                        <input
                          type="text"
                          value={jpNom ? formatRupiah(parseInt(jpNom.replace(/\D/g, '')) || 0) : ''}
                          onChange={(e) => setJpNom(e.target.value)}
                          placeholder="0"
                          className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveJP}
                        className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-lg text-xs"
                      >
                        Simpan Penyesuaian
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowJPForm(false)}
                        className="px-4 py-1.5 border border-emerald-200 font-semibold rounded-lg text-xs"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {Array.isArray(data) && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-emerald-100 text-emerald-900 font-bold uppercase text-[10px]">
                          <th className="p-2.5">Tanggal</th>
                          <th className="p-2.5">No Bukti</th>
                          <th className="p-2.5">Debit</th>
                          <th className="p-2.5">Kredit</th>
                          <th className="p-2.5">Keterangan</th>
                          <th className="p-2.5 text-right">Nominal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-50">
                        {data.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-emerald-400">
                              Belum ada penyesuaian
                            </td>
                          </tr>
                        ) : (
                          (Array.isArray(data) ? data : []).map((j: any, i: number) => (
                            <tr key={i}>
                              <td className="p-2.5">{j.tanggal}</td>
                              <td className="p-2.5 font-mono text-[10px]">{j.bukti}</td>
                              <td className="p-2.5 font-semibold text-blue-900">{j.debit}</td>
                              <td className="p-2.5 font-semibold text-emerald-900">{j.kredit}</td>
                              <td className="p-2.5">{j.ket}</td>
                              <td className="p-2.5 text-right font-bold">{formatRupiah(j.nominal)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* 8. NERACA LAJUR */}
            {activeTab === 'nl' && data && Array.isArray(data.bb) && (
              <div className="space-y-3">
                <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">8. Neraca Lajur (Worksheet)</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-emerald-950 text-white font-bold uppercase text-[9px]">
                        <th className="p-2">Nama Akun</th>
                        <th className="p-2 text-right">NS Debit</th>
                        <th className="p-2 text-right">NS Kredit</th>
                        <th className="p-2 text-right">Adj Debit</th>
                        <th className="p-2 text-right">Adj Kredit</th>
                        <th className="p-2 text-right">Laba Rugi</th>
                        <th className="p-2 text-right">Neraca</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {data.bb.map((a: any, idx: number) => (
                        <tr key={a.id || `${a.akun}-${idx}`} className="hover:bg-emerald-50">
                          <td className="p-2 font-bold text-emerald-950">{a.akun}</td>
                          <td className="p-2 text-right">{a.isDN ? formatRupiah(a.saldoAkhir) : '-'}</td>
                          <td className="p-2 text-right">{!a.isDN ? formatRupiah(a.saldoAkhir) : '-'}</td>
                          <td className="p-2 text-right">-</td>
                          <td className="p-2 text-right">-</td>
                          <td className="p-2 text-right font-semibold">
                            {['Pendapatan', 'HPP', 'Beban'].includes(a.kelompok) ? formatRupiah(a.saldoAkhir) : '-'}
                          </td>
                          <td className="p-2 text-right font-semibold">
                            {!['Pendapatan', 'HPP', 'Beban'].includes(a.kelompok) ? formatRupiah(a.saldoAkhir) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 9. LAPORAN KEUANGAN FULL */}
            {activeTab === 'lk' && data && (
              <div className="space-y-4">
                <div className="flex gap-1 overflow-x-auto pb-1">
                  {[
                    ['lr', 'Laba Rugi'],
                    ['ek', 'Perubahan Ekuitas'],
                    ['npk', 'Posisi Keuangan (Neraca)'],
                    ['ak', 'Arus Kas'],
                    ['calk', 'CALK']
                  ].map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setSubTabLK(k as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        subTabLK === k ? 'bg-emerald-600 text-white' : 'border border-emerald-200 text-emerald-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {subTabLK === 'lr' && (
                  <div className="space-y-3 text-xs">
                    <h5 className="font-bold text-emerald-900 border-b pb-1">LAPORAN LABA RUGI</h5>
                    <div className="flex justify-between font-bold text-emerald-950">
                      <span>Total Pendapatan</span>
                      <span>{formatRupiah(data.tp)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-950">
                      <span>Total HPP</span>
                      <span>{formatRupiah(data.th)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700 bg-emerald-50 p-2 rounded">
                      <span>LABA KOTOR</span>
                      <span>{formatRupiah(data.tp - data.th)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-950">
                      <span>Total Beban Operasional</span>
                      <span>{formatRupiah(data.tb)}</span>
                    </div>
                    <div className="flex justify-between font-black text-sm bg-emerald-600 text-white p-3 rounded-xl">
                      <span>LABA BERSIH</span>
                      <span>{formatRupiah(data.lr)}</span>
                    </div>
                  </div>
                )}

                {subTabLK === 'ek' && (
                  <div className="space-y-3 text-xs">
                    <h5 className="font-bold text-emerald-900 border-b pb-1">LAPORAN PERUBAHAN EKUITAS</h5>
                    <div className="flex justify-between"><span>Modal Awal</span><span>{formatRupiah(data.modalAwal)}</span></div>
                    <div className="flex justify-between text-emerald-600 font-bold"><span>Laba Bersih</span><span>{formatRupiah(data.lr)}</span></div>
                    <div className="flex justify-between text-red-500 font-bold"><span>Prive</span><span>{formatRupiah(data.prive)}</span></div>
                    <div className="flex justify-between font-bold text-sm bg-emerald-950 text-white p-3 rounded-xl">
                      <span>Modal Akhir</span><span>{formatRupiah(data.modalAkhir)}</span>
                    </div>
                  </div>
                )}

                {subTabLK === 'npk' && data && (
                  <div className="space-y-4 text-xs">
                    <h5 className="font-bold text-emerald-900 border-b pb-1">LAPORAN POSISI KEUANGAN (NERACA)</h5>

                    <div className="space-y-1">
                      <p className="font-bold text-emerald-800 uppercase">ASET LANCAR</p>
                      {(data.asetLancir || []).map((a: any, idx: number) => (
                        <div key={a.id || `${a.nama}-${idx}`} className="flex justify-between pl-3 py-1 border-b border-emerald-50">
                          <span>{a.nama}</span>
                          <span className="font-semibold">{formatRupiah(a.saldo)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-1 text-emerald-900">
                        <span>Total Aset Lancar</span>
                        <span>{formatRupiah(data.totalAsetLancir || 0)}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="font-bold text-emerald-800 uppercase">KEWAJIBAN</p>
                      {(data.kewajiban || []).map((k: any, idx: number) => (
                        <div key={k.id || `${k.nama}-${idx}`} className="flex justify-between pl-3 py-1 border-b border-emerald-50">
                          <span>{k.nama}</span>
                          <span className="font-semibold">{formatRupiah(k.saldo)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between font-bold pt-1 text-emerald-900">
                        <span>Total Kewajiban</span>
                        <span>{formatRupiah(data.totalKewajiban || 0)}</span>
                      </div>
                    </div>

                    <div className="flex justify-between font-black text-sm bg-emerald-950 text-white p-3 rounded-xl">
                      <span>TOTAL KEWAJIBAN & EKUITAS</span>
                      <span>{formatRupiah(data.totalKewajiban + data.modalAkhir)}</span>
                    </div>
                  </div>
                )}

                {subTabLK === 'ak' && (
                  <div className="space-y-3 text-xs">
                    <h5 className="font-bold text-emerald-900 border-b pb-1">LAPORAN ARUS KAS (METODE LANGSUNG)</h5>
                    <div className="flex justify-between font-bold"><span>Kas Netto Operasi</span><span>{formatRupiah(data.kasMasuk - data.kasKeluar)}</span></div>
                    <div className="flex justify-between font-bold"><span>Kas Netto Investasi</span><span>{formatRupiah(-data.totalPerolehanAT)}</span></div>
                    <div className="flex justify-between font-bold"><span>Kas Netto Pendanaan</span><span>{formatRupiah(-data.prive - data.utangBankKeluar)}</span></div>
                  </div>
                )}

                {subTabLK === 'calk' && (
                  <div className="space-y-3 text-xs text-gray-700 leading-relaxed">
                    <h5 className="font-bold text-emerald-900 border-b pb-1">CATATAN ATAS LAPORAN KEUANGAN (CALK)</h5>
                    <p><b>1. Informasi Umum:</b> Toko HayBike, Majalengka. Operasional penjualan & servis sepeda.</p>
                    <p><b>2. Kebijakan Akuntansi:</b> Menggunakan basis akrual dengan metode pencatatan persediaan HPP Average Rata-Rata Bergerak.</p>
                  </div>
                )}
              </div>
            )}

            {/* 10. JURNAL PENUTUP */}
            {activeTab === 'jpt' && data && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">10. Jurnal Penutup</h4>
                  <button
                    type="button"
                    onClick={handleExecPenutup}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
                  >
                    <i className="fa-solid fa-check-double"></i> Jalankan Jurnal Penutup
                  </button>
                </div>

                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800">
                  <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
                  Proses ini menutup seluruh akun Pendapatan, HPP, dan Beban Operasional periode ini ke akun Modal Pemilik.
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

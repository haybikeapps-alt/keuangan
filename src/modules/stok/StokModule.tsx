import React, { useState, useEffect } from 'react';
import {
  formatISO,
  formatRupiah,
  subscribeProducts,
  getUtang,
  saveStockPurchase,
  saveStockOpname
} from '../../services/firebaseService';
import { Product, PaymentMethod, UtangItem, StockOpnameItem } from '../../types';
import { ExcelImportModal } from '../../components/ExcelImportModal';

interface StokModuleProps {
  paymentMethods: PaymentMethod[];
  userRole?: 'admin' | 'kasir';
  onOpenPayModalUtang: (item: UtangItem) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const StokModule: React.FC<StokModuleProps> = ({
  paymentMethods,
  userRole = 'kasir',
  onOpenPayModalUtang,
  onSuccess,
  onError
}) => {
  // Halaman Stok memang boleh dibuka kasir untuk mengecek harga dan sisa barang.
  // Tetapi Restock, Import Excel, Stok Opname, dan kartu Utang Usaha adalah
  // kewenangan pemilik: ketiganya menciptakan persediaan, jurnal, dan utang
  // supplier. Sebelum ini semuanya terbuka untuk siapa pun yang login.
  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);

  // Restock Modal State
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [sKat, setSKat] = useState('Sepeda');
  const [sKode, setSKode] = useState('');
  const [sNamaNew, setSNamaNew] = useState('');
  const [sQty, setSQty] = useState(1);
  const [sModal, setSModal] = useState('');
  const [sJual, setSJual] = useState('');
  const [sSatuan, setSSatuan] = useState('pcs');
  const [sMetode, setSMetode] = useState('Kas');
  const [restockList, setRestockList] = useState<any[]>([]);

  // Opname Modal State
  const [isOpnameOpen, setIsOpnameOpen] = useState(false);
  const [opTgl, setOpTgl] = useState(() => formatISO(new Date()));
  const [opQuery, setOpQuery] = useState('');
  const [opFisikMap, setOpFisikMap] = useState<Record<string, number>>({});

  // Excel Import Modal State
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);

  // Utang Usaha State
  const [utangList, setUtangList] = useState<UtangItem[]>([]);
  const [loadingUtang, setLoadingUtang] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsub = subscribeProducts((prods) => {
      setProducts(prods);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (activeTab === 'utang' && isAdmin) {
      loadUtangData();
    }
  }, [activeTab, isAdmin]);

  const loadUtangData = async () => {
    setLoadingUtang(true);
    try {
      const res = await getUtang();
      setUtangList(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUtang(false);
    }
  };

  // Restock logic
  const handleSelectProdRestock = (code: string) => {
    setSKode(code);
    if (!code) {
      setSNamaNew('');
      return;
    }
    const found = products.find((p) => p.kode === code);
    if (found) {
      setSNamaNew(found.nama);
      setSModal(String(found.modal));
      setSJual(String(found.jual));
    }
  };

  const addRestockItem = () => {
    const nama = sNamaNew.trim() || (sKode ? 'Baru' : '');
    if (!nama) {
      onError('Pilih produk atau isi nama barang baru!');
      return;
    }

    const numModal = parseInt(sModal.replace(/\D/g, '')) || 0;
    const numJual = parseInt(sJual.replace(/\D/g, '')) || 0;

    setRestockList([
      ...restockList,
      {
        kode: sKode || 'HB-' + Date.now().toString().slice(-6),
        nama,
        kategori: sKat,
        satuan: sSatuan,
        qty: Number(sQty) || 1,
        modal: numModal,
        jual: numJual
      }
    ]);

    setSKode('');
    setSNamaNew('');
    setSModal('');
    setSJual('');
  };

  const submitRestock = async () => {
    if (restockList.length === 0) {
      onError('Tambahkan minimal 1 barang ke daftar!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveStockPurchase(
        JSON.stringify({
          items: restockList,
          metode: sMetode,
          tanggal: formatISO(new Date())
        })
      );

      if (res && res.ok) {
        onSuccess('Restock barang berhasil disimpan!');
        setIsRestockOpen(false);
        setRestockList([]);
      } else {
        onError('Gagal menyimpan restock');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stock Opname Logic
  const handleOpenOpname = () => {
    setOpTgl(formatISO(new Date()));
    setOpQuery('');
    const initialMap: Record<string, number> = {};
    products.forEach((p) => {
      initialMap[p.kode] = p.stok;
    });
    setOpFisikMap(initialMap);
    setIsOpnameOpen(true);
  };

  const handleOpFisikChange = (kode: string, val: string) => {
    const num = parseInt(val) || 0;
    setOpFisikMap((prev) => ({ ...prev, [kode]: num }));
  };

  const submitOpname = async () => {
    const itemsToCorrect: StockOpnameItem[] = [];
    products.forEach((p) => {
      const fisik = opFisikMap[p.kode] !== undefined ? opFisikMap[p.kode] : p.stok;
      if (fisik !== p.stok) {
        itemsToCorrect.push({ kode: p.kode, qtyFisik: fisik });
      }
    });

    if (itemsToCorrect.length === 0) {
      onError('Tidak ada selisih stok yang perlu dikoreksi.');
      return;
    }

    if (!window.confirm(`Simpan koreksi stok untuk ${itemsToCorrect.length} barang?`)) return;

    setIsSubmitting(true);
    try {
      const res = await saveStockOpname(
        JSON.stringify({
          items: itemsToCorrect,
          tanggal: opTgl
        })
      );

      if (res && res.ok) {
        onSuccess(`Stok berhasil dikoreksi! No Opname: ${res.id}`);
        setIsOpnameOpen(false);
      } else {
        onError(res?.msg || 'Gagal menyimpan opname');
      }
    } catch (e: any) {
      onError(e.message || 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!activeTab || activeTab === 'utang') return true;
    return p.kategori === activeTab;
  });

  return (
    <div className="space-y-4">
      {/* Tab Navigation & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
        <div className="flex flex-wrap gap-1">
          {['', 'Sepeda', 'Sparepart', 'Aksesoris', ...(isAdmin ? ['utang'] : [])].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === tab
                  ? tab === 'utang'
                    ? 'bg-red-500 text-white shadow'
                    : 'bg-emerald-600 text-white shadow'
                  : tab === 'utang'
                  ? 'border border-red-200 text-red-600 hover:bg-red-50'
                  : 'border border-emerald-200 text-emerald-800 hover:bg-emerald-50'
              }`}
            >
              {tab === '' ? 'Semua' : tab === 'utang' ? 'Utang Usaha' : tab}
            </button>
          ))}
        </div>

        <div className={`flex flex-wrap gap-2 ${isAdmin ? '' : 'hidden'}`}>
          <button
            type="button"
            onClick={() => setIsExcelImportOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-900 hover:bg-emerald-950 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow cursor-pointer"
          >
            <i className="fa-solid fa-file-excel text-emerald-400"></i>
            Import Excel (+35% Laba)
          </button>
          <button
            type="button"
            onClick={handleOpenOpname}
            className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
          >
            <i className="fa-solid fa-clipboard-check text-emerald-500"></i>
            Stock Opname
          </button>
          <button
            type="button"
            onClick={() => {
              setRestockList([]);
              setIsRestockOpen(true);
            }}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            <i className="fa-solid fa-plus"></i>
            Tambah / Restock
          </button>
        </div>
      </div>

      {/* VIEW 1: PRODUCTS TABLE */}
      {activeTab !== 'utang' && (
        <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-100/70 text-emerald-900 border-b border-emerald-200 uppercase font-bold text-[10px] tracking-wider">
                  <th className="p-3">Kode</th>
                  <th className="p-3">Nama Barang</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Satuan</th>
                  <th className="p-3 text-right">Harga Modal (Avg)</th>
                  <th className="p-3 text-right">Harga Jual</th>
                  <th className="p-3 text-center">Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-50">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-emerald-400">
                      <i className="fa-solid fa-box-open text-2xl mb-1 block"></i>
                      Tidak ada data produk
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p, idx) => (
                    <tr
                      key={p.id || `${p.kode}-${idx}`}
                      className={`transition ${
                        p.stok <= 0
                          ? 'bg-rose-50/70 hover:bg-rose-100/70'
                          : p.stok <= 3
                          ? 'bg-amber-50/50 hover:bg-amber-100/50'
                          : 'hover:bg-emerald-50/50'
                      }`}
                    >
                      <td className="p-3 font-mono text-[10px] text-emerald-700 font-semibold">{p.kode}</td>
                      <td className="p-3 font-semibold text-emerald-950 flex items-center gap-1.5">
                        <span>{p.nama}</span>
                        {p.stok <= 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-rose-600 text-white text-[9px] font-black uppercase">
                            Habis
                          </span>
                        )}
                        {p.stok > 0 && p.stok <= 3 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white text-[9px] font-black uppercase">
                            Kritis
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {p.kategori}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600">{p.satuan}</td>
                      <td className="p-3 text-right font-semibold text-emerald-800">{formatRupiah(p.modal)}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{formatRupiah(p.jual)}</td>
                      <td className="p-3 text-center">
                        <span
                          className={`font-black ${
                            p.stok <= 0 ? 'text-rose-600' : p.stok <= 3 ? 'text-amber-700 font-black' : 'text-emerald-700'
                          }`}
                        >
                          {p.stok}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW 2: UTANG USAHA SECTION */}
      {activeTab === 'utang' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-100">
            <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-2">
              <i className="fa-solid fa-truck-field text-red-500"></i>
              Daftar Utang Usaha ke Supplier
              <span className="px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-bold">
                {utangList.length}
              </span>
            </h3>
            <button
              type="button"
              onClick={loadUtangData}
              className="px-3 py-1.5 border border-emerald-200 text-emerald-800 hover:border-emerald-500 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate"></i> Muat Ulang
            </button>
          </div>

          {loadingUtang ? (
            <div className="text-center py-10 text-emerald-600">
              <i className="fa-solid fa-spinner fa-spin text-xl mb-1"></i>
              <p className="text-xs">Memuat utang usaha...</p>
            </div>
          ) : utangList.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-emerald-100 text-center text-emerald-400 text-xs">
              <i className="fa-solid fa-circle-check text-3xl mb-2 text-emerald-500"></i>
              <p className="font-bold text-emerald-800">Tidak ada utang usaha</p>
              <p>Semua utang ke supplier telah lunas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {utangList.map((u) => {
                const pct = u.nominal > 0 ? Math.min(100, Math.round((u.dibayar / u.nominal) * 100)) : 0;
                return (
                  <div
                    key={u.id}
                    onClick={() => onOpenPayModalUtang(u)}
                    className="bg-white p-4 rounded-2xl border-l-4 border-l-red-500 border border-emerald-100 shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition space-y-2"
                  >
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="font-mono font-semibold text-gray-700">{u.id}</span>
                      <span>{u.tanggal}</span>
                    </div>

                    {u.namaSupplier && (
                      <p className="text-xs font-semibold text-emerald-900">
                        Supplier: <span className="font-bold text-red-700">{u.namaSupplier}</span> {u.kontak ? `(${u.kontak})` : ''}
                      </p>
                    )}

                    <p className="text-xs text-emerald-800 font-medium line-clamp-2">{u.keterangan}</p>

                    <div className="flex justify-between items-end pt-2 border-t border-emerald-50">
                      <div>
                        <p className="text-[10px] text-gray-500">Total Utang</p>
                        <p className="text-sm font-bold text-emerald-950">{formatRupiah(u.nominal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">Sisa Utang</p>
                        <p className="text-sm font-bold text-red-600">{formatRupiah(u.sisa)}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: RESTOCK STOK */}
      {isRestockOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-emerald-200 space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-emerald-100">
              <h3 className="font-bold text-emerald-900 text-xs">Tambah / Beli Stok Masuk</h3>
              <button
                type="button"
                onClick={() => setIsRestockOpen(false)}
                className="text-emerald-400 hover:text-emerald-700 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Kategori</label>
                <select
                  value={sKat}
                  onChange={(e) => {
                    setSKat(e.target.value);
                    setSKode('');
                    setSNamaNew('');
                  }}
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option>Sepeda</option>
                  <option>Sparepart</option>
                  <option>Aksesoris</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Pilih Barang</label>
                <select
                  value={sKode}
                  onChange={(e) => handleSelectProdRestock(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="">-- Pilih Exisiting / Baru --</option>
                  {products
                    .filter((p) => p.kategori === sKat)
                    .map((p, idx) => (
                      <option key={p.id || `${p.kode}-${idx}`} value={p.kode}>
                        {p.nama}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-emerald-800 block mb-1">Nama Barang Baru</label>
              <input
                type="text"
                value={sNamaNew}
                onChange={(e) => setSNamaNew(e.target.value)}
                placeholder="Kosongkan jika memilih dari dropdown"
                className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Qty</label>
                <input
                  type="number"
                  min="1"
                  value={sQty}
                  onChange={(e) => setSQty(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Modal Beli (Rp)</label>
                <input
                  type="text"
                  value={sModal ? formatRupiah(parseInt(sModal.replace(/\D/g, '')) || 0) : ''}
                  onChange={(e) => setSModal(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Harga Jual (Rp)</label>
                <input
                  type="text"
                  value={sJual ? formatRupiah(parseInt(sJual.replace(/\D/g, '')) || 0) : ''}
                  onChange={(e) => setSJual(e.target.value)}
                  placeholder="0"
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Satuan</label>
                <select
                  value={sSatuan}
                  onChange={(e) => setSSatuan(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option>pcs</option>
                  <option>unit</option>
                  <option>set</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-bold text-emerald-800 block mb-1">Metode Bayar</label>
                <select
                  value={sMetode}
                  onChange={(e) => setSMetode(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                >
                  {paymentMethods
                    .filter((m) => m.val !== 'Utang')
                    .map((m) => (
                      <option key={m.val} value={m.val}>
                        {m.label}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={addRestockItem}
              className="w-full py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold rounded-lg text-xs transition border border-emerald-300"
            >
              + Tambah ke Daftar Restock
            </button>

            {/* List */}
            {restockList.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {restockList.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-emerald-50 p-2 rounded text-xs border border-emerald-100">
                    <div>
                      <p className="font-semibold text-emerald-950">{item.nama}</p>
                      <p className="text-[10px] text-emerald-600">
                        x{item.qty} &bull; Modal: {formatRupiah(item.modal)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRestockList(restockList.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 p-1"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-emerald-100">
              <button
                type="button"
                onClick={submitRestock}
                disabled={isSubmitting || restockList.length === 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : 'Simpan Pembelian Stok'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: STOCK OPNAME */}
      {isOpnameOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-emerald-200 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-emerald-100">
              <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-clipboard-check text-emerald-500"></i>
                Stock Opname / Koreksi Stok Fisik
              </h3>
              <button
                type="button"
                onClick={() => setIsOpnameOpen(false)}
                className="text-emerald-400 hover:text-emerald-700 p-1"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 leading-relaxed">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
              Inputkan <b>Stok Fisik</b> aktual. Sistem akan otomatis menghitung selisih dan mencatat jurnal akuntansi (Opname Surplus/Shortage).
            </div>

            <div className="flex gap-2">
              <input
                type="date"
                value={opTgl}
                onChange={(e) => setOpTgl(e.target.value)}
                className="px-3 py-1.5 border border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={opQuery}
                onChange={(e) => setOpQuery(e.target.value)}
                placeholder="Cari kode/nama barang..."
                className="px-3 py-1.5 border border-emerald-200 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500 flex-1"
              />
            </div>

            <div className="border border-emerald-200 rounded-xl overflow-hidden max-h-[50vh] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-emerald-50 sticky top-0 font-bold text-[10px] text-emerald-800 uppercase border-b border-emerald-200">
                  <tr>
                    <th className="p-2.5">Kode</th>
                    <th className="p-2.5">Nama Barang</th>
                    <th className="p-2.5 text-center">Stok Sistem</th>
                    <th className="p-2.5 text-center">Stok Fisik</th>
                    <th className="p-2.5 text-center">Selisih</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-emerald-50">
                  {products
                    .filter(
                      (p) =>
                        !opQuery ||
                        p.nama.toLowerCase().includes(opQuery.toLowerCase()) ||
                        p.kode.toLowerCase().includes(opQuery.toLowerCase())
                    )
                    .map((p, idx) => {
                      const fisik = opFisikMap[p.kode] !== undefined ? opFisikMap[p.kode] : p.stok;
                      const selisih = fisik - p.stok;

                      return (
                        <tr key={p.id || `${p.kode}-${idx}`} className="hover:bg-emerald-50/50">
                          <td className="p-2.5 font-mono text-[10px] text-emerald-700">{p.kode}</td>
                          <td className="p-2.5 font-semibold text-emerald-950">{p.nama}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-800">{p.stok}</td>
                          <td className="p-2.5 text-center">
                            <input
                              type="number"
                              min="0"
                              value={fisik}
                              onChange={(e) => handleOpFisikChange(p.kode, e.target.value)}
                              className="w-16 px-1.5 py-1 border border-emerald-200 rounded text-center font-bold focus:outline-none focus:border-emerald-500"
                            />
                          </td>
                          <td className={`p-2.5 text-center font-bold ${selisih > 0 ? 'text-emerald-600' : selisih < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                            {selisih > 0 ? `+${selisih}` : selisih}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
              <button
                type="button"
                onClick={() => setIsOpnameOpen(false)}
                className="px-4 py-2 border border-emerald-200 rounded-xl text-emerald-800 font-semibold text-xs hover:border-emerald-400"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submitOpname}
                disabled={isSubmitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : 'Simpan Koreksi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelImportOpen}
        onClose={() => setIsExcelImportOpen(false)}
        paymentMethods={paymentMethods}
        onSuccess={onSuccess}
        onError={onError}
        moduleContext="stok"
        defaultMode="StockOnly"
      />
    </div>
  );
};

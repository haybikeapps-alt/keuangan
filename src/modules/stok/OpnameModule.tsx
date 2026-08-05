import React, { useState, useEffect, useMemo } from 'react';
import {
  formatISO,
  subscribeProducts,
  saveStockOpname,
  updateProductDirect,
  deleteProductDirect,
  getKartuStokAll
} from '../../services/firebaseService';
import { Product } from '../../types';

interface OpnameModuleProps {
  onNavigate?: (page: string) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const OpnameModule: React.FC<OpnameModuleProps> = ({ onNavigate, onSuccess, onError }) => {
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedKat, setSelectedKat] = useState('Semua');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local state for physical stock inputs mapped by product kode
  const [fisikMap, setFisikMap] = useState<Record<string, number>>({});

  // History tab toggle
  const [activeTab, setActiveTab] = useState<'opname' | 'history'>('opname');
  const [kartuStok, setKartuStok] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editNama, setEditNama] = useState('');
  const [editKategori, setEditKategori] = useState('');
  const [editSatuan, setEditSatuan] = useState('');
  const [editModal, setEditModal] = useState(0);
  const [editJual, setEditJual] = useState(0);
  const [editStok, setEditStok] = useState(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Delete Confirmation State
  const [deletingKode, setDeletingKode] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const unsub = subscribeProducts((prods) => {
      setProducts(prods);
      // Initialize or synchronize physical stock map with current system stock
      setFisikMap((prev) => {
        const nextMap: Record<string, number> = { ...prev };
        prods.forEach((p) => {
          if (nextMap[p.kode] === undefined) {
            nextMap[p.kode] = p.stok || 0;
          }
        });
        return nextMap;
      });
    });
    fetchHistory();
    return () => unsub();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const startD = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const ks = await getKartuStokAll(startD, today);
      const opnameMovements: any[] = [];
      ks.forEach((item) => {
        if (item.movements && Array.isArray(item.movements)) {
          item.movements.forEach((m) => {
            if ((m.ket || '').toLowerCase().includes('opname')) {
              opnameMovements.push({
                namaBarang: item.nama,
                kode: item.kode,
                tanggal: m.tgl,
                ket: m.ket,
                masuk: m.masuk || 0,
                keluar: m.keluar || 0,
                sisa: item.stokAkhir
              });
            }
          });
        }
      });
      setKartuStok(opnameMovements);
    } catch (e) {
      console.error('Error fetching opname history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedKat === 'Semua' || p.kategori === selectedKat;
      const sLower = search.toLowerCase().trim();
      const matchSearch =
        !sLower ||
        p.nama.toLowerCase().includes(sLower) ||
        p.kode.toLowerCase().includes(sLower) ||
        (p.kategori && p.kategori.toLowerCase().includes(sLower));
      return matchCat && matchSearch;
    });
  }, [products, selectedKat, search]);

  // Stats calculation
  const totalJenisBarang = products.length;
  const totalStokSistem = products.reduce((acc, p) => acc + (p.stok || 0), 0);
  const itemsWithSelisih = useMemo(() => {
    return products.filter((p) => {
      const f = fisikMap[p.kode] !== undefined ? fisikMap[p.kode] : p.stok;
      return f !== p.stok;
    });
  }, [products, fisikMap]);

  // Change Physical Stock handler
  const handleFisikChange = (kode: string, val: number) => {
    setFisikMap((prev) => ({
      ...prev,
      [kode]: Math.max(0, isNaN(val) ? 0 : val)
    }));
  };

  // Reset physical stock input for single product to system stock
  const handleResetFisik = (kode: string) => {
    const p = products.find((item) => item.kode === kode);
    if (p) {
      setFisikMap((prev) => ({
        ...prev,
        [kode]: p.stok || 0
      }));
    }
  };

  // Reset all physical inputs to system stock
  const handleResetAllToSystem = () => {
    const newMap: Record<string, number> = {};
    products.forEach((p) => {
      newMap[p.kode] = p.stok || 0;
    });
    setFisikMap(newMap);
    onSuccess('Semua stok fisik dikembalikan sesuai stok sistem.');
  };

  // Save Stock Opname for Single Product
  const handleSaveSingleOpname = async (product: Product) => {
    const qtyFisik = fisikMap[product.kode] !== undefined ? fisikMap[product.kode] : product.stok;
    const selisih = qtyFisik - product.stok;

    if (selisih === 0) {
      onError(`Stok fisik ${product.nama} sudah sama dengan stok sistem (${product.stok} ${product.satuan || 'Pcs'}). Tidak ada perubahan.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveStockOpname(
        JSON.stringify({
          tanggal: tgl,
          items: [{ kode: product.kode, qtyFisik }]
        })
      );

      if (res && res.ok) {
        onSuccess(
          `Stock Opname ${product.nama} Berhasil! Stok diperbarui dari ${product.stok} menjadi ${qtyFisik} ${product.satuan || 'Pcs'} (${selisih > 0 ? '+' : ''}${selisih}).`
        );
        fetchHistory();
      } else {
        onError(res?.msg || 'Gagal menyimpan penyesuaian opname.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat menyimpan opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Batch Opname for All Products with differences
  const handleSaveBatchOpname = async () => {
    if (itemsWithSelisih.length === 0) {
      onError('Tidak ada perbedaan stok fisik dan sistem untuk disimpan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const itemsPayload = itemsWithSelisih.map((p) => ({
        kode: p.kode,
        qtyFisik: fisikMap[p.kode] !== undefined ? fisikMap[p.kode] : p.stok
      }));

      const res = await saveStockOpname(
        JSON.stringify({
          tanggal: tgl,
          items: itemsPayload
        })
      );

      if (res && res.ok) {
        onSuccess(`Berhasil memproses Stock Opname untuk ${itemsWithSelisih.length} barang! Stok fisik telah diperbarui.`);
        fetchHistory();
        if (onNavigate) {
          onNavigate('stok');
        }
      } else {
        onError(res?.msg || 'Gagal menyimpan penyesuaian opname massal.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat menyimpan opname massal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setEditNama(p.nama);
    setEditKategori(p.kategori || 'Sparepart');
    setEditSatuan(p.satuan || 'Pcs');
    setEditModal(p.modal || 0);
    setEditJual(p.jual || 0);
    setEditStok(p.stok || 0);
  };

  // Save Edit Product Details
  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    if (!editNama.trim()) {
      onError('Nama barang tidak boleh kosong!');
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await updateProductDirect(editingProduct.kode, {
        nama: editNama.trim(),
        kategori: editKategori.trim(),
        satuan: editSatuan.trim() || 'Pcs',
        modal: Number(editModal) || 0,
        jual: Number(editJual) || 0,
        stok: Number(editStok) || 0
      });

      if (res.ok) {
        onSuccess(`Data barang [${editingProduct.kode}] ${editNama} berhasil diperbarui!`);
        setEditingProduct(null);
      } else {
        onError(res.msg || 'Gagal merubah data barang.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat menyimpan perubahan barang.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Confirm Delete Product
  const handleDeleteProduct = async () => {
    if (!deletingKode) return;
    setIsDeleting(true);
    try {
      const p = products.find((x) => x.kode === deletingKode);
      const res = await deleteProductDirect(deletingKode);
      if (res.ok) {
        onSuccess(`Barang ${p ? p.nama : deletingKode} berhasil dihapus dari master stok!`);
        setDeletingKode(null);
      } else {
        onError(res.msg || 'Gagal menghapus barang.');
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan saat menghapus barang.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* TOP HEADER */}
      <div className="bg-gradient-to-r from-teal-900 via-cyan-900 to-slate-900 p-5 rounded-2xl text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-cyan-300 text-2xl shrink-0">
            <i className="fa-solid fa-boxes-packing"></i>
          </div>
          <div>
            <h2 className="text-lg font-bold">Stock Opname & Penyesuaian Stok</h2>
            <p className="text-xs text-cyan-200">
              Audit jumlah fisik barang, edit stok langsung, dan simpan koreksi selisih stok dengan mudah.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('stok')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-white/20 cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i> Kembali ke Stok
            </button>
          )}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur px-3 py-2 rounded-xl border border-white/15 text-xs">
            <span className="font-semibold text-cyan-100">📅 Tanggal Opname:</span>
            <input
              type="date"
              value={tgl}
              onChange={(e) => setTgl(e.target.value)}
              className="bg-cyan-950/80 text-white font-bold px-2 py-1 rounded border border-cyan-400/40 focus:outline-none focus:border-cyan-300"
            />
          </div>
        </div>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Jenis Barang</p>
            <p className="text-2xl font-black text-slate-800">{totalJenisBarang} <span className="text-xs font-normal text-gray-500">Item</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-cubes"></i>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Stok Sistem</p>
            <p className="text-2xl font-black text-cyan-900">{totalStokSistem} <span className="text-xs font-normal text-gray-500">Pcs</span></p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center text-lg font-bold">
            <i className="fa-solid fa-layer-group"></i>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-cyan-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Perlu Penyesuaian</p>
            <p className={`text-2xl font-black ${itemsWithSelisih.length > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {itemsWithSelisih.length} <span className="text-xs font-normal text-gray-500">Item Selisih</span>
            </p>
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
            itemsWithSelisih.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS & BATCH ACTION */}
      <div className="bg-white rounded-2xl border border-cyan-100 shadow-sm p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('opname')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'opname'
                  ? 'bg-cyan-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className="fa-solid fa-list-check"></i>
              Daftar & Penyesuaian Stok
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                activeTab === 'history'
                  ? 'bg-cyan-800 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
              Riwayat Opname
            </button>
          </div>

          {activeTab === 'opname' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetAllToSystem}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5"
                title="Selesaikan perubahan tak tersimpan dan samakan dengan stok sistem"
              >
                <i className="fa-solid fa-arrow-rotate-left"></i>
                Reset Input Fisik
              </button>

              <button
                type="button"
                onClick={handleSaveBatchOpname}
                disabled={isSubmitting || itemsWithSelisih.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <i className="fa-solid fa-floppy-disk"></i>
                {isSubmitting ? 'Memproses...' : `Simpan Semua Selisih (${itemsWithSelisih.length})`}
              </button>
            </div>
          )}
        </div>

        {activeTab === 'opname' ? (
          <>
            {/* SEARCH & CATEGORY FILTERS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8 relative">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-cyan-600 text-xs"></i>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari kode barang, nama sparepart, atau kategori..."
                  className="w-full pl-9 pr-8 py-2.5 bg-cyan-50/40 border border-cyan-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-cyan-500 focus:bg-white"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>

              <div className="md:col-span-4">
                <select
                  value={selectedKat}
                  onChange={(e) => setSelectedKat(e.target.value)}
                  className="w-full px-3 py-2.5 bg-cyan-50/40 border border-cyan-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-cyan-500"
                >
                  {categories.map((kat) => (
                    <option key={kat} value={kat}>
                      Kategori: {kat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* TABLE PRODUCT STOCK LIST */}
            <div className="overflow-x-auto border border-cyan-100 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-cyan-900 text-white font-semibold uppercase text-[11px] tracking-wider">
                  <tr>
                    <th className="p-3">Kode / Kategori</th>
                    <th className="p-3">Nama Barang</th>
                    <th className="p-3 text-center">Stok Sistem</th>
                    <th className="p-3 text-center w-40">Jumlah Stok Fisik</th>
                    <th className="p-3 text-center">Selisih</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-50 font-medium text-slate-800">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-400">
                        <i className="fa-solid fa-box-open text-3xl mb-2 text-cyan-200 block"></i>
                        Barang tidak ditemukan.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p, idx) => {
                      const f = fisikMap[p.kode] !== undefined ? fisikMap[p.kode] : p.stok;
                      const selisih = f - p.stok;
                      const isEdited = f !== p.stok;

                      return (
                        <tr
                          key={p.id || `${p.kode}-${idx}`}
                          className={`hover:bg-cyan-50/50 transition ${
                            isEdited ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="p-3">
                            <span className="font-mono font-bold text-cyan-900 block">{p.kode}</span>
                            <span className="inline-block text-[10px] font-semibold text-cyan-700 bg-cyan-100/60 px-1.5 py-0.5 rounded border border-cyan-200">
                              {p.kategori || 'General'}
                            </span>
                          </td>

                          <td className="p-3">
                            <p className="font-bold text-slate-900">{p.nama}</p>
                            <p className="text-[10px] text-gray-500">
                              Modal: Rp {(p.modal || 0).toLocaleString('id-ID')} | Jual: Rp {(p.jual || 0).toLocaleString('id-ID')}
                            </p>
                          </td>

                          <td className="p-3 text-center font-extrabold text-slate-700 text-sm">
                            {p.stok || 0} <span className="text-[10px] font-normal text-gray-500">{p.satuan || 'Pcs'}</span>
                          </td>

                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleFisikChange(p.kode, f - 1)}
                                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-cyan-100 text-gray-700 font-bold text-xs flex items-center justify-center transition border border-gray-200"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={f}
                                onChange={(e) => handleFisikChange(p.kode, parseInt(e.target.value) || 0)}
                                className={`w-16 px-2 py-1 text-center font-black rounded-lg border text-sm focus:outline-none ${
                                  isEdited
                                    ? 'border-amber-400 bg-amber-100/80 text-amber-900'
                                    : 'border-cyan-200 bg-white text-slate-900'
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => handleFisikChange(p.kode, f + 1)}
                                className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-cyan-100 text-gray-700 font-bold text-xs flex items-center justify-center transition border border-gray-200"
                              >
                                +
                              </button>
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            {selisih === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <i className="fa-solid fa-check text-[9px]"></i> Pas
                              </span>
                            ) : selisih > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                <i className="fa-solid fa-plus text-[9px]"></i> +{selisih} {p.satuan || 'Pcs'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <i className="fa-solid fa-minus text-[9px]"></i> {selisih} {p.satuan || 'Pcs'}
                              </span>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isEdited ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveSingleOpname(p)}
                                    disabled={isSubmitting}
                                    className="px-2.5 py-1 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-bold text-[11px] shadow-sm flex items-center gap-1 transition"
                                    title="Simpan opname item ini"
                                  >
                                    <i className="fa-solid fa-check"></i> Simpan
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleResetFisik(p.kode)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                    title="Batal edit stok fisik"
                                  >
                                    <i className="fa-solid fa-rotate-left"></i>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEdit(p)}
                                    className="p-1.5 text-cyan-700 hover:bg-cyan-50 rounded-lg transition"
                                    title="Edit Detail Barang"
                                  >
                                    <i className="fa-solid fa-pen-to-square"></i>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setDeletingKode(p.kode)}
                                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                    title="Hapus Barang"
                                  >
                                    <i className="fa-solid fa-trash-can"></i>
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* TAB RIWAYAT OPNAME */
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="font-bold text-cyan-900 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-clock-rotate-left text-cyan-600"></i>
                Catatan Histori Audit Stock Opname (30 Hari Terakhir)
              </h3>
              <button
                type="button"
                onClick={fetchHistory}
                className="text-[11px] text-cyan-700 hover:text-cyan-900 font-bold flex items-center gap-1"
              >
                <i className="fa-solid fa-rotate"></i> Refresh
              </button>
            </div>

            {loadingHistory ? (
              <div className="text-center py-8 text-cyan-600 text-xs">
                <i className="fa-solid fa-spinner fa-spin text-lg mb-1 block"></i>
                Memuat riwayat opname...
              </div>
            ) : kartuStok.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs bg-cyan-50/20 rounded-xl border border-dashed border-cyan-200">
                <i className="fa-solid fa-clipboard-list text-2xl mb-1 text-cyan-300 block"></i>
                Belum ada catatan opname dalam 30 hari terakhir.
              </div>
            ) : (
              <div className="overflow-x-auto border border-cyan-100 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold text-[11px] uppercase">
                    <tr>
                      <th className="p-3">Tanggal</th>
                      <th className="p-3">Kode / Nama Barang</th>
                      <th className="p-3">Keterangan Adjust</th>
                      <th className="p-3 text-center">Masuk (+)</th>
                      <th className="p-3 text-center">Keluar (-)</th>
                      <th className="p-3 text-right">Saldo Akhir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kartuStok.map((item, idx) => (
                      <tr key={idx} className="hover:bg-cyan-50/30">
                        <td className="p-3 font-mono text-gray-500">{item.tanggal}</td>
                        <td className="p-3 font-bold text-cyan-950">
                          {item.namaBarang} <span className="font-mono text-[10px] text-gray-400">[{item.kode}]</span>
                        </td>
                        <td className="p-3 text-gray-600 font-medium">{item.ket}</td>
                        <td className="p-3 text-center font-bold text-blue-600">
                          {item.masuk ? `+${item.masuk}` : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600">
                          {item.keluar ? `-${item.keluar}` : '-'}
                        </td>
                        <td className="p-3 text-right font-black text-cyan-900">{item.sisa} Pcs</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT PRODUCT MODAL */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-cyan-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-cyan-900 p-4 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <i className="fa-solid fa-pen-to-square text-cyan-300"></i>
                Edit Detail Barang [{editingProduct.kode}]
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-white/70 hover:text-white text-base"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleSaveProductEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Nama Barang / Sparepart</label>
                <input
                  type="text"
                  value={editNama}
                  onChange={(e) => setEditNama(e.target.value)}
                  className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Kategori</label>
                  <input
                    type="text"
                    value={editKategori}
                    onChange={(e) => setEditKategori(e.target.value)}
                    placeholder="Contoh: Sparepart"
                    className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Satuan</label>
                  <input
                    type="text"
                    value={editSatuan}
                    onChange={(e) => setEditSatuan(e.target.value)}
                    placeholder="Pcs, Unit, Set"
                    className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-semibold focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Harga Modal (Beli)</label>
                  <input
                    type="number"
                    min="0"
                    value={editModal}
                    onChange={(e) => setEditModal(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Harga Jual</label>
                  <input
                    type="number"
                    min="0"
                    value={editJual}
                    onChange={(e) => setEditJual(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Stok Saat Ini (Sistem)</label>
                <input
                  type="number"
                  min="0"
                  value={editStok}
                  onChange={(e) => setEditStok(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-cyan-200 rounded-lg font-extrabold text-cyan-900 bg-cyan-50/50 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-cyan-800 hover:bg-cyan-900 text-white font-bold rounded-xl text-xs shadow-md"
                >
                  {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingKode && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-rose-100 w-full max-w-sm p-5 space-y-4 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl">
              <i className="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm mb-1">Konfirmasi Hapus Barang</h3>
              <p className="text-xs text-gray-500">
                Apakah Anda yakin ingin menghapus barang dengan kode <span className="font-bold text-slate-800">[{deletingKode}]</span> dari master stok? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingKode(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Barang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

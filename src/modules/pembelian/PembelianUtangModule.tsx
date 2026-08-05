import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { formatISO, formatRupiah, subscribeProducts, saveStockPurchaseUtang } from '../../services/firebaseService';
import { Product } from '../../types';
import { ExcelImportModal } from '../../components/ExcelImportModal';

interface PembelianUtangModuleProps {
  onNavigate?: (page: string) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

interface PuItem {
  kode: string;
  nama: string;
  kategori: string;
  qty: number;
  harga: number;
  subtotal: number;
}

export const PembelianUtangModule: React.FC<PembelianUtangModuleProps> = ({ onNavigate, onSuccess, onError }) => {
  const [tgl, setTgl] = useState(() => formatISO(new Date()));
  const [supplier, setSupplier] = useState('');
  const [kontak, setKontak] = useState('');
  const [inv, setInv] = useState('');

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedKat, setSelectedKat] = useState('Sepeda');
  const [selectedKode, setSelectedKode] = useState('');
  const [qty, setQty] = useState(1);
  const [hargaBeli, setHargaBeli] = useState('');

  const [puList, setPuList] = useState<PuItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const unsub = subscribeProducts((prods) => {
      setProducts(prods);
    });
    return () => unsub();
  }, []);

  const handleSelectBarang = (code: string) => {
    setSelectedKode(code);
    if (!code) {
      setHargaBeli('');
      return;
    }
    const found = products.find((p) => p.kode === code);
    if (found) {
      setHargaBeli(String(found.modal || 0));
    }
  };

  const handleAddItem = () => {
    if (!selectedKode) {
      onError('Pilih barang terlebih dahulu!');
      return;
    }
    const numHarga = parseInt(hargaBeli.replace(/\D/g, '')) || 0;
    if (qty <= 0) {
      onError('Qty harus lebih dari 0!');
      return;
    }
    if (numHarga <= 0) {
      onError('Harga beli modal harus lebih dari 0!');
      return;
    }

    const found = products.find((p) => p.kode === selectedKode);
    const nama = found ? found.nama : 'Barang ' + selectedKode;

    const existIdx = puList.findIndex((x) => x.kode === selectedKode);
    if (existIdx >= 0) {
      const updated = [...puList];
      const newQty = updated[existIdx].qty + qty;
      updated[existIdx].qty = newQty;
      updated[existIdx].harga = numHarga;
      updated[existIdx].subtotal = newQty * numHarga;
      setPuList(updated);
    } else {
      setPuList([
        ...puList,
        {
          kode: selectedKode,
          nama,
          kategori: selectedKat,
          qty,
          harga: numHarga,
          subtotal: qty * numHarga
        }
      ]);
    }

    setSelectedKode('');
    setQty(1);
    setHargaBeli('');
    onSuccess('Barang ditambahkan ke daftar!');
  };

  const handleRemoveItem = (idx: number) => {
    setPuList(puList.filter((_, i) => i !== idx));
  };

  // Handle Excel / CSV File Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      onError('Ukuran file maksimal 2MB!');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          onError('File kosong atau format tidak dikenali!');
          return;
        }

        processImportData(jsonData);
      } catch (err: any) {
        onError(`Gagal membaca file: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const processImportData = (jsonData: any[]) => {
    let successCount = 0;
    let failCount = 0;
    const newList = [...puList];

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      const kode = String(row['Kode'] || row['kode'] || row['KODE'] || '').trim();
      const nama = String(row['Nama'] || row['nama'] || row['NAMA'] || row['Barang'] || row['barang'] || '').trim();
      const rawQty = parseInt(String(row['Qty'] || row['qty'] || row['QTY'] || row['Jumlah'] || '').replace(/\D/g, '')) || 0;
      const rawHarga = parseInt(String(row['Harga Modal'] || row['harga modal'] || row['Harga'] || row['modal'] || '').replace(/\D/g, '')) || 0;

      if (!kode && !nama) continue;
      if (rawQty <= 0 || rawHarga <= 0) {
        failCount++;
        continue;
      }

      let masterItem: Product | undefined;
      if (kode) {
        masterItem = products.find((p) => p.kode === kode);
      }
      if (!masterItem && nama) {
        masterItem = products.find((p) => p.nama.toLowerCase() === nama.toLowerCase());
      }

      const finalKode = masterItem ? masterItem.kode : kode || `IMP-${Date.now()}-${i}`;
      const finalNama = masterItem ? masterItem.nama : nama;
      const finalKat = masterItem ? masterItem.kategori : selectedKat;

      const existIdx = newList.findIndex((x) => x.kode === finalKode);
      if (existIdx >= 0) {
        newList[existIdx].qty += rawQty;
        newList[existIdx].harga = rawHarga;
        newList[existIdx].subtotal = newList[existIdx].qty * rawHarga;
      } else {
        newList.push({
          kode: finalKode,
          nama: finalNama,
          kategori: finalKat,
          qty: rawQty,
          harga: rawHarga,
          subtotal: rawQty * rawHarga
        });
      }
      successCount++;
    }

    setPuList(newList);
    if (successCount > 0) {
      onSuccess(`Berhasil mengimpor ${successCount} barang!`);
    } else {
      onError('Tidak ada barang yang berhasil diimpor. Pastikan kolom: Kode, Nama, Qty, Harga Modal');
    }
  };

  const handleSavePurchase = async () => {
    if (!tgl) {
      onError('Isi tanggal pembelian!');
      return;
    }
    if (!supplier.trim()) {
      onError('Isi nama supplier!');
      return;
    }
    if (puList.length === 0) {
      onError('Tambahkan minimal 1 barang!');
      return;
    }

    const totalRp = puList.reduce((sum, item) => sum + item.subtotal, 0);
    if (!window.confirm(`Simpan pembelian utang ke "${supplier}" sebesar ${formatRupiah(totalRp)}?`)) return;

    setIsSubmitting(true);
    try {
      const itemsPayload = puList.map((p) => ({
        kode: p.kode,
        nama: p.nama,
        kategori: p.kategori,
        satuan: 'unit',
        qty: p.qty,
        modal: p.harga,
        jual: 0
      }));

      const res = await saveStockPurchaseUtang(
        JSON.stringify({
          items: itemsPayload,
          metode: 'Utang',
          tanggal: tgl,
          namaSupplier: supplier,
          kontakSupplier: kontak
        })
      );

      if (res && res.ok) {
        onSuccess(`Pembelian utang berhasil disimpan! ID: ${res.id}`);
        setSupplier('');
        setKontak('');
        setInv('');
        setPuList([]);
        if (onNavigate) {
          onNavigate('stok');
        }
      } else {
        onError(res?.msg || 'Gagal menyimpan pembelian');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalQty = puList.reduce((sum, i) => sum + i.qty, 0);
  const totalRp = puList.reduce((sum, i) => sum + i.subtotal, 0);

  const selectedProdInfo = products.find((p) => p.kode === selectedKode);

  return (
    <div className="space-y-4">
      {/* Top Header Navigation Bar */}
      <div className="bg-white p-3 rounded-2xl border border-emerald-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onNavigate && (
            <button
              type="button"
              onClick={() => onNavigate('stok')}
              className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-emerald-300 shadow-sm cursor-pointer"
            >
              <i className="fa-solid fa-arrow-left"></i> Kembali ke Daftar Stok
            </button>
          )}
          <div>
            <h2 className="text-xs font-bold text-emerald-950">Form Pembelian & Restock Barang</h2>
            <p className="text-[11px] text-emerald-700">Setelah berhasil disimpan, sistem akan otomatis kembali ke Daftar Stok untuk mencegah double entry.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* COLUMN 1: Supplier & Info */}
      <div className="space-y-3">
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-truck-field text-emerald-500"></i>
            Info Supplier
          </h3>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Tanggal Pembelian</label>
            <input
              type="date"
              value={tgl}
              onChange={(e) => setTgl(e.target.value)}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Nama Supplier *</label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Contoh: PT Terlaksana / Distributor ABC"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Kontak Supplier</label>
            <input
              type="text"
              value={kontak}
              onChange={(e) => setKontak(e.target.value)}
              placeholder="08xxxxxxxxxx"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">No Invoice / Faktur</label>
            <input
              type="text"
              value={inv}
              onChange={(e) => setInv(e.target.value)}
              placeholder="Opsional (contoh: INV-001)"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-2">
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-receipt text-emerald-500"></i>
            Ringkasan Utang Belanja
          </h3>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-700">Jumlah Jenis Item</span>
            <span className="font-bold text-emerald-950">{puList.length}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-emerald-700">Total Qty</span>
            <span className="font-bold text-emerald-950">{totalQty}</span>
          </div>
          <div className="border-t-2 border-emerald-300 pt-2 flex justify-between items-center">
            <span className="text-xs font-bold text-emerald-900">Total Utang</span>
            <span className="text-xl font-black text-emerald-700">{formatRupiah(totalRp)}</span>
          </div>
        </div>
      </div>

      {/* COLUMN 2: Tambah Barang */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-3">
        <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
          <i className="fa-solid fa-box-open text-emerald-500"></i>
          Tambah Barang Beli
        </h3>

        <div>
          <label className="text-xs font-semibold text-emerald-800 block mb-1">Kategori</label>
          <select
            value={selectedKat}
            onChange={(e) => {
              setSelectedKat(e.target.value);
              setSelectedKode('');
            }}
            className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
          >
            <option>Sepeda</option>
            <option>Sparepart</option>
            <option>Aksesoris</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-emerald-800 block mb-1">Pilih Barang *</label>
          <select
            value={selectedKode}
            onChange={(e) => handleSelectBarang(e.target.value)}
            className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
          >
            <option value="">-- Pilih Barang --</option>
            {products
              .filter((p) => p.kategori === selectedKat)
              .map((p, idx) => (
                <option key={p.id || `${p.kode}-${idx}`} value={p.kode}>
                  {p.nama} (Stok: {p.stok})
                </option>
              ))}
          </select>
        </div>

        {selectedProdInfo && (
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-emerald-700">Stok Saat Ini:</span>
              <span className="font-bold text-emerald-900">{selectedProdInfo.stok} {selectedProdInfo.satuan}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-700">Modal Terakhir:</span>
              <span className="font-bold text-emerald-900">{formatRupiah(selectedProdInfo.modal)}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Qty Beli *</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={(e) => setQty(Number(e.target.value))}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Harga Beli / Unit *</label>
            <input
              type="text"
              value={hargaBeli ? formatRupiah(parseInt(hargaBeli.replace(/\D/g, '')) || 0) : ''}
              onChange={(e) => setHargaBeli(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddItem}
          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow"
        >
          <i className="fa-solid fa-plus"></i> Tambah ke Daftar Beli
        </button>

        <div className="border-t border-dashed border-emerald-200 pt-3">
          <button
            type="button"
            onClick={() => setIsExcelModalOpen(true)}
            className="w-full py-2.5 bg-emerald-900 hover:bg-emerald-950 text-white font-bold rounded-xl text-xs transition shadow flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-file-excel text-emerald-400"></i>
            Impor File Excel / CSV (+35% Laba Auto)
          </button>

          <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1 text-emerald-950">
              <i className="fa-solid fa-circle-info text-emerald-600"></i> Fitur Upload Sekali Jalan:
            </p>
            <p>1. Cukup patok <b>Harga Beli (Modal)</b> di Excel.</p>
            <p>2. <b>Harga Jual otomatis +35% Laba</b> jika tidak diisi.</p>
            <p>3. Stok & transaksi pembelian utang supplier langsung tersimpan.</p>
          </div>
        </div>
      </div>

      {/* COLUMN 3: Daftar Pembelian */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm flex flex-col justify-between space-y-3">
        <div>
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5 mb-2">
            <i className="fa-solid fa-list-check text-emerald-500"></i>
            Daftar Barang Dibeli
          </h3>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {puList.length === 0 ? (
              <div className="text-center py-12 text-emerald-400 text-xs">
                <i className="fa-solid fa-inbox text-2xl mb-1 block"></i>
                Belum ada barang ditambahkan
              </div>
            ) : (
              puList.map((item, idx) => (
                <div key={idx} className="bg-emerald-50/80 p-2.5 rounded-xl border border-emerald-100 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-1">
                      <p className="font-bold text-emerald-950 leading-tight">{item.nama}</p>
                      <p className="text-[10px] text-emerald-600 font-mono">{item.kode} &bull; {item.kategori}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="text-red-400 hover:text-red-600 p-0.5 text-xs"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>

                  <div className="flex justify-between items-center text-[11px] pt-1 border-t border-emerald-100">
                    <span className="text-emerald-700">{formatRupiah(item.harga)} x {item.qty}</span>
                    <span className="font-bold text-emerald-900">{formatRupiah(item.subtotal)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="pt-3 border-t-2 border-emerald-200 space-y-2">
          <button
            type="button"
            onClick={handleSavePurchase}
            disabled={isSubmitting || puList.length === 0}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {isSubmitting ? 'Memproses...' : 'Simpan Pembelian Utang'}
          </button>
          <button
            type="button"
            onClick={() => setPuList([])}
            disabled={puList.length === 0}
            className="w-full py-1.5 border border-emerald-200 text-emerald-800 font-semibold rounded-lg text-xs hover:border-emerald-400 disabled:opacity-50"
          >
            Kosongkan Daftar
          </button>
        </div>
      </div>

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={isExcelModalOpen}
        onClose={() => setIsExcelModalOpen(false)}
        paymentMethods={[]}
        onSuccess={(msg) => {
          onSuccess(msg);
          if (onNavigate) {
            onNavigate('stok');
          }
        }}
        onError={onError}
        moduleContext="pembelian"
        defaultMode="Utang"
      />
    </div>
  </div>
  );
};

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { formatRupiah, formatISO, batchImportStockAndPurchase } from '../services/firebaseService';
import { PaymentMethod } from '../types';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  paymentMethods?: PaymentMethod[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  onRefresh?: () => void;
  moduleContext?: 'stok' | 'pembelian';
  defaultMode?: 'StockOnly' | 'Utang' | 'Kas' | 'Bank';
}

export interface ImportedPreviewItem {
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  qty: number;
  modal: number;
  jual: number;
  isAutoJual: boolean;
  supplier?: string;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  paymentMethods = [],
  onSuccess,
  onError,
  onRefresh,
  moduleContext,
  defaultMode = 'StockOnly'
}) => {
  const effectiveContext = moduleContext || (defaultMode === 'StockOnly' ? 'stok' : 'pembelian');

  const [file, setFile] = useState<File | null>(null);
  const [previewList, setPreviewList] = useState<ImportedPreviewItem[]>([]);
  const [importMode, setImportMode] = useState<'Utang' | 'Kas' | 'Bank' | 'StockOnly'>(
    effectiveContext === 'stok' ? 'StockOnly' : defaultMode === 'StockOnly' ? 'Utang' : defaultMode
  );
  const [selectedBank, setSelectedBank] = useState<string>('Bank BRI');
  const [tanggal, setTanggal] = useState(() => formatISO(new Date()));
  const [namaSupplier, setNamaSupplier] = useState('');
  const [kontakSupplier, setKontakSupplier] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status notification state: 'idle' | 'pending' | 'success' | 'error' | 'read'
  // 'read' = file sudah diparse & tabel pratinjau siap, TAPI belum tersimpan
  // ke database. Dipisah dari 'success' (yang berarti sudah benar-benar
  // tersimpan) supaya tidak ada notifikasi yang menyesatkan.
  const [processStatus, setProcessStatus] = useState<'idle' | 'pending' | 'success' | 'error' | 'read'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize importMode when defaultMode prop, moduleContext or modal visibility changes
  useEffect(() => {
    if (isOpen) {
      if (effectiveContext === 'stok') {
        setImportMode('StockOnly');
      } else {
        setImportMode(defaultMode === 'StockOnly' ? 'Utang' : defaultMode);
      }
      setProcessStatus('idle');
      setStatusMessage('');
      setFile(null);
      setPreviewList([]);
    }
  }, [isOpen, defaultMode, effectiveContext]);

  if (!isOpen) return null;

  // Unduh Template Excel
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Kode': 'HB-SEP-001',
        'Nama Barang': 'Sepeda MTB Genio 27.5 Inch Alloy',
        'Kategori': 'Sepeda',
        'Satuan': 'unit',
        'Stok / Qty': 3,
        'Harga Beli': 1850000,
        'Harga Jual': '', // Kosongkan agar otomatis dihitung laba 35%
        'Supplier': 'PT Terlaksana Bintang'
      },
      {
        'Kode': 'HB-PRT-002',
        'Nama Barang': 'Rantai Sepeda Shimano 9 Speed Original',
        'Kategori': 'Sparepart',
        'Satuan': 'pcs',
        'Stok / Qty': 15,
        'Harga Beli': 120000,
        'Harga Jual': '', // Kosongkan -> Otomatis +35% = Rp 162.000
        'Supplier': 'PT Terlaksana Bintang'
      },
      {
        'Kode': 'HB-AKS-003',
        'Nama Barang': 'Helm Sepeda Velo Pro Airflow',
        'Kategori': 'Aksesoris',
        'Satuan': 'pcs',
        'Stok / Qty': 10,
        'Harga Beli': 85000,
        'Harga Jual': '', // Kosongkan -> Otomatis +35% = Rp 114.750
        'Supplier': 'CV Sepeda Jaya'
      },
      {
        'Kode': 'HB-PRT-004',
        'Nama Barang': 'Ban Luar Swallow 26 x 2.10 Trail',
        'Kategori': 'Sparepart',
        'Satuan': 'pcs',
        'Stok / Qty': 20,
        'Harga Beli': 55000,
        'Harga Jual': '', // Kosongkan -> Otomatis +35% = Rp 74.250
        'Supplier': 'CV Sepeda Jaya'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 24 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok_Pembelian');

    XLSX.writeFile(
      workbook,
      effectiveContext === 'stok'
        ? 'Template_Import_Master_Stok_35Persen.xlsx'
        : 'Template_Import_Pembelian_Stok_35Persen.xlsx'
    );
  };

  // Process uploaded file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          setProcessStatus('error');
          setStatusMessage('File kosong atau format tidak dikenali!');
          onError('File kosong atau format tidak dikenali!');
          setPreviewList([]);
          return;
        }

        const items: ImportedPreviewItem[] = [];
        let detectedSupplier = '';

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];

          const kode = String(
            row['Kode'] || row['kode'] || row['KODE'] || row['Kode Barang'] || row['SKU'] || row['sku'] || row['Barcode'] || row['ID'] || row['id'] || ''
          ).trim();

          const nama = String(
            row['Nama Barang'] || row['nama barang'] || row['Nama'] || row['nama'] || row['NAMA'] || row['Barang'] || row['barang'] || row['Deskripsi'] || row['Item'] || row['item'] || row['Product'] || ''
          ).trim();

          const kategori = String(
            row['Kategori'] || row['kategori'] || row['KATEGORI'] || row['Category'] || row['Kelompok'] || 'Sparepart'
          ).trim();

          const satuan = String(
            row['Satuan'] || row['satuan'] || row['SATUAN'] || row['Unit'] || row['unit'] || row['UOM'] || 'pcs'
          ).trim();

          const rawQty = parseInt(
            String(row['Stok / Qty'] || row['Stok'] || row['stok'] || row['Qty'] || row['qty'] || row['Jumlah'] || row['Kuantitas'] || row['QTY'] || 1).replace(/\D/g, '')
          ) || 1;

          const rawModal = parseInt(
            String(row['Harga Beli'] || row['Harga Beli (Modal)'] || row['Harga Modal'] || row['harga modal'] || row['harga beli'] || row['modal'] || row['Harga'] || row['HPP'] || row['Cost'] || 0).replace(/\D/g, '')
          ) || 0;

          const rawJualInput = parseInt(
            String(row['Harga Jual'] || row['Harga Jual (Taksiran)'] || row['harga jual'] || row['jual'] || row['Price'] || row['price'] || 0).replace(/\D/g, '')
          ) || 0;

          const supplierInRow = String(
            row['Supplier'] || row['supplier'] || row['Nama Supplier'] || row['Vendor'] || row['Distributor'] || ''
          ).trim();

          if (supplierInRow && !detectedSupplier) {
            detectedSupplier = supplierInRow;
          }

          if (!nama && !kode) continue;

          // Auto calculate +35% profit margin if Harga Jual is 0 / empty
          let computedJual = rawJualInput;
          let isAuto = false;

          if (rawJualInput <= 0 && rawModal > 0) {
            computedJual = Math.round(rawModal * 1.35);
            isAuto = true;
          }

          items.push({
            kode: kode || `HB-${Date.now().toString().slice(-5)}-${i + 1}`,
            nama: nama || `Barang Impor #${i + 1}`,
            kategori: kategori || 'Sparepart',
            satuan: satuan || 'pcs',
            qty: Math.max(1, rawQty),
            modal: Math.max(0, rawModal),
            jual: Math.max(0, computedJual),
            isAutoJual: isAuto,
            supplier: supplierInRow
          });
        }

        setPreviewList(items);

        if (detectedSupplier && !namaSupplier) {
          setNamaSupplier(detectedSupplier);
        }

        if (items.length > 0) {
          // PENTING: jangan panggil prop `onSuccess` di sini. Prop ini dipakai
          // pemanggil (mis. PembelianUtangModule) untuk mendeteksi "impor
          // benar-benar tersimpan" dan langsung pindah halaman (onNavigate).
          // Tahap ini baru MEMBACA file ke tabel pratinjau, belum menyimpan
          // apa pun ke Firestore. Kalau onSuccess dipanggil di sini, pemanggil
          // langsung pindah halaman sebelum pengguna sempat klik "Proses
          // Import & Simpan", sehingga data tidak pernah benar-benar tersimpan.
          setProcessStatus('read');
          setStatusMessage(`File berhasil dibaca! ${items.length} item siap diimpor. Cek tabel pratinjau, lalu klik "Proses Import & Simpan" di bawah untuk benar-benar menyimpannya.`);
        } else {
          setProcessStatus('error');
          setStatusMessage('Tidak ada item valid yang ditemukan dalam file. Periksa kolom Nama / Kode.');
          onError('Tidak ada item valid yang ditemukan dalam file.');
        }
      } catch (err: any) {
        setProcessStatus('error');
        setStatusMessage(`Gagal memproses file Excel: ${err.message}`);
        onError(`Gagal memproses file Excel: ${err.message}`);
      }
    };

    reader.readAsArrayBuffer(uploadedFile);
    e.target.value = '';
  };

  const handleRemovePreviewItem = (index: number) => {
    setPreviewList(previewList.filter((_, idx) => idx !== index));
  };

  const handleUpdatePreviewPrice = (index: number, field: 'modal' | 'jual' | 'qty', val: number) => {
    const updated = [...previewList];
    const item = { ...updated[index] };

    if (field === 'qty') {
      item.qty = Math.max(1, val);
    } else if (field === 'modal') {
      item.modal = Math.max(0, val);
      if (item.isAutoJual) {
        item.jual = Math.round(item.modal * 1.35);
      }
    } else if (field === 'jual') {
      item.jual = Math.max(0, val);
      item.isAutoJual = false;
    }

    updated[index] = item;
    setPreviewList(updated);
  };

  const handleProcessImport = async () => {
    if (previewList.length === 0) {
      setProcessStatus('error');
      setStatusMessage('Belum ada data barang untuk diimpor! Silakan upload file Excel.');
      onError('Belum ada data barang untuk diimpor!');
      return;
    }

    const actualMode = effectiveContext === 'stok' ? 'StockOnly' : importMode;

    if (actualMode === 'Utang' && !namaSupplier.trim()) {
      setProcessStatus('error');
      setStatusMessage('Nama Supplier wajib diisi untuk Pembelian Utang!');
      onError('Nama Supplier wajib diisi untuk Pembelian Utang!');
      return;
    }

    setIsSubmitting(true);
    setProcessStatus('pending');
    setStatusMessage(`Sedang memproses & menyimpan ${previewList.length} barang ke database master stok... Mohon tunggu.`);

    try {
      const actualMetode = actualMode === 'Bank' ? selectedBank : actualMode;

      const res = await batchImportStockAndPurchase(
        JSON.stringify({
          items: previewList,
          metode: actualMetode,
          tanggal,
          namaSupplier,
          kontakSupplier
        })
      );

      if (res && res.ok) {
        const targetLabel =
          actualMode === 'StockOnly'
            ? 'Database Master Stok (Saldo Awal)'
            : actualMode === 'Utang'
            ? `Pembelian Utang Supplier (${namaSupplier})`
            : 'Pembelian Stok';

        const succMsg = `Berhasil! ${res.count} barang telah tersimpan ke ${targetLabel}. Harga jual dihitung dengan estimasi laba +35%.`;
        setProcessStatus('success');
        setStatusMessage(succMsg);
        onSuccess(succMsg);
        if (onRefresh) onRefresh();
        onClose();
      } else {
        const errMsg = res?.msg || 'Gagal memproses import data Excel';
        setProcessStatus('error');
        setStatusMessage(errMsg);
        onError(errMsg);
      }
    } catch (e: any) {
      const errMsg = e.message || 'Terjadi kesalahan saat memproses impor data.';
      setProcessStatus('error');
      setStatusMessage(errMsg);
      onError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalItemCount = previewList.length;
  const totalQtyCount = previewList.reduce((sum, i) => sum + i.qty, 0);
  const totalModalValue = previewList.reduce((sum, i) => sum + i.qty * i.modal, 0);
  const totalJualValue = previewList.reduce((sum, i) => sum + i.qty * i.jual, 0);
  const projectedProfit = totalJualValue - totalModalValue;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-5 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-emerald-100 overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 bg-gradient-to-r from-emerald-900 to-emerald-800 text-white flex justify-between items-center shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-700/80 flex items-center justify-center text-white text-lg">
              <i className="fa-solid fa-file-excel"></i>
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {effectiveContext === 'stok'
                  ? 'Import Master Stok Barang (Saldo Awal)'
                  : 'Import Pembelian Stok Barang (Supplier)'}
              </h3>
              <p className="text-[11px] text-emerald-200">
                {effectiveContext === 'stok'
                  ? 'Upload Excel untuk memperbarui / menambah Master Stok (Modal & Laba Auto +35%)'
                  : 'Upload Excel untuk mencatat Pembelian Stok dari Supplier (Utang / Tunai / Bank)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Process Status Notification Banner */}
          {processStatus !== 'idle' && (
            <div
              className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 shadow-sm text-xs font-bold transition-all ${
                processStatus === 'pending'
                  ? 'bg-amber-50 border-amber-300 text-amber-950 animate-pulse'
                  : processStatus === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : processStatus === 'read'
                  ? 'bg-sky-50 border-sky-300 text-sky-950'
                  : 'bg-red-50 border-red-300 text-red-950'
              }`}
            >
              <div className="flex items-center gap-3">
                {processStatus === 'pending' && (
                  <div className="w-8 h-8 rounded-full bg-amber-200/80 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-circle-notch fa-spin text-amber-700 text-base"></i>
                  </div>
                )}
                {processStatus === 'success' && (
                  <div className="w-8 h-8 rounded-full bg-emerald-200/80 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-circle-check text-emerald-700 text-base"></i>
                  </div>
                )}
                {processStatus === 'read' && (
                  <div className="w-8 h-8 rounded-full bg-sky-200/80 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-file-circle-check text-sky-700 text-base"></i>
                  </div>
                )}
                {processStatus === 'error' && (
                  <div className="w-8 h-8 rounded-full bg-red-200/80 flex items-center justify-center shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-red-700 text-base"></i>
                  </div>
                )}
                <div>
                  <p className="font-extrabold text-xs tracking-wide uppercase">
                    {processStatus === 'pending' && '⏳ SEDANG MEMPROSES & MENYIMPAN DATA...'}
                    {processStatus === 'success' && '✅ IMPORT BERHASIL TERSIMPAN!'}
                    {processStatus === 'read' && '📄 FILE TERBACA — BELUM DISIMPAN'}
                    {processStatus === 'error' && '❌ IMPORT GAGAL!'}
                  </p>
                  <p className="text-[11px] font-medium mt-0.5 leading-snug">{statusMessage}</p>
                </div>
              </div>

              {processStatus === 'success' && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-lg text-xs font-bold shadow transition cursor-pointer"
                >
                  Selesai & Tutup
                </button>
              )}
            </div>
          )}

          {/* Top Instruction & Download Template Card */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2 bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-black text-emerald-950 flex items-center gap-1.5">
                <i className="fa-solid fa-wand-magic-sparkles text-emerald-600"></i>
                Modul Disesuaikan: {effectiveContext === 'stok' ? 'Stok Master (Saldo Awal)' : 'Pembelian Stok Supplier'}
              </h4>
              <ul className="text-[11px] text-emerald-900 space-y-1 list-disc list-inside font-medium">
                {effectiveContext === 'stok' ? (
                  <>
                    <li>Format khusus untuk <b>Modul Stok Master</b>: mendaftarkan / memperbarui stok awal.</li>
                    <li>
                      Cukup isi <b>Harga Beli (Modal)</b>. Jika Harga Jual dikosongkan, otomatis dihitung <b>Laba +35%</b>.
                    </li>
                    <li>Modul ini tidak mencatat utang ke supplier, hanya saldo awal stok barang.</li>
                  </>
                ) : (
                  <>
                    <li>Format khusus untuk <b>Modul Pembelian Stok</b>: impor pembelian barang dari supplier.</li>
                    <li>Dapat memilih metode pembayaran: <b>Pembelian Utang</b>, <b>Tunai (Kas)</b>, atau <b>Transfer Bank</b>.</li>
                    <li>
                      Cukup isi <b>Harga Beli (Modal)</b>. Jika Harga Jual dikosongkan, otomatis dihitung <b>Laba +35%</b>.
                    </li>
                  </>
                )}
              </ul>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Langkah 1</span>
                <p className="text-xs font-bold text-amber-950">Unduh Format Template Excel</p>
                <p className="text-[10px] text-amber-800 mt-0.5">Sudah disesuaikan untuk {effectiveContext === 'stok' ? 'Stok Master' : 'Pembelian Stok'}.</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <i className="fa-solid fa-download"></i> Unduh Template Excel (.xlsx)
              </button>
            </div>
          </div>

          {/* Upload Area & Mode Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Upload Zone */}
            <div className="md:col-span-1 bg-white border-2 border-dashed border-emerald-300 rounded-xl p-4 flex flex-col items-center justify-center text-center space-y-2 hover:bg-emerald-50/40 transition">
              <i className="fa-solid fa-cloud-arrow-up text-3xl text-emerald-600"></i>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {file ? file.name : 'Pilih / Drop File Excel (.xlsx, .csv)'}
                </p>
                <p className="text-[10px] text-emerald-700 font-medium mt-0.5">Maksimal file 5MB</p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition shadow cursor-pointer flex items-center gap-1.5"
              >
                <i className="fa-solid fa-file-excel"></i>
                {file ? 'Ganti File Excel' : 'Pilih File Excel'}
              </button>
            </div>

            {/* Config Mode Option */}
            <div className="md:col-span-2 bg-white border border-emerald-200 rounded-xl p-3.5 space-y-3">
              <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <i className="fa-solid fa-sliders text-emerald-600"></i>
                Pilihan Mode Transaksi Import
              </h4>

              {effectiveContext === 'stok' ? (
                /* Strict Modul Stok Master Mode */
                <div className="p-3 bg-emerald-950 text-white rounded-xl border border-emerald-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-800 flex items-center justify-center text-emerald-300 shrink-0">
                    <i className="fa-solid fa-boxes-stacked text-base"></i>
                  </div>
                  <div>
                    <span className="font-extrabold text-xs block">Mode: Stok Master (Input Saldo Awal / Modal)</span>
                    <p className="text-[10px] text-emerald-200 mt-0.5">
                      Sesuai Modul Stok: Data barang langsung diperbarui di Master Stok tanpa transaksi pembelian utang.
                    </p>
                  </div>
                </div>
              ) : (
                /* Pembelian Mode (Utang, Kas, Bank) */
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('Utang')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      importMode === 'Utang'
                        ? 'bg-emerald-950 border-emerald-950 text-white font-bold shadow-md'
                        : 'bg-emerald-50/50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60 font-semibold'
                    }`}
                  >
                    <div className="text-xs flex items-center gap-1">
                      <i className="fa-solid fa-file-invoice-dollar text-emerald-400"></i> Pembelian Utang
                    </div>
                    <p className="text-[10px] opacity-80 mt-0.5">Catat Utang Supplier</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('Kas')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      importMode === 'Kas'
                        ? 'bg-emerald-950 border-emerald-950 text-white font-bold shadow-md'
                        : 'bg-emerald-50/50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60 font-semibold'
                    }`}
                  >
                    <div className="text-xs flex items-center gap-1">
                      <i className="fa-solid fa-money-bill-wave text-emerald-400"></i> Tunai (Kas)
                    </div>
                    <p className="text-[10px] opacity-80 mt-0.5">Bayar Langsung Tunai</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImportMode('Bank')}
                    className={`p-2.5 rounded-xl border text-left cursor-pointer transition ${
                      importMode === 'Bank'
                        ? 'bg-emerald-950 border-emerald-950 text-white font-bold shadow-md'
                        : 'bg-emerald-50/50 border-emerald-200 text-emerald-900 hover:bg-emerald-100/60 font-semibold'
                    }`}
                  >
                    <div className="text-xs flex items-center gap-1">
                      <i className="fa-solid fa-building-columns text-emerald-400"></i> Bank Transfer
                    </div>
                    <p className="text-[10px] opacity-80 mt-0.5">Bayar via Bank</p>
                  </button>
                </div>
              )}

              {/* Dynamic Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-emerald-900 block mb-1">Tanggal Transaksi</label>
                  <input
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                  />
                </div>

                {effectiveContext === 'pembelian' && importMode === 'Utang' && (
                  <>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">Nama Supplier *</label>
                      <input
                        type="text"
                        value={namaSupplier}
                        onChange={(e) => setNamaSupplier(e.target.value)}
                        placeholder="Contoh: PT Terlaksana / Distributor ABC"
                        className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1">Kontak Supplier (Opsional)</label>
                      <input
                        type="text"
                        value={kontakSupplier}
                        onChange={(e) => setKontakSupplier(e.target.value)}
                        placeholder="08xxxxxxxxxx"
                        className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                      />
                    </div>
                  </>
                )}

                {effectiveContext === 'pembelian' && importMode === 'Bank' && (
                  <div>
                    <label className="text-[11px] font-bold text-emerald-900 block mb-1">Pilih Rekening Bank</label>
                    <select
                      value={selectedBank}
                      onChange={(e) => setSelectedBank(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                    >
                      {paymentMethods
                        .filter((pm) => pm.val !== 'Kas' && pm.val !== 'Utang')
                        .map((pm) => (
                          <option key={pm.val} value={pm.val}>
                            {pm.label}
                          </option>
                        ))}
                      {paymentMethods.filter((pm) => pm.val !== 'Kas' && pm.val !== 'Utang').length === 0 && (
                        <option value="Bank BRI">BANK BRI</option>
                      )}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preview Table & Stats */}
          {previewList.length > 0 && (
            <div className="space-y-3 pt-2">
              {/* Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-emerald-950 text-white rounded-xl p-3 shadow-inner">
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Total Item Barang</span>
                  <span className="text-base font-black text-white">{totalItemCount} jenis ({totalQtyCount} unit)</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Total Harga Beli (Modal)</span>
                  <span className="text-base font-black text-amber-300">{formatRupiah(totalModalValue)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Proyeksi Total Harga Jual</span>
                  <span className="text-base font-black text-emerald-300">{formatRupiah(totalJualValue)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-emerald-300 uppercase block font-semibold">Estimasi Laba Kotor</span>
                  <span className="text-base font-black text-teal-200">
                    +{formatRupiah(projectedProfit)} (+35%)
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="border border-emerald-200 rounded-xl overflow-hidden max-h-[35vh] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-emerald-900 text-white sticky top-0 z-10 font-bold">
                    <tr>
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Kode</th>
                      <th className="py-2.5 px-3">Nama Barang</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-center">Qty</th>
                      <th className="py-2.5 px-3 text-right">Harga Beli (Modal)</th>
                      <th className="py-2.5 px-3 text-right">Harga Jual (+35%)</th>
                      <th className="py-2.5 px-3 text-right">Subtotal Modal</th>
                      <th className="py-2.5 px-2 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-emerald-100 bg-white">
                    {previewList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-emerald-50/50 transition">
                        <td className="py-2 px-3 text-emerald-600 font-bold text-[11px]">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-emerald-900 font-bold">{item.kode}</td>
                        <td className="py-2 px-3 font-bold text-emerald-950">{item.nama}</td>
                        <td className="py-2 px-3 text-emerald-700 text-[11px]">
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded text-[10px]">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={(e) => handleUpdatePreviewPrice(idx, 'qty', parseInt(e.target.value) || 1)}
                            className="w-14 text-center border border-emerald-300 rounded p-1 font-bold text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-emerald-900">
                          <input
                            type="number"
                            value={item.modal}
                            onChange={(e) => handleUpdatePreviewPrice(idx, 'modal', parseInt(e.target.value) || 0)}
                            className="w-24 text-right border border-emerald-300 rounded p-1 font-bold text-xs"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-bold">
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={item.jual}
                              onChange={(e) => handleUpdatePreviewPrice(idx, 'jual', parseInt(e.target.value) || 0)}
                              className="w-24 text-right border border-emerald-300 rounded p-1 font-bold text-xs"
                            />
                            {item.isAutoJual && (
                              <span className="bg-emerald-100 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 rounded" title="Otomatis laba +35%">
                                +35%
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-black text-emerald-950">
                          {formatRupiah(item.qty * item.modal)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePreviewItem(idx)}
                            className="text-red-400 hover:text-red-600 p-1 cursor-pointer transition"
                            title="Hapus Baris"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-emerald-100 flex flex-col sm:flex-row justify-between items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-xl text-xs hover:bg-gray-100 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleProcessImport}
            disabled={isSubmitting || previewList.length === 0}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition shadow-md shadow-emerald-600/30 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-upload"></i>
            {isSubmitting
              ? 'Memproses Import...'
              : `Proses Import & Simpan ${previewList.length} Barang`}
          </button>
        </div>
      </div>
    </div>
  );
};


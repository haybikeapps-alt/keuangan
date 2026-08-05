import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  formatISO,
  formatRupiah,
  calculateEstimatedPrice,
  saveSale,
  saveService,
  saveOtherIncome,
  getPiutangDetail,
  subscribeProducts,
  getRecentSales,
  subscribeRecentSales,
  deleteTransaction
} from '../../services/firebaseService';
import { Product, CartItem, PaymentMethod, PiutangItem } from '../../types';

interface KasirModuleProps {
  paymentMethods: PaymentMethod[];
  userRole?: 'admin' | 'kasir';
  cashierName?: string;
  initialTab?: 'barang' | 'jasa' | 'lainnya' | 'piutang' | 'riwayat' | 'laporan_harian';
  standaloneView?: boolean;
  onOpenReceipt: (title: string, data: any, type: 'sale' | 'service') => void;
  onOpenPayModal: (type: 'piutang', item: PiutangItem) => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const KasirModule: React.FC<KasirModuleProps> = ({
  paymentMethods,
  userRole = 'admin',
  cashierName = 'Kasir Karyawan',
  initialTab = 'barang',
  standaloneView = false,
  onOpenReceipt,
  onOpenPayModal,
  onSuccess,
  onError
}) => {
  const [activeTab, setActiveTab] = useState<'barang' | 'jasa' | 'lainnya' | 'piutang' | 'riwayat' | 'laporan_harian'>(initialTab);
  const [laporanShiftFilter, setLaporanShiftFilter] = useState<'saya' | 'semua'>('semua');
  const [laporanDateFilter, setLaporanDateFilter] = useState<'today' | 'semua' | 'custom'>('today');
  
  const getTodayLocalYMD = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const parseYMD = (dateVal: any): string => {
    if (!dateVal) return '';
    if (dateVal?.toDate && typeof dateVal.toDate === 'function') {
      return formatISO(dateVal.toDate());
    }
    if (typeof dateVal?.seconds === 'number') {
      return formatISO(new Date(dateVal.seconds * 1000));
    }
    if (typeof dateVal === 'string') {
      const pureMatch = dateVal.match(/^(\d{4}-\d{2}-\d{2})$/);
      if (pureMatch) return pureMatch[1];
    }
    const d = new Date(dateVal);
    if (!isNaN(d.getTime())) {
      return formatISO(d);
    }
    if (typeof dateVal === 'string') {
      const match = dateVal.match(/^(\d{4}-\d{2}-\d{2})/);
      if (match) return match[1];
    }
    return '';
  };

  const [laporanCustomDate, setLaporanCustomDate] = useState<string>(getTodayLocalYMD());

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Products state with real-time Firestore listener
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payMethod, setMetode] = useState('Kas');
  const [buyerName, setBuyerName] = useState('');
  const [buyerContact, setBuyerContact] = useState('');
  const [uangBayarInput, setUangBayarInput] = useState('');

  // Jasa state
  const [jasaNama, setJasaNama] = useState('');
  const [jasaHarga, setJasaHarga] = useState('');
  const [jasaMetode, setJasaMetode] = useState('Kas');
  const [jasaBuyerName, setJasaBuyerName] = useState('');
  const [jasaBuyerContact, setJasaBuyerContact] = useState('');

  // Lainnya state
  const [lainKet, setLainKet] = useState('');
  const [lainNom, setLainNom] = useState('');
  const [lainMetode, setLainMetode] = useState('Kas');

  // Piutang state
  const [piutangList, setPiutangList] = useState<PiutangItem[]>([]);
  const [loadingPiutang, setLoadingPiutang] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Riwayat Penjualan & Cetak Struk state
  const [salesHistory, setSalesHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<'semua' | 'Penjualan Barang' | 'Jasa Service' | 'Pendapatan Lainnya'>('semua');
  const [historyMethodFilter, setHistoryMethodFilter] = useState<string>('semua');
  const [historyDatePreset, setHistoryDatePreset] = useState<'semua' | 'today' | '7days' | 'month'>('semua');
  const [selectedTrxIds, setSelectedTrxIds] = useState<string[]>([]);
  const [selectedTrxDetail, setSelectedTrxDetail] = useState<any | null>(null);
  const [selectedTrxToDelete, setSelectedTrxToDelete] = useState<any | null>(null);
  const [isDeletingTrx, setIsDeletingTrx] = useState(false);

  const handleExportExcel = (targetList?: any[]) => {
    const listToExport = targetList && targetList.length > 0
      ? targetList
      : (salesHistory || []).filter(s => selectedTrxIds.includes(s.id));

    if (listToExport.length === 0) {
      onError('Tidak ada transaksi yang dipilih untuk dieksport. Silakan centang transaksi terlebih dahulu.');
      return;
    }

    try {
      const summaryRows = listToExport.map((s, idx) => {
        const isSale = s.tipe === 'Penjualan Barang';
        let totalHPP = 0;
        let totalJualReal = 0;
        let rincianText = '';

        if (isSale && Array.isArray(s.items)) {
          rincianText = s.items
            .map((it: any) => {
              const qty = Number(it.qty) || 1;
              const modal = Number(it.modal) || 0;
              const jualReal = Number(it.jual) || 0;
              totalHPP += modal * qty;
              totalJualReal += jualReal * qty;
              return `${it.nama || 'Item'} (x${qty} | HPP: Rp${modal.toLocaleString('id-ID')} | Jual Real: Rp${jualReal.toLocaleString('id-ID')})`;
            })
            .join('; ');

          if (totalJualReal <= 0) totalJualReal = Number(s.total) || 0;
        } else {
          rincianText = s.namaJasa || 'Jasa Service / Pendapatan';
          totalJualReal = Number(s.total) || 0;
          totalHPP = 0;
        }

        const labaKotor = totalJualReal - totalHPP;

        return {
          'No': idx + 1,
          'No Struk / ID': s.id || '-',
          'Tanggal': s.tanggal || '-',
          'Tipe Transaksi': s.tipe || '-',
          'Nama Pembeli': s.namaPembeli || '-',
          'Kontak Pembeli': s.kontakPembeli || '-',
          'Rincian Item / Jasa': rincianText,
          'Total HPP / Modal (Rp)': totalHPP,
          'Total Harga Jual Real (Rp)': totalJualReal,
          'Estimasi Laba Kotor (Rp)': labaKotor,
          'Metode Bayar': s.metode || 'Kas',
          'Uang Bayar (Rp)': Number(s.uangBayar ?? s.total) || 0,
          'Kembalian (Rp)': Number(s.kembalian) || 0,
          'Kasir': s.kasirName || sessionStorage.getItem('haybike_cashier_name') || '-'
        };
      });

      // Sheet 2: Detail Item & HPP
      const detailRows: any[] = [];
      let itemIdx = 1;

      listToExport.forEach((s) => {
        const isSale = s.tipe === 'Penjualan Barang';
        if (isSale && Array.isArray(s.items) && s.items.length > 0) {
          s.items.forEach((it: any) => {
            const qty = Number(it.qty) || 1;
            const modalSatuan = Number(it.modal) || 0;
            const jualSatuan = Number(it.jual) || 0;
            const totModal = modalSatuan * qty;
            const totJual = jualSatuan * qty;

            detailRows.push({
              'No': itemIdx++,
              'No Struk / ID': s.id || '-',
              'Tanggal': s.tanggal || '-',
              'Tipe': s.tipe || '-',
              'Nama Pembeli': s.namaPembeli || '-',
              'Kode Barang': it.kode || '-',
              'Nama Barang / Jasa': it.nama || 'Item',
              'Qty': qty,
              'HPP Satuan (Rp)': modalSatuan,
              'Harga Jual Real Satuan (Rp)': jualSatuan,
              'Total HPP / Modal (Rp)': totModal,
              'Total Jual Real (Rp)': totJual,
              'Laba Kotor Item (Rp)': totJual - totModal,
              'Kasir': s.kasirName || '-'
            });
          });
        } else {
          const totJual = Number(s.total) || 0;
          detailRows.push({
            'No': itemIdx++,
            'No Struk / ID': s.id || '-',
            'Tanggal': s.tanggal || '-',
            'Tipe': s.tipe || '-',
            'Nama Pembeli': s.namaPembeli || '-',
            'Kode Barang': '-',
            'Nama Barang / Jasa': s.namaJasa || 'Jasa Service',
            'Qty': 1,
            'HPP Satuan (Rp)': 0,
            'Harga Jual Real Satuan (Rp)': totJual,
            'Total HPP / Modal (Rp)': 0,
            'Total Jual Real (Rp)': totJual,
            'Laba Kotor Item (Rp)': totJual,
            'Kasir': s.kasirName || '-'
          });
        }
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 6 },  // No
        { wch: 22 }, // No Struk
        { wch: 16 }, // Tanggal
        { wch: 20 }, // Tipe
        { wch: 22 }, // Pembeli
        { wch: 18 }, // Kontak
        { wch: 55 }, // Rincian
        { wch: 22 }, // Total HPP
        { wch: 25 }, // Total Harga Jual Real
        { wch: 22 }, // Laba Kotor
        { wch: 16 }, // Metode
        { wch: 16 }, // Uang Bayar
        { wch: 16 }, // Kembalian
        { wch: 16 }  // Kasir
      ];

      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [
        { wch: 6 },  // No
        { wch: 22 }, // No Struk
        { wch: 16 }, // Tanggal
        { wch: 18 }, // Tipe
        { wch: 20 }, // Pembeli
        { wch: 16 }, // Kode
        { wch: 30 }, // Nama Barang
        { wch: 8 },  // Qty
        { wch: 18 }, // HPP Satuan
        { wch: 25 }, // Harga Jual Real Satuan
        { wch: 22 }, // Total HPP
        { wch: 22 }, // Total Jual Real
        { wch: 20 }, // Laba Item
        { wch: 16 }  // Kasir
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, wsSummary, 'Ringkasan Transaksi');
      XLSX.utils.book_append_sheet(workbook, wsDetail, 'Rincian Item & HPP');

      const dateStr = formatISO(new Date());
      const fileName = `Export_Riwayat_Transaksi_HPP_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      onSuccess(`Berhasil mengunduh ${listToExport.length} transaksi ke Excel (${fileName}) lengkap dengan HPP & Harga Jual Real!`);
    } catch (err: any) {
      console.error('Export Excel error:', err);
      onError('Gagal mengeksport data ke Excel: ' + (err.message || 'Error tidak diketahui'));
    }
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTrxToDelete) return;
    setIsDeletingTrx(true);
    try {
      const res = await deleteTransaction(selectedTrxToDelete.id);
      if (res.ok) {
        onSuccess(`Transaksi ${selectedTrxToDelete.id} berhasil dibatalkan dan dihapus. Stock produk telah diperbarui.`);
        setSelectedTrxToDelete(null);
        setSelectedTrxDetail(null);
        loadSalesHistory();
      } else {
        onError(res.msg || 'Gagal menghapus transaksi');
      }
    } catch (err: any) {
      onError(err.message || 'Gagal menghapus transaksi');
    } finally {
      setIsDeletingTrx(false);
    }
  };

  // Subscribe to real-time products
  useEffect(() => {
    const unsubscribe = subscribeProducts((prods) => {
      setProducts(prods);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Piutang list
  const loadPiutang = async () => {
    setLoadingPiutang(true);
    try {
      const data = await getPiutangDetail();
      setPiutangList(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPiutang(false);
    }
  };

  // Fetch Sales History list
  const loadSalesHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await getRecentSales(300);
      setSalesHistory(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    setLoadingHistory(true);
    let isMounted = true;

    const fallbackTimer = setTimeout(() => {
      if (isMounted) {
        getRecentSales(300)
          .then((data) => {
            if (isMounted) {
              setSalesHistory(data || []);
              setLoadingHistory(false);
            }
          })
          .catch(() => {
            if (isMounted) setLoadingHistory(false);
          });
      }
    }, 2000);

    const unsub = subscribeRecentSales((data) => {
      if (isMounted) {
        clearTimeout(fallbackTimer);
        setSalesHistory(data || []);
        setLoadingHistory(false);
      }
    });

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'piutang') {
      loadPiutang();
    }
  }, [activeTab]);

  // Cart operations
  const addToCart = (prod: Product) => {
    if (prod.stok <= 0) {
      onError(`Stok "${prod.nama}" habis!`);
      return;
    }
    const existing = cart.find((c) => c.kode === prod.kode);
    if (existing) {
      if (existing.qty + 1 > prod.stok) {
        onError(`Stok "${prod.nama}" tidak cukup! Sisa: ${prod.stok}`);
        return;
      }
      setCart(cart.map((c) => (c.kode === prod.kode ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      setCart([
        ...cart,
        {
          kode: prod.kode,
          nama: prod.nama,
          kategori: prod.kategori,
          modal: prod.modal,
          jual: prod.jual,
          qty: 1,
          stok: prod.stok,
          satuan: prod.satuan,
          disc: null
        }
      ]);
    }
  };

  const removeFromCart = (kode: string) => {
    setCart(cart.filter((c) => c.kode !== kode));
  };

  const updateCartQty = (kode: string, delta: number) => {
    const item = cart.find((c) => c.kode === kode);
    const prod = products.find((p) => p.kode === kode);
    if (!item) return;

    const newQty = item.qty + delta;
    if (newQty <= 0) {
      removeFromCart(kode);
    } else if (prod && newQty > prod.stok) {
      onError(`Stok "${prod.nama}" tidak cukup! Sisa: ${prod.stok}`);
    } else {
      setCart(cart.map((c) => (c.kode === kode ? { ...c, qty: newQty } : c)));
    }
  };

  const updateCartPrice = (kode: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, '')) || 0;
    setCart(cart.map((c) => (c.kode === kode ? { ...c, jual: num } : c)));
  };

  const toggleDiscount = (kode: string, checked: boolean) => {
    setCart(
      cart.map((c) => {
        if (c.kode === kode) {
          return {
            ...c,
            disc: checked ? { type: 'pct', pct: 0, price: 0 } : null
          };
        }
        return c;
      })
    );
  };

  const setDiscountType = (kode: string, type: 'pct' | 'coret') => {
    setCart(
      cart.map((c) => {
        if (c.kode === kode) {
          const oldDisc = c.disc || { type: 'pct', pct: 0, price: 0 };
          return { ...c, disc: { ...oldDisc, type } };
        }
        return c;
      })
    );
  };

  const updateDiscountVal = (kode: string, field: 'p' | 'h', val: string) => {
    const num = parseInt(val.replace(/\D/g, '')) || 0;
    setCart(
      cart.map((c) => {
        if (c.kode === kode) {
          const d = c.disc || { type: 'pct', pct: 0, price: 0 };
          return {
            ...c,
            disc: {
              ...d,
              pct: field === 'p' ? num : d.pct,
              price: field === 'h' ? num : d.price
            }
          };
        }
        return c;
      })
    );
  };

  const getHargaAwalStruk = (item: CartItem) => {
    if (item.disc) {
      if (item.disc.type === 'pct' && item.disc.pct > 0) {
        return Math.round(item.jual / (1 - item.disc.pct / 100));
      }
      if (item.disc.type === 'coret' && item.disc.price > 0) {
        return item.jual + item.disc.price;
      }
    }
    return item.jual;
  };

  const totalCart = cart.reduce((sum, item) => sum + item.jual * item.qty, 0);

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchSearch = p.nama.toLowerCase().includes(searchQuery.toLowerCase()) || p.kode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCat = !catFilter || p.kategori === catFilter;
    return matchSearch && matchCat;
  });

  // Submit Sale
  const handleProsesSale = async () => {
    if (cart.length === 0) {
      onError('Keranjang masih kosong!');
      return;
    }
    if (payMethod === 'Utang' && !buyerName.trim()) {
      onError('Isi nama pembeli untuk piutang!');
      return;
    }

    // Stock check
    for (const c of cart) {
      const p = products.find((x) => x.kode === c.kode);
      if (!p) {
        onError(`Barang "${c.nama}" tidak ditemukan!`);
        return;
      }
      if (c.qty > p.stok) {
        onError(`Stok "${c.nama}" tidak cukup! Sisa: ${p.stok}`);
        return;
      }
    }

    const itemsPayload = cart.map((c) => ({
      kode: c.kode,
      nama: c.nama,
      kategori: c.kategori,
      modal: c.modal,
      jual: c.jual,
      qty: c.qty,
      hargaAwal: getHargaAwalStruk(c),
      disc: c.disc && c.disc.type ? c.disc : null
    }));

    const parsedUangBayar = uangBayarInput ? parseFloat(uangBayarInput) : totalCart;
    const computedKembalian = Math.max(0, parsedUangBayar - totalCart);

    setIsSubmitting(true);
    try {
      const res = await saveSale(
        JSON.stringify({
          items: itemsPayload,
          tanggal: formatISO(new Date()),
          metode: payMethod,
          namaPembeli: buyerName,
          kontakPembeli: buyerContact,
          kasirName: cashierName
        })
      );

      if (res && res.ok) {
        onSuccess('Penjualan berhasil disimpan!');
        onOpenReceipt(
          'Struk Penjualan',
          {
            ...res,
            uangBayar: parsedUangBayar,
            kembalian: computedKembalian
          },
          'sale'
        );
        setCart([]);
        setBuyerName('');
        setBuyerContact('');
        setUangBayarInput('');
      } else {
        onError(res?.msg || 'Gagal memproses penjualan');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Jasa
  const handleProsesJasa = async () => {
    if (!jasaNama.trim() || !jasaHarga) {
      onError('Lengkapi nama dan harga jasa!');
      return;
    }
    if (jasaMetode === 'Utang' && !jasaBuyerName.trim()) {
      onError('Isi nama pembeli untuk piutang!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveService(
        JSON.stringify({
          namaJasa: jasaNama,
          nominal: parseInt(jasaHarga.replace(/\D/g, '')) || 0,
          tanggal: formatISO(new Date()),
          metode: jasaMetode,
          namaPembeli: jasaBuyerName,
          kontakPembeli: jasaBuyerContact,
          kasirName: cashierName
        })
      );

      if (res && res.ok) {
        const nom = parseInt(jasaHarga.replace(/\D/g, '')) || 0;
        onSuccess('Jasa Service berhasil disimpan!');
        onOpenReceipt('Struk Jasa Service', { ...res, total: nom, uangBayar: nom, kembalian: 0 }, 'service');
        setJasaNama('');
        setJasaHarga('');
        setJasaBuyerName('');
        setJasaBuyerContact('');
      } else {
        onError('Gagal menyimpan jasa');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Lainnya
  const handleProsesLainnya = async () => {
    if (!lainKet.trim() || !lainNom) {
      onError('Lengkapi keterangan dan nominal!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveOtherIncome(
        JSON.stringify({
          keterangan: lainKet,
          nominal: parseInt(lainNom.replace(/\D/g, '')) || 0,
          tanggal: formatISO(new Date()),
          metode: lainMetode,
          kasirName: cashierName
        })
      );

      if (res && res.ok) {
        onSuccess('Pendapatan lainnya berhasil disimpan!');
        setLainKet('');
        setLainNom('');
      } else {
        onError('Gagal menyimpan pendapatan');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Tabs */}
      {!standaloneView && (
        <div className="flex border-b border-emerald-200 overflow-x-auto bg-white rounded-t-xl px-2">
          <button
            type="button"
            onClick={() => setActiveTab('barang')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition ${
              activeTab === 'barang' ? 'border-emerald-500 text-emerald-700 font-extrabold' : 'border-transparent text-emerald-800/70 hover:text-emerald-800'
            }`}
          >
            <i className="fa-solid fa-box mr-1.5"></i>
            Penjualan Barang
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('jasa')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition ${
              activeTab === 'jasa' ? 'border-emerald-500 text-emerald-700 font-extrabold' : 'border-transparent text-emerald-800/70 hover:text-emerald-800'
            }`}
          >
            <i className="fa-solid fa-wrench mr-1.5"></i>
            Jasa Service
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lainnya')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition ${
              activeTab === 'lainnya' ? 'border-emerald-500 text-emerald-700 font-extrabold' : 'border-transparent text-emerald-800/70 hover:text-emerald-800'
            }`}
          >
            <i className="fa-solid fa-hand-holding-dollar mr-1.5"></i>
            Pendapatan Lainnya
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('piutang')}
            className={`py-3 px-4 font-bold text-xs border-b-2 transition flex items-center gap-1.5 ${
              activeTab === 'piutang' ? 'border-emerald-500 text-emerald-700 font-extrabold' : 'border-transparent text-emerald-800/70 hover:text-emerald-800'
            }`}
          >
            <i className="fa-solid fa-file-invoice-dollar mr-1.5"></i>
            Bayar Piutang
            {piutangList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-bold">
                {piutangList.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: BARANG */}
      {activeTab === 'barang' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Products Grid */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau kode barang..."
                className="px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-medium focus:outline-none focus:border-emerald-500 bg-white max-w-xs flex-1"
              />
              <button
                type="button"
                onClick={() => setCatFilter('')}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${
                  !catFilter ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-800 hover:border-emerald-400 bg-white'
                }`}
              >
                Semua
              </button>
              <button
                type="button"
                onClick={() => setCatFilter('Sepeda')}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${
                  catFilter === 'Sepeda' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-800 hover:border-emerald-400 bg-white'
                }`}
              >
                Sepeda
              </button>
              <button
                type="button"
                onClick={() => setCatFilter('Sparepart')}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${
                  catFilter === 'Sparepart' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-800 hover:border-emerald-400 bg-white'
                }`}
              >
                Sparepart
              </button>
              <button
                type="button"
                onClick={() => setCatFilter('Aksesoris')}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${
                  catFilter === 'Aksesoris' ? 'bg-emerald-600 text-white border-emerald-600' : 'border-emerald-200 text-emerald-800 hover:border-emerald-400 bg-white'
                }`}
              >
                Aksesoris
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-10 bg-white rounded-xl border border-emerald-100 text-emerald-400 text-xs">
                  <i className="fa-solid fa-inbox text-2xl mb-1 block"></i>
                  Tidak ada produk ditemukan
                </div>
              ) : (
                filteredProducts.map((p, idx) => {
                  const inCart = cart.find((c) => c.kode === p.kode);
                  return (
                    <div
                      key={p.id || `${p.kode}-${idx}`}
                      onClick={() => addToCart(p)}
                      className={`p-3 rounded-xl border-2 cursor-pointer transition bg-white shadow-sm hover:translate-y-[-1px] ${
                        inCart ? 'border-emerald-500 bg-emerald-50/60' : 'border-emerald-200 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">{p.kategori}</span>
                        {inCart && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                            x{inCart.qty}
                          </span>
                        )}
                      </div>
                      <p className="font-bold text-xs text-emerald-950 mb-1 leading-tight">{p.nama}</p>
                      <p className="text-[11px] font-bold text-emerald-700">Modal: {formatRupiah(p.modal)}</p>
                      <p className="text-[10px] text-teal-600 font-semibold">Taksiran: {formatRupiah(calculateEstimatedPrice(p.modal))}</p>
                      <p className={`text-[10px] font-semibold mt-1 ${p.stok <= 0 ? 'text-red-500 font-bold' : 'text-emerald-500'}`}>
                        Stok: {p.stok} {p.satuan}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart Sidebar */}
          <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm sticky top-4 space-y-3">
            <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
              <i className="fa-solid fa-cart-shopping text-emerald-500"></i>
              Keranjang Belanja
            </h3>

            <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
              {cart.length === 0 ? (
                <p className="text-emerald-400 text-xs text-center py-6">Keranjang masih kosong</p>
              ) : (
                cart.map((c, idx) => {
                  const isDisc = c.disc && (c.disc.type === 'pct' || c.disc.type === 'coret');
                  return (
                    <div key={c.id || `${c.kode}-${idx}`} className="bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-100 text-xs space-y-1.5">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-emerald-950 leading-tight flex-1 pr-1">{c.nama}</p>
                        <button
                          type="button"
                          onClick={() => removeFromCart(c.kode)}
                          className="text-red-400 hover:text-red-600 p-0.5 text-xs"
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>

                      <div className="flex justify-between items-center gap-2">
                        <input
                          type="text"
                          value={c.jual ? formatRupiah(c.jual).replace('Rp ', '') : ''}
                          onChange={(e) => updateCartPrice(c.kode, e.target.value)}
                          placeholder="Hrg Jual"
                          className="w-24 px-2 py-1 border border-emerald-200 rounded text-right text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                        />
                        <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded p-0.5">
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.kode, -1)}
                            className="w-5 h-5 rounded text-emerald-700 font-bold hover:bg-emerald-100 flex items-center justify-center text-xs"
                          >
                            -
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{c.qty}</span>
                          <button
                            type="button"
                            onClick={() => updateCartQty(c.kode, 1)}
                            className="w-5 h-5 rounded text-emerald-700 font-bold hover:bg-emerald-100 flex items-center justify-center text-xs"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Discount Checkbox & Options */}
                      <div className="border-t border-emerald-200 pt-1">
                        <label className="flex items-center gap-1.5 text-[10px] text-emerald-700 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!isDisc}
                            onChange={(e) => toggleDiscount(c.kode, e.target.checked)}
                            className="w-3 h-3 rounded text-emerald-600"
                          />
                          Tampilkan Diskon / Coret di Struk
                        </label>

                        {isDisc && (
                          <div className="mt-1.5 pl-2 border-l-2 border-emerald-300 space-y-1">
                            <div className="flex gap-3 text-[10px] font-semibold text-emerald-800">
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`dt-${c.kode}`}
                                  checked={c.disc?.type === 'pct'}
                                  onChange={() => setDiscountType(c.kode, 'pct')}
                                  className="w-3 h-3 text-emerald-600"
                                />
                                Diskon %
                              </label>
                              <label className="flex items-center gap-1 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`dt-${c.kode}`}
                                  checked={c.disc?.type === 'coret'}
                                  onChange={() => setDiscountType(c.kode, 'coret')}
                                  className="w-3 h-3 text-emerald-600"
                                />
                                Harga Coret
                              </label>
                            </div>

                            {c.disc?.type === 'pct' ? (
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-gray-500">Awal: {formatRupiah(getHargaAwalStruk(c))}</span>
                                <input
                                  type="number"
                                  placeholder="%"
                                  value={c.disc.pct || ''}
                                  onChange={(e) => updateDiscountVal(c.kode, 'p', e.target.value)}
                                  className="w-14 px-1.5 py-0.5 border border-emerald-200 rounded bg-white text-center font-bold"
                                />
                                <span>%</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-[10px]">
                                <span className="text-gray-500">Awal: {formatRupiah(getHargaAwalStruk(c))}</span>
                                <input
                                  type="number"
                                  placeholder="Selisih"
                                  value={c.disc?.price || ''}
                                  onChange={(e) => updateDiscountVal(c.kode, 'h', e.target.value)}
                                  className="w-20 px-1.5 py-0.5 border border-emerald-200 rounded bg-white text-right font-bold"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t-2 border-emerald-200 pt-2 flex justify-between items-center">
              <span className="font-bold text-emerald-900 text-xs">Total</span>
              <span className="text-lg font-black text-emerald-600">{formatRupiah(totalCart)}</span>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-emerald-800 block mb-1">Metode Pembayaran</label>
              <select
                value={payMethod}
                onChange={(e) => setMetode(e.target.value)}
                className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
              >
                {paymentMethods.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Cash Input & Quick Money Buttons */}
            {payMethod === 'Kas' && (
              <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-emerald-950">
                  <span>Uang Dibayar (Tunai)</span>
                  {uangBayarInput && parseFloat(uangBayarInput) >= totalCart && (
                    <span className="text-emerald-700">
                      Kembalian: <span className="font-black text-emerald-900">{formatRupiah(parseFloat(uangBayarInput) - totalCart)}</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-emerald-700">Rp</span>
                  <input
                    type="number"
                    value={uangBayarInput}
                    onChange={(e) => setUangBayarInput(e.target.value)}
                    placeholder={totalCart.toString()}
                    className="w-full pl-8 pr-3 py-2 border border-emerald-300 rounded-lg text-xs font-bold text-emerald-950 focus:outline-none focus:border-emerald-600 bg-white"
                  />
                </div>

                {/* Quick Money Buttons */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setUangBayarInput(totalCart.toString())}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded text-[10px] font-bold transition"
                  >
                    Uang Pas
                  </button>
                  <button
                    type="button"
                    onClick={() => setUangBayarInput('50000')}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded text-[10px] font-bold transition"
                  >
                    50rb
                  </button>
                  <button
                    type="button"
                    onClick={() => setUangBayarInput('100000')}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded text-[10px] font-bold transition"
                  >
                    100rb
                  </button>
                  <button
                    type="button"
                    onClick={() => setUangBayarInput('200000')}
                    className="px-2 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 text-emerald-900 rounded text-[10px] font-bold transition"
                  >
                    200rb
                  </button>
                </div>
              </div>
            )}

            {payMethod === 'Utang' && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                <p className="text-xs font-bold text-amber-800">
                  <i className="fa-solid fa-user-tag mr-1"></i>
                  Data Pembeli (Piutang)
                </p>
                <div>
                  <label className="text-[10px] font-semibold text-amber-900 block mb-0.5">Nama Pembeli *</label>
                  <input
                    type="text"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Nama pembeli"
                    className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-amber-900 block mb-0.5">No Kontak</label>
                  <input
                    type="text"
                    value={buyerContact}
                    onChange={(e) => setBuyerContact(e.target.value)}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs focus:outline-none focus:border-amber-500 bg-white"
                  />
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleProsesSale}
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <i className="fa-solid fa-print"></i>
              {isSubmitting ? 'Memproses...' : 'Proses & Cetak'}
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: JASA SERVICE */}
      {activeTab === 'jasa' && (
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm max-w-lg space-y-3">
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-wrench text-emerald-500"></i>
            Input Jasa Service
          </h3>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Nama Jasa / Servis *</label>
            <input
              type="text"
              value={jasaNama}
              onChange={(e) => setJasaNama(e.target.value)}
              placeholder="Contoh: Servis Ringan / Ganti Rantai"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Harga Jasa (Rp) *</label>
            <input
              type="text"
              value={jasaHarga ? formatRupiah(parseInt(jasaHarga.replace(/\D/g, '')) || 0) : ''}
              onChange={(e) => setJasaHarga(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Metode Pembayaran</label>
            <select
              value={jasaMetode}
              onChange={(e) => setJasaMetode(e.target.value)}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
            >
              {paymentMethods.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {jasaMetode === 'Utang' && (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
              <p className="text-xs font-bold text-amber-800">Data Pembeli (Piutang)</p>
              <input
                type="text"
                value={jasaBuyerName}
                onChange={(e) => setJasaBuyerName(e.target.value)}
                placeholder="Nama pembeli *"
                className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs bg-white"
              />
              <input
                type="text"
                value={jasaBuyerContact}
                onChange={(e) => setJasaBuyerContact(e.target.value)}
                placeholder="No kontak"
                className="w-full px-2.5 py-1.5 border border-amber-300 rounded text-xs bg-white"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleProsesJasa}
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
          >
            <i className="fa-solid fa-print"></i>
            {isSubmitting ? 'Memproses...' : 'Simpan & Cetak Struk Jasa'}
          </button>
        </div>
      )}

      {/* TAB 3: PENDAPATAN LAINNYA */}
      {activeTab === 'lainnya' && (
        <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm max-w-lg space-y-3">
          <h3 className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
            <i className="fa-solid fa-hand-holding-dollar text-emerald-500"></i>
            Input Pendapatan Lainnya
          </h3>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Keterangan *</label>
            <input
              type="text"
              value={lainKet}
              onChange={(e) => setLainKet(e.target.value)}
              placeholder="Contoh: Penjualan Kardus Bekas"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Nominal (Rp) *</label>
            <input
              type="text"
              value={lainNom ? formatRupiah(parseInt(lainNom.replace(/\D/g, '')) || 0) : ''}
              onChange={(e) => setLainNom(e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-emerald-800 block mb-1">Metode Pembayaran</label>
            <select
              value={lainMetode}
              onChange={(e) => setLainMetode(e.target.value)}
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
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

          <button
            type="button"
            onClick={handleProsesLainnya}
            disabled={isSubmitting}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {isSubmitting ? 'Memproses...' : 'Simpan Pendapatan'}
          </button>
        </div>
      )}

      {/* TAB 4: PIUTANG */}
      {activeTab === 'piutang' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-100">
            <h3 className="font-bold text-emerald-900 text-xs">Daftar Piutang Pelanggan</h3>
            <button
              type="button"
              onClick={loadPiutang}
              className="px-3 py-1.5 border border-emerald-200 text-emerald-800 hover:border-emerald-500 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate"></i> Refresh
            </button>
          </div>

          {loadingPiutang ? (
            <div className="text-center py-10 text-emerald-600">
              <i className="fa-solid fa-spinner fa-spin text-xl mb-1"></i>
              <p className="text-xs">Memuat data piutang...</p>
            </div>
          ) : (piutangList || []).length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-emerald-100 text-center text-emerald-400 text-xs">
              <i className="fa-solid fa-circle-check text-3xl mb-2 text-emerald-500"></i>
              <p className="font-bold text-emerald-800">Tidak ada piutang aktif</p>
              <p>Semua piutang pelanggan telah lunas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(piutangList || []).map((p) => {
                const pct = p.nominal > 0 ? Math.min(100, Math.round((p.dibayar / p.nominal) * 100)) : 0;
                return (
                  <div
                    key={p.id}
                    onClick={() => onOpenPayModal('piutang', p)}
                    className="bg-white p-4 rounded-2xl border-l-4 border-l-amber-500 border border-emerald-100 shadow-sm hover:border-emerald-400 hover:shadow-md cursor-pointer transition space-y-2"
                  >
                    <div className="flex justify-between text-xs text-gray-500">
                      <span className="font-mono font-semibold text-gray-700">{p.id}</span>
                      <span>{p.tanggal}</span>
                    </div>

                    {p.namaPembeli && p.namaPembeli !== '-' && (
                      <p className="text-xs font-semibold text-emerald-900">
                        Pembeli: <span className="font-bold text-amber-800">{p.namaPembeli}</span> {p.kontak && p.kontak !== '-' ? `(${p.kontak})` : ''}
                      </p>
                    )}

                    <p className="text-xs text-emerald-800 font-medium line-clamp-2">{p.keterangan}</p>

                    <div className="flex justify-between items-end pt-2 border-t border-emerald-50">
                      <div>
                        <p className="text-[10px] text-gray-500">Total Piutang</p>
                        <p className="text-sm font-bold text-emerald-950">{formatRupiah(p.nominal)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-gray-500">Sisa Piutang</p>
                        <p className="text-sm font-bold text-red-600">{formatRupiah(p.sisa)}</p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RIWAYAT & CETAK STRUK */}
      {activeTab === 'riwayat' && (() => {
        // Compute date filters
        const todayStr = formatISO(new Date());
        const d7Ago = new Date();
        d7Ago.setDate(d7Ago.getDate() - 7);
        const d7Str = formatISO(d7Ago);
        const firstDayMonth = formatISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

        // Filter sales history
        const filteredList = (salesHistory || []).filter((s) => {
          // Search query
          if (historySearch.trim()) {
            const q = historySearch.toLowerCase();
            const matchId = String(s.id).toLowerCase().includes(q);
            const matchBuyer = String(s.namaPembeli || '').toLowerCase().includes(q);
            const matchContact = String(s.kontakPembeli || '').toLowerCase().includes(q);
            const matchItems = (s.items || []).some((it: any) => String(it.nama).toLowerCase().includes(q));
            const matchJasa = String(s.namaJasa || '').toLowerCase().includes(q);
            if (!matchId && !matchBuyer && !matchContact && !matchItems && !matchJasa) return false;
          }

          // Type filter
          if (historyTypeFilter !== 'semua' && s.tipe !== historyTypeFilter) return false;

          // Method filter
          if (historyMethodFilter !== 'semua' && s.metode !== historyMethodFilter) return false;

        // Date filter preset
        const sYMD = parseYMD(s.tanggal);
        if (historyDatePreset === 'today' && sYMD !== todayStr) return false;
        if (historyDatePreset === '7days' && sYMD < d7Str) return false;
        if (historyDatePreset === 'month' && sYMD < firstDayMonth) return false;

          return true;
        });

        // Compute KPIs
        const totalOmset = filteredList.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        const totalTrxCount = filteredList.length;
        const totalKas = filteredList.filter(s => s.metode === 'Kas').reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        const totalUtang = filteredList.filter(s => s.metode === 'Utang').reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
        const totalBank = totalOmset - totalKas - totalUtang;
        let totalItemsSold = 0;
        filteredList.forEach(s => {
          if (s.tipe === 'Penjualan Barang' && Array.isArray(s.items)) {
            s.items.forEach((it: any) => { totalItemsSold += (Number(it.qty) || 0); });
          }
        });

        const allFilteredSelected = filteredList.length > 0 && filteredList.every(s => selectedTrxIds.includes(s.id));
        const toggleSelectAll = () => {
          if (allFilteredSelected) {
            const filteredSet = new Set(filteredList.map(s => s.id));
            setSelectedTrxIds(prev => prev.filter(id => !filteredSet.has(id)));
          } else {
            const combined = new Set([...selectedTrxIds, ...filteredList.map(s => s.id)]);
            setSelectedTrxIds(Array.from(combined));
          }
        };
        const toggleTrxSelect = (id: string) => {
          setSelectedTrxIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
          );
        };

        return (
          <div className="space-y-4">
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-3.5 rounded-2xl shadow-sm border border-emerald-700">
                <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Total Omset Penjualan</p>
                <p className="text-lg font-black mt-1 text-emerald-100">{formatRupiah(totalOmset)}</p>
                <p className="text-[10px] text-emerald-300 font-medium mt-0.5">{totalTrxCount} Transaksi Selesai</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-emerald-100">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Pembayaran Kas (Tunai)</p>
                <p className="text-base font-black text-emerald-700 mt-1">{formatRupiah(totalKas)}</p>
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Masuk ke Kasir</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-emerald-100">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Transfer / Bank / QRIS</p>
                <p className="text-base font-black text-teal-700 mt-1">{formatRupiah(totalBank)}</p>
                <p className="text-[10px] text-teal-600 font-semibold mt-0.5">Non-Tunai Direct</p>
              </div>

              <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-emerald-100">
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Penjualan Utang (Piutang)</p>
                <p className="text-base font-black text-amber-700 mt-1">{formatRupiah(totalUtang)}</p>
                <p className="text-[10px] text-amber-600 font-semibold mt-0.5">{totalItemsSold} Unit Barang Terjual</p>
              </div>
            </div>

            {/* Filter & Toolbar */}
            <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                    <i className="fa-solid fa-clock-rotate-left text-emerald-600"></i>
                    Riwayat Transaksi Penjualan & Service
                  </h3>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-semibold">
                    {filteredList.length} Transaksi Tampil
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(selectedTrxIds.length > 0 ? filteredList.filter(s => selectedTrxIds.includes(s.id)) : filteredList)}
                    disabled={filteredList.length === 0}
                    className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                    title="Eksport data transaksi ke file Excel (.xlsx)"
                  >
                    <i className="fa-solid fa-file-excel text-emerald-300"></i>
                    Export Excel {selectedTrxIds.length > 0 ? `(${selectedTrxIds.length} Dipilih)` : `(${filteredList.length})`}
                  </button>

                  <button
                    type="button"
                    onClick={loadSalesHistory}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <i className="fa-solid fa-rotate"></i> Refresh Data
                  </button>
                </div>
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t border-gray-100 text-xs">
                {/* Search */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">Cari Transaksi</label>
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="No Struk / Pembeli / Barang..."
                    className="w-full px-3 py-1.5 border border-emerald-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-600 bg-white"
                  />
                </div>

                {/* Filter Tipe */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">Tipe Transaksi</label>
                  <select
                    value={historyTypeFilter}
                    onChange={(e) => setHistoryTypeFilter(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="semua">Semua Tipe Transaksi</option>
                    <option value="Penjualan Barang">Penjualan Barang</option>
                    <option value="Jasa Service">Jasa Service</option>
                    <option value="Pendapatan Lainnya">Pendapatan Lainnya</option>
                  </select>
                </div>

                {/* Filter Metode */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">Metode Pembayaran</label>
                  <select
                    value={historyMethodFilter}
                    onChange={(e) => setHistoryMethodFilter(e.target.value)}
                    className="w-full px-3 py-1.5 border border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="semua">Semua Metode Bayar</option>
                    <option value="Kas">Kas / Tunai</option>
                    {paymentMethods.map((pm) => (
                      <option key={pm.val} value={pm.val}>
                        {pm.label}
                      </option>
                    ))}
                    <option value="Utang">Utang / Piutang</option>
                  </select>
                </div>

                {/* Date Preset Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1">Rentang Waktu</label>
                  <select
                    value={historyDatePreset}
                    onChange={(e) => setHistoryDatePreset(e.target.value as any)}
                    className="w-full px-3 py-1.5 border border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="semua">Semua Tanggal</option>
                    <option value="today">Hari Ini Saja ({todayStr})</option>
                    <option value="7days">7 Hari Terakhir</option>
                    <option value="month">Bulan Ini</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selection Banner */}
            {selectedTrxIds.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-emerald-900 shadow-sm">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-square-check text-emerald-600 text-sm"></i>
                  <span><b className="text-emerald-950 font-black">{selectedTrxIds.length}</b> transaksi dipilih dari riwayat.</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(filteredList.filter(s => selectedTrxIds.includes(s.id)))}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <i className="fa-solid fa-file-excel text-emerald-300"></i> Export Excel ({selectedTrxIds.length} Transaksi)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTrxIds([])}
                    className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    Batal Pilih
                  </button>
                </div>
              </div>
            )}

            {/* Table or Empty State */}
            {loadingHistory ? (
              <div className="text-center py-12 text-emerald-600 bg-white rounded-2xl border border-emerald-100">
                <i className="fa-solid fa-spinner fa-spin text-2xl mb-2 text-emerald-500"></i>
                <p className="text-xs font-bold">Memuat riwayat transaksi penjualan...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-emerald-100 text-center text-emerald-400 text-xs shadow-sm">
                <i className="fa-solid fa-receipt text-3xl mb-2 text-emerald-500"></i>
                <p className="font-bold text-emerald-800 text-sm">Tidak Ada Transaksi Ditemukan</p>
                <p className="text-gray-500 mt-1">Coba sesuaikan kata kunci pencarian atau filter yang Anda pilih.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-emerald-100 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-emerald-900 text-emerald-100 font-bold uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="p-3 text-center w-10">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
                            title={allFilteredSelected ? 'Batal Pilih Semua' : 'Pilih Semua Transaksi Tampil'}
                          />
                        </th>
                        <th className="p-3">No Struk / ID</th>
                        <th className="p-3">Tanggal</th>
                        <th className="p-3">Tipe & Pembeli</th>
                        <th className="p-3">Rincian Item / Jasa</th>
                        <th className="p-3 text-right">Total Nominal</th>
                        <th className="p-3 text-center">Pembayaran</th>
                        <th className="p-3 text-center">Aksi Operasional</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50">
                      {filteredList.map((s) => {
                        const isSale = s.tipe === 'Penjualan Barang';
                        const isSelected = selectedTrxIds.includes(s.id);
                        return (
                          <tr key={s.id} className={`transition ${isSelected ? 'bg-emerald-100/70' : 'hover:bg-emerald-50/40'}`}>
                            <td className="p-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleTrxSelect(s.id)}
                                className="w-4 h-4 accent-emerald-600 cursor-pointer rounded"
                              />
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-950 whitespace-nowrap">
                              <span className="bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                                {s.id}
                              </span>
                            </td>
                            <td className="p-3 text-gray-600 whitespace-nowrap font-medium">{s.tanggal}</td>
                            <td className="p-3">
                              <p className="font-bold text-emerald-950">{s.tipe}</p>
                              {s.namaPembeli && s.namaPembeli !== '-' && (
                                <p className="text-[10px] text-amber-900 font-bold flex items-center gap-1 mt-0.5">
                                  <i className="fa-solid fa-user text-amber-600 text-[9px]"></i>
                                  {s.namaPembeli} {s.kontakPembeli ? `(${s.kontakPembeli})` : ''}
                                </p>
                              )}
                            </td>
                            <td className="p-3 max-w-xs">
                              {isSale ? (
                                <div className="space-y-0.5 text-[11px]">
                                  {(Array.isArray(s.items) ? s.items : []).slice(0, 2).map((it: any, idx: number) => (
                                    <div key={idx} className="text-gray-700 flex justify-between gap-2">
                                      <span className="truncate">&bull; {it.nama}</span>
                                      <span className="font-bold text-emerald-800">x{it.qty}</span>
                                    </div>
                                  ))}
                                  {(Array.isArray(s.items) ? s.items : []).length > 2 && (
                                    <p className="text-[10px] text-emerald-600 font-bold italic">
                                      +{(Array.isArray(s.items) ? s.items : []).length - 2} item barang lainnya...
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs font-bold text-gray-800">&bull; {s.namaJasa || 'Jasa Service / Pendapatan'}</p>
                              )}
                            </td>
                            <td className="p-3 text-right font-black text-emerald-950 text-xs whitespace-nowrap">
                              {formatRupiah(s.total)}
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  s.metode === 'Kas'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : s.metode === 'Utang'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-teal-100 text-teal-800 border border-teal-300'
                                }`}
                              >
                                {s.metode}
                              </span>
                            </td>
                            <td className="p-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Detail Button */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTrxDetail(s)}
                                  className="px-2.5 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Lihat Detail Transaksi"
                                >
                                  <i className="fa-solid fa-eye text-gray-600"></i> Detail
                                </button>

                                {/* Print Struk Button */}
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenReceipt(
                                      isSale ? 'Struk Penjualan' : 'Struk Jasa Service',
                                      s,
                                      isSale ? 'sale' : 'service'
                                    )
                                  }
                                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="Cetak Struk Thermal"
                                >
                                  <i className="fa-solid fa-receipt"></i> Struk
                                </button>

                                {/* Delete / Void Button */}
                                <button
                                  type="button"
                                  onClick={() => setSelectedTrxToDelete(s)}
                                  className="px-2 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Batalkan & Hapus Transaksi Ini"
                                >
                                  <i className="fa-solid fa-trash-can"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 6: LAPORAN HARIAN KASIR */}
      {activeTab === 'laporan_harian' && (() => {
        const todayYMD = getTodayLocalYMD();
        const targetYMD = laporanDateFilter === 'today' ? todayYMD : laporanCustomDate;

        // Filter transactions for report
        const shiftSales = salesHistory.filter((s) => {
          if (laporanDateFilter !== 'semua') {
            const sYMD = parseYMD(s.tanggal);
            if (sYMD !== targetYMD) return false;
          }

          if (laporanShiftFilter === 'saya') {
            if (s.kasirName && cashierName) {
              return s.kasirName.toLowerCase().trim() === cashierName.toLowerCase().trim();
            }
          }
          return true;
        });

        // KPI Calculations
        const totalTrxCount = shiftSales.length;
        const totalOmzet = shiftSales.reduce((acc, curr) => acc + (curr.total || 0), 0);

        const totalTunai = shiftSales
          .filter((s) => s.metode === 'Kas' || s.metode === 'Tunai')
          .reduce((acc, curr) => acc + (curr.total || 0), 0);

        const totalPiutang = shiftSales
          .filter((s) => s.metode === 'Utang')
          .reduce((acc, curr) => acc + (curr.total || 0), 0);

        const totalNonTunai = shiftSales
          .filter((s) => s.metode !== 'Kas' && s.metode !== 'Tunai' && s.metode !== 'Utang')
          .reduce((acc, curr) => acc + (curr.total || 0), 0);

        // Group by Payment Method
        const methodMap: Record<string, { count: number; total: number }> = {};
        shiftSales.forEach((s) => {
          const m = s.metode || 'Lainnya';
          if (!methodMap[m]) methodMap[m] = { count: 0, total: 0 };
          methodMap[m].count += 1;
          methodMap[m].total += s.total || 0;
        });

        // Group by Transaction Type
        const typeMap: Record<string, { count: number; total: number }> = {};
        shiftSales.forEach((s) => {
          const t = s.tipe || 'Penjualan Barang';
          if (!typeMap[t]) typeMap[t] = { count: 0, total: 0 };
          typeMap[t].count += 1;
          typeMap[t].total += s.total || 0;
        });

        const printShiftSummary = () => {
          const printWindow = window.open('', '_blank', 'width=400,height=600');
          if (!printWindow) return;

          const receiptHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Laporan Harian Kasir - ${cashierName}</title>
              <style>
                body { font-family: monospace; font-size: 11px; padding: 10px; margin: 0; width: 280px; }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .divider { border-top: 1px dashed #000; margin: 6px 0; }
                .flex { display: flex; justify-content: space-between; margin: 2px 0; }
                .no-print { margin-bottom: 12px; display: flex; gap: 8px; justify-content: center; }
                .btn { background: #059669; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px; }
                .btn-close { background: #64748b; }
                @media print { .no-print { display: none !important; } }
              </style>
            </head>
            <body>
              <div class="no-print">
                <button class="btn" onclick="window.print()">🖨️ Cetak</button>
                <button class="btn btn-close" onclick="window.close()">Tutup</button>
              </div>

              <div class="center" style="margin-bottom: 6px;">
                <img src="/logo-struk.png" alt="Logo Toko" style="max-height: 48px; max-width: 120px; object-fit: contain;" />
              </div>
              <div class="center bold" style="font-size: 13px;">LAPORAN REKAP HARIAN KASIR</div>
              <div class="center bold">HAYBIKE POS & ERP</div>
              <div class="divider"></div>
              <div class="flex"><span>Kasir:</span><span class="bold">${cashierName}</span></div>
              <div class="flex"><span>Periode:</span><span>${laporanDateFilter === 'semua' ? 'Semua Tanggal' : targetYMD}</span></div>
              <div class="flex"><span>Waktu Cetak:</span><span>${new Date().toLocaleTimeString('id-ID')}</span></div>
              <div class="divider"></div>
              
              <div class="bold">RINGKASAN TRANSAKSI HARIAN:</div>
              <div class="flex"><span>Total Transaksi:</span><span class="bold">${totalTrxCount} Trx</span></div>
              <div class="flex"><span>Total Omzet Harian:</span><span class="bold">${formatRupiah(totalOmzet)}</span></div>
              <div class="divider"></div>

              <div class="bold">TOTAL UANG MASUK:</div>
              <div class="flex"><span>1. Tunai (Kas di Laci):</span><span class="bold">${formatRupiah(totalTunai)}</span></div>
              <div class="flex"><span>2. Non-Tunai (Bank/QRIS):</span><span class="bold">${formatRupiah(totalNonTunai)}</span></div>
              <div class="flex"><span>3. Utang (Piutang):</span><span class="bold">${formatRupiah(totalPiutang)}</span></div>
              <div class="divider"></div>

              <div class="bold">RINCIAN PER METODE:</div>
              ${Object.entries(methodMap).map(([m, data]) => `
                <div class="flex"><span>${m} (${data.count}x):</span><span>${formatRupiah(data.total)}</span></div>
              `).join('')}
              <div class="divider"></div>

              <div class="center bold" style="margin-top: 10px;">-- LAPORAN HARIAN KASIR --</div>
              <div class="center" style="font-size: 9px; margin-top: 4px;">Tanda Tangan Kasir: _________________</div>
            </body>
            </html>
          `;

          printWindow.document.write(receiptHtml);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            try {
              printWindow.print();
            } catch (e) {
              console.error('Print shift summary error:', e);
            }
          }, 350);
        };

        return (
          <div className="space-y-5 animate-fade-in">
            {/* Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-cyan-950 to-teal-900 rounded-3xl p-5 text-white shadow-xl border border-cyan-500/20 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                    LAPORAN HARIAN KASIR
                  </span>
                  <span className="text-cyan-300 text-xs font-semibold">
                    <i className="fa-solid fa-calendar-day mr-1"></i>
                    {laporanDateFilter === 'semua' ? 'Semua Tanggal' : targetYMD}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white tracking-tight">
                  Laporan Rekap Harian Transaksi Kasir
                </h3>
                <p className="text-xs text-cyan-200/80 mt-0.5">
                  Petugas Kasir: <strong className="text-white font-bold">{cashierName}</strong> &bull; Total Transaksi: <strong className="text-cyan-300 font-bold">{totalTrxCount} Transaksi</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Date Filter Buttons */}
                <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex text-xs">
                  <button
                    type="button"
                    onClick={() => setLaporanDateFilter('today')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      laporanDateFilter === 'today' ? 'bg-emerald-400 text-slate-950 font-extrabold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Hari Ini
                  </button>
                  <button
                    type="button"
                    onClick={() => setLaporanDateFilter('semua')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      laporanDateFilter === 'semua' ? 'bg-emerald-400 text-slate-950 font-extrabold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Semua Tanggal
                  </button>
                  <input
                    type="date"
                    value={laporanCustomDate}
                    onChange={(e) => {
                      setLaporanCustomDate(e.target.value);
                      setLaporanDateFilter('custom');
                    }}
                    className="bg-slate-900 text-white text-xs px-2 py-1 rounded-lg border border-slate-700 font-semibold focus:outline-none focus:border-cyan-400"
                  />
                </div>

                {/* Kasir Filter Buttons */}
                <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 flex text-xs">
                  <button
                    type="button"
                    onClick={() => setLaporanShiftFilter('semua')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      laporanShiftFilter === 'semua' ? 'bg-cyan-400 text-slate-950 font-extrabold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Semua Kasir
                  </button>
                  <button
                    type="button"
                    onClick={() => setLaporanShiftFilter('saya')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      laporanShiftFilter === 'saya' ? 'bg-cyan-400 text-slate-950 font-extrabold' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Kasir Saya
                  </button>
                </div>

                <button
                  type="button"
                  onClick={printShiftSummary}
                  className="px-4 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg cursor-pointer"
                >
                  <i className="fa-solid fa-print text-sm"></i>
                  <span>Cetak Struk Rekap</span>
                </button>
              </div>
            </div>

            {/* Empty State Banner if no sales match */}
            {loadingHistory ? (
              <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-200 space-y-3">
                <div className="inline-block animate-spin text-cyan-600 text-3xl">
                  <i className="fa-solid fa-spinner"></i>
                </div>
                <p className="text-xs text-slate-500 font-bold">Memuat data transaksi harian...</p>
              </div>
            ) : shiftSales.length === 0 ? (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center space-y-3">
                <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold shadow-inner">
                  <i className="fa-solid fa-chart-line"></i>
                </div>
                <div>
                  <h4 className="font-extrabold text-amber-950 text-base">Belum Ada Transaksi Ditemukan</h4>
                  <p className="text-xs text-amber-800 mt-1 max-w-md mx-auto">
                    {laporanDateFilter === 'today'
                      ? `Belum ada transaksi penjualan yang dicatat pada hari ini (${todayYMD}).`
                      : `Tidak ada data transaksi untuk tanggal (${targetYMD}) dengan filter kasir terpilih.`}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {laporanDateFilter !== 'semua' && (
                    <button
                      type="button"
                      onClick={() => setLaporanDateFilter('semua')}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-calendar-days"></i>
                      <span>Tampilkan Semua Tanggal ({salesHistory.length} Total Transaksi)</span>
                    </button>
                  )}
                  {laporanShiftFilter !== 'semua' && (
                    <button
                      type="button"
                      onClick={() => setLaporanShiftFilter('semua')}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow transition cursor-pointer flex items-center gap-1.5"
                    >
                      <i className="fa-solid fa-users"></i>
                      <span>Tampilkan Semua Kasir</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Total Omzet */}
                  <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm space-y-1">
                    <div className="flex justify-between items-center text-xs text-emerald-800 font-bold">
                      <span>TOTAL PENJUALAN HARIAN</span>
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-chart-line"></i>
                      </div>
                    </div>
                    <p className="text-xl font-black text-emerald-950">{formatRupiah(totalOmzet)}</p>
                    <p className="text-[11px] text-emerald-600 font-semibold">{totalTrxCount} Transaksi Berhasil</p>
                  </div>

                  {/* Uang Tunai */}
                  <div className="bg-white p-4 rounded-2xl border border-cyan-200 shadow-sm space-y-1">
                    <div className="flex justify-between items-center text-xs text-cyan-800 font-bold">
                      <span>UANG TUNAI (KAS DI LACI)</span>
                      <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-money-bill-wave"></i>
                      </div>
                    </div>
                    <p className="text-xl font-black text-cyan-950">{formatRupiah(totalTunai)}</p>
                    <p className="text-[11px] text-cyan-600 font-semibold">Uang Cash Fisik di Laci</p>
                  </div>

                  {/* Non Tunai */}
                  <div className="bg-white p-4 rounded-2xl border border-indigo-200 shadow-sm space-y-1">
                    <div className="flex justify-between items-center text-xs text-indigo-800 font-bold">
                      <span>UANG NON-TUNAI (BANK/QRIS)</span>
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-credit-card"></i>
                      </div>
                    </div>
                    <p className="text-xl font-black text-indigo-950">{formatRupiah(totalNonTunai)}</p>
                    <p className="text-[11px] text-indigo-600 font-semibold">Transfer / QRIS Bank</p>
                  </div>

                  {/* Piutang / Utang */}
                  <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm space-y-1">
                    <div className="flex justify-between items-center text-xs text-amber-800 font-bold">
                      <span>PENJUALAN UTANG (PIUTANG)</span>
                      <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-sm">
                        <i className="fa-solid fa-handshake-simple"></i>
                      </div>
                    </div>
                    <p className="text-xl font-black text-amber-950">{formatRupiah(totalPiutang)}</p>
                    <p className="text-[11px] text-amber-600 font-semibold">Status Belum Lunas</p>
                  </div>
                </div>
              </>
            )}

            {/* Breakdown Methods & Types */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Rincian Metode Pembayaran */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-wallet text-cyan-600"></i>
                  <span>Rekap Uang Masuk per Metode Pembayaran</span>
                </h4>
                <div className="divide-y divide-slate-100">
                  {Object.keys(methodMap).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center italic">Belum ada transaksi pada periode ini.</p>
                  ) : (
                    Object.entries(methodMap).map(([m, data]) => (
                      <div key={m} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500"></span>
                          <span className="font-bold text-slate-800">{m}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                            {data.count} Trx
                          </span>
                        </div>
                        <span className="font-black text-slate-950">{formatRupiah(data.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Rincian Tipe Transaksi */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-tags text-teal-600"></i>
                  <span>Rekap Transaksi per Kategori (Barang & Jasa)</span>
                </h4>
                <div className="divide-y divide-slate-100">
                  {Object.keys(typeMap).length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center italic">Belum ada transaksi pada periode ini.</p>
                  ) : (
                    Object.entries(typeMap).map(([t, data]) => (
                      <div key={t} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span>
                          <span className="font-bold text-slate-800">{t}</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">
                            {data.count} Trx
                          </span>
                        </div>
                        <span className="font-black text-slate-950">{formatRupiah(data.total)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Rincian Daftar Transaksi Shift */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden p-5 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-cyan-600"></i>
                  <span>Daftar Transaksi Harian Kasir ({shiftSales.length})</span>
                </h4>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Waktu</th>
                      <th className="p-3">No. Struk</th>
                      <th className="p-3">Kategori</th>
                      <th className="p-3">Kasir / Karyawan</th>
                      <th className="p-3">Pembeli</th>
                      <th className="p-3">Metode</th>
                      <th className="p-3 text-right">Total (Rp)</th>
                      <th className="p-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {shiftSales.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 italic">
                          Belum ada data transaksi harian.
                        </td>
                      </tr>
                    ) : (
                      shiftSales.map((trx, idx) => {
                        let timeStr = '-';
                        if (trx.tanggal) {
                          try {
                            const d = new Date(trx.tanggal);
                            if (!isNaN(d.getTime())) {
                              timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            }
                          } catch (e) {}
                        }

                        return (
                          <tr key={trx.id || idx} className="hover:bg-slate-50 transition">
                            <td className="p-3 font-semibold text-slate-600">{timeStr}</td>
                            <td className="p-3 font-mono font-bold text-slate-900">#{trx.id}</td>
                            <td className="p-3 font-medium text-slate-700">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {trx.tipe || 'Penjualan Barang'}
                              </span>
                            </td>
                            <td className="p-3 font-semibold text-cyan-900">{trx.kasirName || cashierName}</td>
                            <td className="p-3 text-slate-800">{trx.namaPembeli || 'Umum'}</td>
                            <td className="p-3 font-bold text-slate-900">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  trx.metode === 'Kas'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : trx.metode === 'Utang'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {trx.metode}
                              </span>
                            </td>
                            <td className="p-3 text-right font-black text-slate-900">{formatRupiah(trx.total)}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  const isSale = trx.tipe === 'Penjualan Barang';
                                  onOpenReceipt('Struk Penjualan', trx, isSale ? 'sale' : 'service');
                                }}
                                className="px-2.5 py-1 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold text-[11px] transition cursor-pointer"
                              >
                                <i className="fa-solid fa-receipt mr-1"></i> Cetak
                              </button>
                            </td>
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
      })()}

            {/* MODAL DETAIL TRANSAKSI */}
            {selectedTrxDetail && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-emerald-100 flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="bg-emerald-900 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-800 rounded-xl">
                        <i className="fa-solid fa-file-invoice text-emerald-200"></i>
                      </div>
                      <div>
                        <h4 className="font-black text-sm">Detail Transaksi #{selectedTrxDetail.id}</h4>
                        <p className="text-[10px] text-emerald-300 font-medium">
                          {selectedTrxDetail.tanggal} &bull; {selectedTrxDetail.tipe}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedTrxDetail(null)}
                      className="w-8 h-8 rounded-full bg-emerald-800 hover:bg-emerald-700 text-white flex items-center justify-center font-bold text-sm transition cursor-pointer"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs">
                    {/* Buyer & Payment Info */}
                    <div className="grid grid-cols-2 gap-2 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Nama Pembeli</p>
                        <p className="font-bold text-emerald-950 mt-0.5">
                          {selectedTrxDetail.namaPembeli && selectedTrxDetail.namaPembeli !== '-'
                            ? selectedTrxDetail.namaPembeli
                            : 'Pelanggan Umum'}
                        </p>
                        {selectedTrxDetail.kontakPembeli && (
                          <p className="text-[10px] text-gray-600 font-medium">{selectedTrxDetail.kontakPembeli}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 font-bold uppercase">Metode & Status</p>
                        <p className="font-bold text-emerald-950 mt-0.5">{selectedTrxDetail.metode}</p>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {selectedTrxDetail.status || 'Lunas'}
                        </span>
                      </div>
                    </div>

                    {/* Items Breakdown Table */}
                    <div>
                      <h5 className="font-bold text-emerald-900 mb-1 text-xs">Rincian Barang / Jasa</h5>
                      {selectedTrxDetail.tipe === 'Penjualan Barang' && Array.isArray(selectedTrxDetail.items) ? (
                        <div className="border border-emerald-100 rounded-2xl overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-emerald-50 font-bold text-emerald-900 text-[10px]">
                              <tr>
                                <th className="p-2">Item</th>
                                <th className="p-2 text-center">Qty</th>
                                <th className="p-2 text-right">Harga</th>
                                <th className="p-2 text-right">Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-emerald-50">
                              {(Array.isArray(selectedTrxDetail.items) ? selectedTrxDetail.items : []).map((it: any, idx: number) => (
                                <tr key={idx}>
                                  <td className="p-2 font-semibold text-gray-800">{it.nama}</td>
                                  <td className="p-2 text-center font-bold text-emerald-800">{it.qty} {it.satuan || 'pcs'}</td>
                                  <td className="p-2 text-right text-gray-600">{formatRupiah(it.jual)}</td>
                                  <td className="p-2 text-right font-bold text-emerald-950">
                                    {formatRupiah((it.jual || 0) * (it.qty || 0))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-200">
                          <p className="font-bold text-gray-800">{selectedTrxDetail.namaJasa || 'Jasa Service / Layanan'}</p>
                          <p className="text-gray-600 text-[11px] mt-0.5">Nominal: {formatRupiah(selectedTrxDetail.total)}</p>
                        </div>
                      )}
                    </div>

                    {/* Total Summary */}
                    <div className="p-3 bg-emerald-900 text-white rounded-2xl flex justify-between items-center font-bold">
                      <span className="text-emerald-200">Grand Total Transaksi:</span>
                      <span className="text-base text-white font-black">{formatRupiah(selectedTrxDetail.total)}</span>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTrxToDelete(selectedTrxDetail);
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <i className="fa-solid fa-trash-can"></i> Hapus / Batalkan
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTrxDetail(null)}
                        className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 text-xs transition cursor-pointer"
                      >
                        Tutup
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const isSale = selectedTrxDetail.tipe === 'Penjualan Barang';
                          onOpenReceipt(
                            isSale ? 'Struk Penjualan' : 'Struk Jasa Service',
                            selectedTrxDetail,
                            isSale ? 'sale' : 'service'
                          );
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                      >
                        <i className="fa-solid fa-receipt"></i> Cetak Struk
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL KONFIRMASI HAPUS / BATAL TRANSAKSI */}
            {selectedTrxToDelete && (
              <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-rose-100 p-5 space-y-4 text-center">
                  <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-2xl mx-auto font-bold">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                  </div>

                  <div>
                    <h4 className="font-black text-gray-900 text-base">Konfirmasi Pembatalan Transaksi</h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Apakah Anda yakin ingin membatalkan & menghapus transaksi <strong className="text-rose-700">#{selectedTrxToDelete.id}</strong> ({formatRupiah(selectedTrxToDelete.total)})?
                    </p>
                  </div>

                  {selectedTrxToDelete.tipe === 'Penjualan Barang' && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 text-left space-y-1">
                      <p className="font-bold flex items-center gap-1">
                        <i className="fa-solid fa-boxes-stacked text-amber-600"></i> Pengembalian Stok Otomatis:
                      </p>
                      <p className="text-amber-800">
                        Stok barang pada transaksi ini akan dikembalikan secara otomatis ke Master Stok produk.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                      type="button"
                      disabled={isDeletingTrx}
                      onClick={() => setSelectedTrxToDelete(null)}
                      className="w-1/2 py-2.5 rounded-xl bg-gray-200 hover:bg-gray-300 font-bold text-gray-700 text-xs transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingTrx}
                      onClick={handleDeleteTransaction}
                      className="w-1/2 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {isDeletingTrx ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin"></i> Memproses...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-trash-can"></i> Ya, Hapus Transaksi
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      };

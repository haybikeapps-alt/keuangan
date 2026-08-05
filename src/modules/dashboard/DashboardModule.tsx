import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { formatISO, formatRupiah, getDashboard, subscribeProducts } from '../../services/firebaseService';
import { DashboardData, Product } from '../../types';

interface DashboardModuleProps {
  onShowDetail?: (title: string, txns: any[]) => void;
  onNavigate?: (page: string) => void;
  onOpenPayModalPiutang?: (item: any) => void;
  onOpenPayModalUtang?: (item: any) => void;
}

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  onShowDetail,
  onNavigate,
  onOpenPayModalPiutang,
  onOpenPayModalUtang
}) => {
  const [startDate, setStartDate] = useState(() => formatISO(new Date()));
  const [endDate, setEndDate] = useState(() => formatISO(new Date()));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  // Critical Stock State & Subscription
  const [products, setProducts] = useState<Product[]>([]);
  const [showCriticalModal, setShowCriticalModal] = useState(false);
  const [criticalSearch, setCriticalSearch] = useState('');

  useEffect(() => {
    const unsub = subscribeProducts((prods) => {
      setProducts(prods);
    });
    return () => unsub();
  }, []);

  const criticalProducts = useMemo(() => {
    return products.filter((p) => p.stok <= 3).sort((a, b) => a.stok - b.stok);
  }, [products]);

  const outOfStockCount = useMemo(() => {
    return criticalProducts.filter((p) => p.stok <= 0).length;
  }, [criticalProducts]);

  const lowStockCount = useMemo(() => {
    return criticalProducts.filter((p) => p.stok > 0 && p.stok <= 3).length;
  }, [criticalProducts]);

  const fetchDashboard = async (start = startDate, end = endDate) => {
    setLoading(true);
    try {
      const res = await getDashboard(start, end);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const [chartMetric, setChartMetric] = useState<'revenue' | 'count'>('revenue');
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');

  const dailyTrendData = useMemo(() => {
    if (!data || !data.txns || data.txns.length === 0) return [];

    const map: Record<string, { tanggal: string; label: string; revenue: number; count: number }> = {};

    data.txns.forEach((t) => {
      const tgl = t.tanggal;
      if (!tgl) return;
      if (!map[tgl]) {
        const parts = tgl.split('-');
        let label = tgl;
        if (parts.length === 3) {
          const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          label = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
        }
        map[tgl] = { tanggal: tgl, label, revenue: 0, count: 0 };
      }
      map[tgl].revenue += t.total || 0;
      map[tgl].count += 1;
    });

    return Object.values(map).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-emerald-950 text-white p-3 rounded-xl shadow-xl text-xs border border-emerald-700/50">
          <p className="font-bold text-emerald-300 border-b border-emerald-800 pb-1 mb-1.5">{item.label} ({item.tanggal})</p>
          <div className="space-y-1">
            <p className="flex justify-between gap-4">
              <span className="text-emerald-200">Total Penjualan:</span>
              <span className="font-black text-white">{formatRupiah(item.revenue)}</span>
            </p>
            <p className="flex justify-between gap-4">
              <span className="text-emerald-200">Jumlah Transaksi:</span>
              <span className="font-bold text-emerald-400">{item.count} transaksi</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (val: number) => {
    if (chartMetric === 'count') return `${val}`;
    if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}M`;
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}Jt`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}Rb`;
    return `${val}`;
  };

  const handleHariIni = () => {
    const today = formatISO(new Date());
    setStartDate(today);
    setEndDate(today);
    fetchDashboard(today, today);
  };

  const handleBulanIni = () => {
    const n = new Date();
    const s = formatISO(new Date(n.getFullYear(), n.getMonth(), 1));
    const e = formatISO(new Date(n.getFullYear(), n.getMonth() + 1, 0));
    setStartDate(s);
    setEndDate(e);
    fetchDashboard(s, e);
  };

  const calcTrend = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 'Baru' : '-';
    const pct = Math.round(((curr - prev) / prev) * 100);
    return `${pct > 0 ? '+' : ''}${pct}%`;
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl border border-emerald-100 shadow-sm">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
        />
        <span className="text-emerald-700 font-semibold text-xs">s/d</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-1.5 border-2 border-emerald-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
        />
        <button
          type="button"
          onClick={() => fetchDashboard()}
          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5"
        >
          <i className="fa-solid fa-filter"></i>
          Tampilkan
        </button>
        <button
          type="button"
          onClick={handleHariIni}
          className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition"
        >
          Hari Ini
        </button>
        <button
          type="button"
          onClick={handleBulanIni}
          className="px-3 py-1.5 border-2 border-emerald-200 hover:border-emerald-500 text-emerald-800 rounded-lg text-xs font-bold transition"
        >
          Bulan Ini
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-emerald-600">
          <i className="fa-solid fa-spinner fa-spin text-2xl mb-2"></i>
          <p className="text-xs font-semibold">Memuat dashboard real-time...</p>
        </div>
      ) : data ? (
        <>
          {/* NOTIFIKASI OTOMATIS STOK KRITIS */}
          {criticalProducts.length > 0 && (
            <div className="bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 border-2 border-rose-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-rose-200">
                  <i className="fa-solid fa-triangle-exclamation text-lg animate-pulse"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-rose-950 text-xs sm:text-sm">
                      Peringatan Stok Kritis! ({criticalProducts.length} Produk Perlu Restock)
                    </h3>
                    {outOfStockCount > 0 && (
                      <span className="px-2 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                        {outOfStockCount} Habis (0)
                      </span>
                    )}
                    {lowStockCount > 0 && (
                      <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                        {lowStockCount} Menipis (&le; 3)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-rose-800 mt-0.5">
                    Beberapa barang mencapai stok minimum. Lakukan pembelian / restock agar transaksi kasir tidak terganggu.
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {(criticalProducts || []).slice(0, 5).map((cp, idx) => (
                      <span
                        key={cp.id || `${cp.kode}-${idx}`}
                        className={`text-[10px] px-2 py-0.5 rounded-lg font-bold border flex items-center gap-1 ${
                          cp.stok <= 0
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        <span>{cp.nama}</span>
                        <span className="font-mono">({cp.stok} {cp.satuan})</span>
                      </span>
                    ))}
                    {criticalProducts.length > 5 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-white text-rose-700 border border-rose-200">
                        +{criticalProducts.length - 5} barang lainnya
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-center w-full md:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowCriticalModal(true)}
                  className="px-3 py-1.5 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <i className="fa-solid fa-list-check"></i>
                  Lihat Detail
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate('pembelian')}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                  >
                    <i className="fa-solid fa-cart-plus"></i>
                    Restock Sekarang
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
            {/* Barang Terjual */}
            <div
              onClick={() => onShowDetail?.(`Barang Terjual (${data.tItems || 0} item)`, data.txns || [])}
              className="glass-sporty-card p-4 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <i className="fa-solid fa-box-open text-emerald-600 text-base"></i>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <i className="fa-solid fa-arrow-trend-up mr-1"></i>
                  {calcTrend(data.tItems || 0, data.pItems || 0)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">Barang Terjual</p>
              <p className="text-2xl font-black text-emerald-950">
                {data.tItems || 0} <span className="text-xs font-normal text-emerald-500">item</span>
              </p>
              <p className="text-[10px] text-emerald-500 mt-1 font-medium">{(data.txns || []).length} transaksi &bull; Klik detail</p>
            </div>

            {/* Total Pendapatan */}
            <div
              onClick={() => onShowDetail?.(`Detail Pendapatan (${formatRupiah(data.tRev || 0)})`, data.txns || [])}
              className="glass-sporty-card p-4 cursor-pointer"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <i className="fa-solid fa-coins text-teal-600 text-base"></i>
                </div>
                <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                  {calcTrend(data.tRev || 0, data.pRev || 0)}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">Total Pendapatan</p>
              <p className="text-2xl font-black text-emerald-950">{formatRupiah(data.tRev || 0)}</p>
              <p className="text-[10px] text-emerald-500 mt-1 font-medium">Klik detail</p>
            </div>

            {/* INDIKATOR VISUAL STOK KRITIS */}
            <div
              onClick={() => setShowCriticalModal(true)}
              className={`p-4 cursor-pointer transition ${
                criticalProducts.length > 0
                  ? 'bg-rose-50/90 border border-rose-300 rounded-2xl shadow-sm hover:border-rose-500 hover:shadow-md'
                  : 'glass-sporty-card'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    criticalProducts.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                  }`}
                >
                  <i className={`fa-solid ${criticalProducts.length > 0 ? 'fa-triangle-exclamation text-base animate-pulse' : 'fa-circle-check text-base'}`}></i>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    criticalProducts.length > 0
                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {criticalProducts.length > 0 ? 'Perlu Restock' : 'Stok Aman'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mb-0.5">Stok Kritis (&le; 3 pcs)</p>
              <p className={`text-2xl font-black ${criticalProducts.length > 0 ? 'text-rose-700' : 'text-emerald-950'}`}>
                {criticalProducts.length} <span className="text-xs font-normal text-emerald-500">item</span>
              </p>
              <p className="text-[10px] text-emerald-500 mt-1 font-medium">
                {criticalProducts.length > 0
                  ? `${outOfStockCount} habis • ${lowStockCount} menipis • Klik detail`
                  : 'Semua barang aman • Klik detail'}
              </p>
            </div>

            {/* Arus Kas */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center mb-2">
                <i className="fa-solid fa-money-bill-transfer text-cyan-600 text-base"></i>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mb-1">Arus Kas (Tunai)</p>
              <div className="flex gap-4 mt-2">
                <div>
                  <p className="text-[10px] text-emerald-500 font-medium">Kas Masuk</p>
                  <p className="text-sm font-bold text-emerald-600">{formatRupiah(data.kasM || 0)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-emerald-500 font-medium">Kas Keluar</p>
                  <p className="text-sm font-bold text-red-500">{formatRupiah(data.kasK || 0)}</p>
                </div>
              </div>
            </div>

            {/* Arus Bank */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mb-2">
                <i className="fa-solid fa-building-columns text-blue-600 text-base"></i>
              </div>
              <p className="text-[11px] text-emerald-600 font-semibold mb-1">Arus Netto Bank</p>
              <div className="space-y-1 mt-1">
                {Object.keys(data.bankFlows || {}).map((bank) => {
                  const flow = (data.bankFlows || {})[bank] || { masuk: 0, keluar: 0 };
                  const net = (flow.masuk || 0) - (flow.keluar || 0);
                  return (
                    <div key={bank} className="flex justify-between items-center text-[11px] border-b border-emerald-50 last:border-0 py-0.5">
                      <span className="font-semibold text-gray-700">{bank.replace('BANK ', '')}</span>
                      <span className={`font-bold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {formatRupiah(net)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Recharts Sales Trend Chart */}
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                  <i className="fa-solid fa-chart-line text-emerald-600 text-base"></i>
                  Grafik Tren Penjualan Harian Real-Time
                </h3>
                <p className="text-[11px] text-emerald-600 font-medium">
                  {dailyTrendData.length > 0
                    ? `Menampilkan ${dailyTrendData.length} hari aktivitas transaksi`
                    : 'Belum ada data penjualan pada rentang tanggal ini'}
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Metric toggle */}
                <div className="bg-emerald-50 p-1 rounded-xl border border-emerald-200 flex text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setChartMetric('revenue')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartMetric === 'revenue'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    Nominal (Rp)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMetric('count')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartMetric === 'count'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    Jml Transaksi
                  </button>
                </div>

                {/* Chart type toggle */}
                <div className="bg-emerald-50 p-1 rounded-xl border border-emerald-200 flex text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setChartType('area')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartType === 'area'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                    title="Grafik Area"
                  >
                    <i className="fa-solid fa-chart-area"></i>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType('bar')}
                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                      chartType === 'bar'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                    title="Grafik Batang"
                  >
                    <i className="fa-solid fa-chart-column"></i>
                  </button>
                </div>
              </div>
            </div>

            {dailyTrendData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-emerald-400 bg-emerald-50/50 rounded-xl border border-dashed border-emerald-200">
                <i className="fa-solid fa-chart-area text-3xl mb-2"></i>
                <p className="text-xs font-semibold text-emerald-600">Tidak ada data transaksi untuk grafik</p>
                <p className="text-[11px] text-emerald-400">Silakan ganti filter tanggal atau lakukan transaksi kasir</p>
              </div>
            ) : (
              <div className="h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0284c7" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#047857', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#047857', fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatYAxis}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={chartMetric === 'revenue' ? 'revenue' : 'count'}
                        name={chartMetric === 'revenue' ? 'Penjualan' : 'Transaksi'}
                        stroke={chartMetric === 'revenue' ? '#059669' : '#0284c7'}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={chartMetric === 'revenue' ? 'url(#colorRevenue)' : 'url(#colorCount)'}
                        activeDot={{ r: 6, stroke: '#064e3b', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  ) : (
                    <BarChart data={dailyTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#047857', fontSize: 11, fontWeight: 600 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#047857', fontSize: 11, fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={formatYAxis}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey={chartMetric === 'revenue' ? 'revenue' : 'count'}
                        name={chartMetric === 'revenue' ? 'Penjualan' : 'Transaksi'}
                        fill={chartMetric === 'revenue' ? '#059669' : '#0284c7'}
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Best sellers & Popular */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <h3 className="font-bold text-emerald-900 mb-3 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-trophy text-amber-500"></i>
                Produk Terlaris
              </h3>
              {(data.best || []).length === 0 ? (
                <p className="text-emerald-400 text-xs text-center py-6">Belum ada data penjualan</p>
              ) : (
                <div className="space-y-2">
                  {(data.best || []).map((b, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-emerald-50 last:border-0">
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                          i === 0 ? 'bg-amber-500 text-white' : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 truncate">
                        <p className="text-xs font-semibold text-emerald-950 truncate">{b[0]}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {b[1].qty} terjual
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm">
              <h3 className="font-bold text-emerald-900 mb-3 text-xs flex items-center gap-1.5">
                <i className="fa-solid fa-fire text-amber-500"></i>
                Hari Penjualan Terpopuler
              </h3>
              {(data.pop || []).length === 0 ? (
                <p className="text-emerald-400 text-xs text-center py-6">Belum ada data transaksi</p>
              ) : (
                <div className="space-y-2">
                  {(data.pop || []).map((p, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-emerald-50 last:border-0">
                      <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-emerald-950">{p[0]}</p>
                        <p className="text-[10px] text-emerald-500 font-medium">{p[1].count} transaksi</p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        {formatRupiah(p[1].total)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* MODAL DETAIL STOK KRITIS */}
          {showCriticalModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-rose-200 space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-rose-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500 text-white flex items-center justify-center font-bold shadow-md shadow-rose-200">
                      <i className="fa-solid fa-triangle-exclamation text-base"></i>
                    </div>
                    <div>
                      <h3 className="font-bold text-rose-950 text-sm">Daftar Barang Stok Kritis (&le; 3 Pcs)</h3>
                      <p className="text-[11px] text-rose-700">Persediaan habis atau mendekati batas minimum stok toko</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCriticalModal(false)}
                    className="text-gray-400 hover:text-gray-700 p-1 cursor-pointer"
                  >
                    <i className="fa-solid fa-xmark text-lg"></i>
                  </button>
                </div>

                {/* Filter & Search */}
                <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                  <i className="fa-solid fa-magnifying-glass text-slate-400 ml-1 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Cari kode atau nama barang kritis..."
                    value={criticalSearch}
                    onChange={(e) => setCriticalSearch(e.target.value)}
                    className="w-full bg-transparent text-xs font-medium focus:outline-none"
                  />
                  {criticalSearch && (
                    <button
                      type="button"
                      onClick={() => setCriticalSearch('')}
                      className="text-slate-400 hover:text-slate-600 text-xs px-1 cursor-pointer"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-rose-100 rounded-xl">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-rose-50 text-rose-950 border-b border-rose-200 font-bold uppercase text-[10px] tracking-wider">
                        <th className="p-2.5">Kode</th>
                        <th className="p-2.5">Nama Barang</th>
                        <th className="p-2.5">Kategori</th>
                        <th className="p-2.5 text-center">Status Stok</th>
                        <th className="p-2.5 text-right">Harga Modal</th>
                        <th className="p-2.5 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-50">
                      {criticalProducts.filter(
                        (p) =>
                          p.kode.toLowerCase().includes(criticalSearch.toLowerCase()) ||
                          p.nama.toLowerCase().includes(criticalSearch.toLowerCase())
                      ).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-400 text-xs">
                            {criticalProducts.length === 0
                              ? 'Selamat! Semua stok barang dalam kondisi aman (&gt; 3 pcs).'
                              : 'Tidak ada barang kritis yang cocok dengan pencarian.'}
                          </td>
                        </tr>
                      ) : (
                        (criticalProducts || [])
                          .filter(
                            (p) =>
                              p.kode.toLowerCase().includes(criticalSearch.toLowerCase()) ||
                              p.nama.toLowerCase().includes(criticalSearch.toLowerCase())
                          )
                          .map((p, idx) => (
                            <tr key={p.id || `${p.kode}-${idx}`} className="hover:bg-rose-50/40 transition">
                              <td className="p-2.5 font-mono text-[10px] font-semibold text-rose-900">{p.kode}</td>
                              <td className="p-2.5 font-bold text-gray-900">{p.nama}</td>
                              <td className="p-2.5 text-gray-600">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                  {p.kategori}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 ${
                                    p.stok <= 0
                                      ? 'bg-rose-600 text-white shadow-sm'
                                      : 'bg-amber-100 text-amber-900 border border-amber-300'
                                  }`}
                                >
                                  {p.stok <= 0 ? 'HABIS (0)' : `MENIPIS (${p.stok} ${p.satuan})`}
                                </span>
                              </td>
                              <td className="p-2.5 text-right font-medium text-gray-700">{formatRupiah(p.modal)}</td>
                              <td className="p-2.5 text-center">
                                {onNavigate && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowCriticalModal(false);
                                      onNavigate('pembelian');
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 mx-auto shadow-sm cursor-pointer"
                                  >
                                    <i className="fa-solid fa-cart-plus"></i> Restock
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-2 border-t border-rose-100">
                  <p className="text-[11px] text-rose-800 font-medium">
                    Total <strong className="text-rose-950">{criticalProducts.length}</strong> barang kritis memerlukan pembelian / restock.
                  </p>
                  {onNavigate && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCriticalModal(false);
                        onNavigate('pembelian');
                      }}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      <i className="fa-solid fa-truck-ramp-box"></i> Ke Form Pembelian & Restock
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

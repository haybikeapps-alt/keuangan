import React, { useState, useEffect } from 'react';
import { formatRupiah, getRiwayatBayarPiutang, getRiwayatBayarUtang, payPiutangAngsur, payPiutangFullNew, payUtangAngsur, payUtangFull } from '../services/firebaseService';
import { PaymentMethod } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  type: 'piutang' | 'utang';
  item: any;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  type,
  item,
  paymentMethods,
  onClose,
  onSuccess,
  onError
}) => {
  const [payMode, setPayMode] = useState<'angsur' | 'full' | ''>('');
  const [jumlah, setJumlah] = useState<number | ''>('');
  const [metode, setMetode] = useState<string>('');
  const [riwayat, setRiwayat] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && item) {
      setPayMode('');
      setJumlah('');
      const defaultMethod = paymentMethods.find((m) => m.val !== 'Utang')?.val || 'Kas';
      setMetode(defaultMethod);

      // Load history
      if (type === 'piutang') {
        getRiwayatBayarPiutang(item.id).then(setRiwayat);
      } else {
        getRiwayatBayarUtang(item.id).then(setRiwayat);
      }
    }
  }, [isOpen, item, type, paymentMethods]);

  if (!isOpen || !item) return null;

  const handleProses = async () => {
    if (!payMode || !item) return;
    if (!metode) {
      onError('Pilih metode pembayaran!');
      return;
    }

    setIsSubmitting(true);
    try {
      let res: any;
      if (type === 'piutang') {
        if (payMode === 'angsur') {
          if (!jumlah || Number(jumlah) <= 0) {
            onError('Masukkan jumlah angsuran yang valid');
            setIsSubmitting(false);
            return;
          }
          res = await payPiutangAngsur(JSON.stringify({ id: item.id, bayar: Number(jumlah), metode }));
        } else {
          res = await payPiutangFullNew(JSON.stringify({ id: item.id, metode }));
        }
      } else {
        if (payMode === 'angsur') {
          if (!jumlah || Number(jumlah) <= 0) {
            onError('Masukkan jumlah angsuran yang valid');
            setIsSubmitting(false);
            return;
          }
          res = await payUtangAngsur(JSON.stringify({ id: item.id, bayar: Number(jumlah), metode }));
        } else {
          res = await payUtangFull(JSON.stringify({ id: item.id, metode }));
        }
      }

      if (res && res.ok) {
        const msg = payMode === 'full' ? 'Pelunasan berhasil!' : 'Angsuran berhasil dibayar!';
        onSuccess(res.lunas ? msg + ' LUNAS!' : msg);
        onClose();
      } else {
        onError(res?.msg || 'Gagal memproses pembayaran');
      }
    } catch (e: any) {
      onError(e.message || 'Error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sisaAwal = item.sisa || 0;
  const numJumlah = Number(jumlah) || 0;
  const sisaAfter = Math.max(0, sisaAwal - numJumlah);
  const isOver = numJumlah > sisaAwal;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-emerald-200 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl p-5">
        <div className="flex justify-between items-center pb-3 border-b border-emerald-100 mb-4">
          <h3 className="text-sm font-bold text-emerald-900">
            {type === 'piutang' ? 'Pembayaran Piutang' : 'Pembayaran Utang Usaha'}
          </h3>
          <button onClick={onClose} type="button" className="text-emerald-400 hover:text-emerald-700">
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Info Card */}
        <div className="bg-emerald-50 rounded-xl p-4 mb-4 border border-emerald-100 space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-emerald-700">ID Transaction</span>
            <span className="font-mono font-semibold text-emerald-900">{item.id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-700">Tanggal</span>
            <span className="font-medium text-emerald-900">{item.tanggal}</span>
          </div>
          {type === 'utang' && item.namaSupplier && (
            <div className="flex justify-between">
              <span className="text-emerald-700">Supplier</span>
              <span className="font-semibold text-emerald-900">{item.namaSupplier}</span>
            </div>
          )}
          {type === 'piutang' && item.namaPembeli && item.namaPembeli !== '-' && (
            <div className="flex justify-between">
              <span className="text-emerald-700">Pembeli</span>
              <span className="font-semibold text-emerald-900">{item.namaPembeli}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-emerald-700">Keterangan</span>
            <span className="font-medium text-emerald-900 max-w-[220px] text-right truncate">{item.keterangan}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-emerald-700">Total Nominal</span>
            <span className="font-semibold text-emerald-900">{formatRupiah(item.nominal)}</span>
          </div>
          {item.dibayar > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Sudah Dibayar</span>
              <span className="font-semibold">{formatRupiah(item.dibayar)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-emerald-200">
            <span className="text-emerald-900">Sisa {type === 'piutang' ? 'Piutang' : 'Utang'}</span>
            <span className="text-red-600">{formatRupiah(item.sisa)}</span>
          </div>
        </div>

        {/* History */}
        {(riwayat || []).length > 0 && (
          <div className="mb-4 pt-3 border-t border-emerald-100">
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide mb-2">Riwayat Pembayaran</p>
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {(riwayat || []).map((r, idx) => (
                <div key={idx} className="flex justify-between text-xs py-1 px-2 rounded bg-emerald-50/60 border border-emerald-100">
                  <span className="text-gray-500">{r.tanggal}</span>
                  <span className="text-emerald-700 font-medium">{r.metode}</span>
                  <span className="font-bold text-emerald-600">{formatRupiah(r.jumlah)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mode Selector */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => setPayMode('angsur')}
            className={`py-3 px-2 rounded-xl border-2 text-xs font-bold transition ${
              payMode === 'angsur'
                ? 'border-amber-500 bg-amber-50 text-amber-800 shadow-md shadow-amber-500/10'
                : 'border-emerald-200 text-emerald-800 hover:border-emerald-400'
            }`}
          >
            <i className="fa-solid fa-hand-holding-dollar mr-1.5"></i>
            Angsur
          </button>
          <button
            type="button"
            onClick={() => setPayMode('full')}
            className={`py-3 px-2 rounded-xl border-2 text-xs font-bold transition ${
              payMode === 'full'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-md shadow-emerald-500/10'
                : 'border-emerald-200 text-emerald-800 hover:border-emerald-400'
            }`}
          >
            <i className="fa-solid fa-circle-check mr-1.5"></i>
            Full Bayar ({formatRupiah(item.sisa)})
          </button>
        </div>

        {/* Form area */}
        {payMode !== '' && (
          <div className="space-y-3 mb-5">
            {payMode === 'angsur' && (
              <div>
                <label className="text-xs font-semibold text-emerald-800 block mb-1">Jumlah Dibayar (Rp)</label>
                <input
                  type="number"
                  value={jumlah}
                  onChange={(e) => setJumlah(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Masukkan jumlah angsuran"
                  className="w-full px-3 py-2 rounded-lg border-2 border-emerald-200 text-xs font-semibold focus:outline-none focus:border-emerald-500"
                />
                {numJumlah > 0 && (
                  <div className={`mt-2 p-2.5 rounded-lg text-xs font-semibold flex justify-between ${isOver ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'}`}>
                    <span>Sisa setelah bayar:</span>
                    <span>{isOver ? 'Melebihi sisa!' : formatRupiah(sisaAfter)}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-emerald-800 block mb-1">Metode Pembayaran</label>
              <select
                value={metode}
                onChange={(e) => setMetode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border-2 border-emerald-200 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
              >
                {(paymentMethods || [])
                  .filter((m) => m.val !== 'Utang')
                  .map((m) => (
                    <option key={m.val} value={m.val}>
                      {m.label}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-emerald-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-emerald-200 text-emerald-800 font-semibold text-xs hover:border-emerald-400"
          >
            Batal
          </button>
          {payMode !== '' && (
            <button
              type="button"
              onClick={handleProses}
              disabled={isSubmitting || (payMode === 'angsur' && (!jumlah || isOver || numJumlah <= 0))}
              className={`px-5 py-2 rounded-xl font-bold text-xs text-white transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                payMode === 'angsur' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? 'Memproses...' : payMode === 'angsur' ? 'Bayar Angsuran' : `Bayar Penuh ${formatRupiah(item.sisa)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

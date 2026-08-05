import React, { useState } from 'react';
import { Transaction, AppSettings } from '../types';
import {
  getReceiptSpec,
  padLine,
  formatSeparator,
  centerText,
  formatItemRow
} from '../utils/receiptFormatter';

interface PrintReceiptModalProps {
  transaction: Transaction;
  settings: AppSettings;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  transaction,
  settings,
  onClose
}) => {
  const [selectedSize, setSelectedSize] = useState<'58mm' | '80mm'>(
    (settings.printerSize as '58mm' | '80mm') || '58mm'
  );

  const spec = getReceiptSpec(selectedSize);

  const handlePrint = () => {
    window.print();
  };

  const separator = formatSeparator(spec.charsPerLine, '-');
  const doubleSeparator = formatSeparator(spec.charsPerLine, '=');

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 text-white rounded-3xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-fade-in max-h-[92vh] overflow-y-auto">
        {/* Header controls */}
        <div className="flex items-center justify-between border-b border-emerald-800 pb-2">
          <div>
            <h3 className="font-bold text-sm text-emerald-300 flex items-center gap-2">
              <i className="fa-solid fa-print text-emerald-400"></i>
              Struk Penjualan Kasir
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              TRX-{transaction.id ? transaction.id.substring(0, 8).toUpperCase() : '000000'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center cursor-pointer"
          >
            <i className="fa-solid fa-xmark text-xs"></i>
          </button>
        </div>

        {/* Printer Format & Font Spec Info Badge */}
        <div className="bg-slate-800/80 p-3 rounded-2xl border border-emerald-500/30 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-300">Ukuran Printer Thermal:</span>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedSize('58mm')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                  selectedSize === '58mm'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                58 mm (32 Char)
              </button>
              <button
                type="button"
                onClick={() => setSelectedSize('80mm')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition ${
                  selectedSize === '80mm'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                80 mm (48 Char)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono bg-slate-950/60 p-2.5 rounded-xl border border-white/5 text-slate-300">
            <div>
              <span className="text-emerald-400 font-bold block">Font Type:</span>
              {spec.fontType}
            </div>
            <div>
              <span className="text-emerald-400 font-bold block">Dot Matrix (WxH):</span>
              {spec.dotMatrix}
            </div>
            <div>
              <span className="text-emerald-400 font-bold block">Std Char Size:</span>
              {spec.charSize}
            </div>
            <div>
              <span className="text-emerald-400 font-bold block">Line Capacity:</span>
              {spec.charsPerLine} Chars/Line
            </div>
          </div>
        </div>

        {/* Printable Area - Formatted Thermal Receipt Text */}
        <div className="flex justify-center bg-slate-950 p-3 rounded-2xl overflow-x-auto">
          <div
            id="pdfPrintArea"
            className="bg-white text-slate-950 p-4 font-mono text-[11px] leading-tight space-y-1 shadow-2xl border border-slate-300 select-all"
            style={{
              width: selectedSize === '58mm' ? '280px' : '360px',
              fontFamily: "'Courier New', Courier, monospace, 'Consolas'"
            }}
          >
            {/* Store Header */}
            <div className="text-center">
              <div className="font-bold text-xs uppercase leading-snug">
                {settings.namaToko || 'TOKO SEPEDA HAYBIKE'}
              </div>
              <div className="text-[10px] leading-tight text-slate-600">
                {settings.alamatToko}
              </div>
              <div className="text-[10px] text-slate-600">
                Telp: {settings.teleponToko}
              </div>
            </div>

            <div className="text-slate-400 font-mono text-[10px] my-1 text-center select-none overflow-hidden whitespace-nowrap">
              {doubleSeparator}
            </div>

            {/* Transaction Info */}
            <div className="text-[10px] space-y-0.5">
              <div>{padLine('No.Struk:', `TRX-${transaction.id ? transaction.id.substring(0, 8).toUpperCase() : '000000'}`, spec.charsPerLine)}</div>
              <div>{padLine('Tanggal :', transaction.tanggal, spec.charsPerLine)}</div>
              <div>{padLine('Kasir   :', transaction.kasir, spec.charsPerLine)}</div>
              <div>{padLine('Pelanggan:', transaction.pelanggan || 'Umum', spec.charsPerLine)}</div>
              <div>{padLine('Metode  :', transaction.metode, spec.charsPerLine)}</div>
            </div>

            <div className="text-slate-400 font-mono text-[10px] my-1 text-center select-none overflow-hidden whitespace-nowrap">
              {separator}
            </div>

            {/* Items */}
            <div className="space-y-1.5 py-0.5">
              {transaction.items.map((item, idx) => {
                const row = formatItemRow(
                  item.namaBarang,
                  item.jumlah,
                  item.hargaJual,
                  item.subtotal,
                  spec.charsPerLine
                );
                return (
                  <div key={idx} className="text-[10px]">
                    <div className="font-bold">{row.nameLine}</div>
                    <div className="text-slate-700">{row.detailLine}</div>
                  </div>
                );
              })}
            </div>

            <div className="text-slate-400 font-mono text-[10px] my-1 text-center select-none overflow-hidden whitespace-nowrap">
              {separator}
            </div>

            {/* Summary Totals */}
            <div className="space-y-0.5 text-[10px] font-bold">
              <div>{padLine('TOTAL', `Rp ${transaction.total.toLocaleString('id-ID')}`, spec.charsPerLine)}</div>
              <div className="font-normal">{padLine(`BAYAR (${transaction.metode})`, `Rp ${transaction.bayar.toLocaleString('id-ID')}`, spec.charsPerLine)}</div>
              <div>{padLine('KEMBALI', `Rp ${transaction.kembali.toLocaleString('id-ID')}`, spec.charsPerLine)}</div>
            </div>

            <div className="text-slate-400 font-mono text-[10px] my-1 text-center select-none overflow-hidden whitespace-nowrap">
              {doubleSeparator}
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-slate-600 pt-1 italic">
              {centerText(settings.footerStruk || 'Terima kasih telah berbelanja!', spec.charsPerLine)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-slate-300 font-bold rounded-xl text-xs transition cursor-pointer"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-print"></i>
            Cetak Struk POS
          </button>
        </div>
      </div>
    </div>
  );
};

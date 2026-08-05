import React, { useEffect, useState } from 'react';
import { AppSettings } from '../../types';
import { getAppSettings, updateAppSettings } from '../../services/firebaseService';

export const SettingsModule: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>({
    namaToko: 'TOKO SEPEDA HAYBIKE',
    alamatToko: 'Jl. Raya Talaga Wetan No. 45, Majalengka',
    teleponToko: '0812-3456-7890',
    footerStruk: 'Terima kasih telah berbelanja!',
    printerSize: '58mm'
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    getAppSettings().then(setSettings);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await updateAppSettings(settings);
    setLoading(false);
    setMessage('Pengaturan toko berhasil diperbarui!');
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs max-w-xl space-y-4">
        <h3 className="font-bold text-sm text-emerald-950 flex items-center gap-2">
          <i className="fa-solid fa-sliders text-emerald-600"></i>
          Pengaturan Toko & Header Struk
        </h3>

        {message && (
          <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold">
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">
              Nama Toko
            </label>
            <input
              type="text"
              required
              value={settings.namaToko}
              onChange={(e) => setSettings({ ...settings, namaToko: e.target.value })}
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">
              Alamat Lengkap Toko
            </label>
            <textarea
              required
              rows={2}
              value={settings.alamatToko}
              onChange={(e) => setSettings({ ...settings, alamatToko: e.target.value })}
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">
              No. Telepon / WhatsApp
            </label>
            <input
              type="text"
              required
              value={settings.teleponToko}
              onChange={(e) => setSettings({ ...settings, teleponToko: e.target.value })}
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">
              Pesan Footer Struk
            </label>
            <input
              type="text"
              required
              value={settings.footerStruk}
              onChange={(e) => setSettings({ ...settings, footerStruk: e.target.value })}
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-900 mb-1">
              Lebar Printer Thermal & Spesifikasi Struk
            </label>
            <select
              value={settings.printerSize}
              onChange={(e) => setSettings({ ...settings, printerSize: e.target.value as any })}
              className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-medium"
            >
              <option value="58mm">58 mm (Font A - 32 Karakter / Baris)</option>
              <option value="80mm">80 mm (Font A - 48 Karakter / Baris)</option>
            </select>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 space-y-1 font-mono">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
              <i className="fa-solid fa-print text-emerald-600"></i>
              Spesifikasi Cetak Font Struk (ESC/POS Default):
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1 text-emerald-800">
              <li><strong>Font Type:</strong> Font A (Normal / Standard Default)</li>
              <li><strong>Dot Matrix (WxH):</strong> 12 x 24 dots per karakter</li>
              <li><strong>Ukuran Karakter Standard:</strong> 1.3 x 3.0 mm</li>
              <li><strong>Kapasitas Teks (58mm):</strong> 32 Chars / Line</li>
              <li><strong>Kapasitas Teks (80mm):</strong> 42 - 48 Chars / Line</li>
            </ul>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <i className="fa-solid fa-floppy-disk"></i>
            {loading ? 'Memproses...' : 'Simpan Pengaturan'}
          </button>
        </form>
      </div>
    </div>
  );
};

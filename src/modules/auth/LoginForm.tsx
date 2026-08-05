import React, { useState, useEffect } from 'react';
import { loginUserByEmailOrUsername, sendResetPasswordEmail } from '../../services/firebaseService';
import loginBg from '../../assets/images/icon_1784888441655.jpg';

interface LoginFormProps {
  onLoginSuccess: (role: 'admin' | 'kasir', cashierName?: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => setErrorMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [errorMessage]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!identifier.trim()) {
      setErrorMessage('Mohon masukkan Email atau Username.');
      return;
    }

    if (!password) {
      setErrorMessage('Mohon masukkan Password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await loginUserByEmailOrUsername(identifier, password);
      if (res.ok && res.role) {
        const userRole = res.role;
        const userName = res.name || 'Pengguna';
        setSuccessMessage(`Login berhasil! Selamat datang, ${userName} (${userRole.toUpperCase()})`);
        setTimeout(() => {
          onLoginSuccess(userRole, userName);
        }, 600);
      } else {
        setErrorMessage(res.msg || 'Email / Username atau Password salah.');
      }
    } catch (err: any) {
      setErrorMessage('Terjadi kesalahan koneksi saat masuk.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    if (!identifier.trim()) {
      setErrorMessage('Isi dulu Email / Username Anda, lalu tekan tautan ini lagi.');
      return;
    }
    setIsSendingReset(true);
    try {
      const res = await sendResetPasswordEmail(identifier);
      if (res.ok) {
        setSuccessMessage('Tautan atur ulang password sudah dikirim. Periksa kotak masuk Anda.');
      } else {
        setErrorMessage(res.msg || 'Gagal mengirim tautan atur ulang.');
      }
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(6, 40, 30, 0.45), rgba(4, 80, 60, 0.55)), url(${loginBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="text-center w-full max-w-md animate-fade-in my-auto">
        {/* Logo Header */}
        <div className="mb-3 flex justify-center">
          <img
            src="/logo.png"
            alt="Logo Toko HayBike"
            className="h-20 w-auto object-contain rounded-2xl shadow-lg border border-emerald-300/30 bg-white/20 p-1 mb-1"
          />
        </div>
        <h1 className="text-white font-black text-xl tracking-wide drop-shadow-md">
          Toko Sepeda HayBike
        </h1>
        <p className="text-emerald-200 text-xs sm:text-sm mb-5 font-light">
          Sistem Informasi Kasir POS & ERP Akuntansi
        </p>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20 shadow-2xl text-left">
          <div className="mb-5 border-b border-white/15 pb-3">
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <i className="fa-solid fa-right-to-bracket text-emerald-400"></i>
              <span>Masuk ke Akun Anda</span>
            </h2>
            <p className="text-emerald-200/80 text-xs mt-1">
              Masukkan Email atau Username dan Password yang telah terdaftar.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email / Username Input */}
            <div>
              <label className="text-emerald-100 text-xs font-bold block mb-1.5 tracking-wide uppercase">
                Email / Username *
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/70">
                  <i className="fa-solid fa-envelope text-sm"></i>
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="Contoh: admin@haybike.com atau siti_kasir"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-emerald-100/40 font-medium focus:outline-none focus:border-emerald-400 transition text-sm"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="text-emerald-100 text-xs font-bold block mb-1.5 tracking-wide uppercase">
                Password *
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-300/70">
                  <i className="fa-solid fa-lock text-sm"></i>
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password Anda"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-emerald-100/40 font-medium focus:outline-none focus:border-emerald-400 transition text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition p-1"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-black rounded-xl transition flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer text-sm"
            >
              {isLoading ? (
                <i className="fa-solid fa-spinner fa-spin text-base"></i>
              ) : (
                <i className="fa-solid fa-right-to-bracket text-base"></i>
              )}
              <span>{isLoading ? 'Memeriksa Kredensial...' : 'Masuk Sekarang'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isSendingReset}
                className="text-emerald-200/80 hover:text-emerald-100 text-[11px] font-medium underline underline-offset-2 transition disabled:opacity-50 cursor-pointer"
              >
                {isSendingReset ? 'Mengirim tautan...' : 'Lupa password?'}
              </button>
            </div>
          </form>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mt-4 p-3 rounded-xl bg-rose-500/30 border border-rose-400/40 text-rose-100 text-xs text-center font-medium flex items-center justify-center gap-2 animate-fade-in">
              <i className="fa-solid fa-triangle-exclamation text-rose-300 text-sm"></i>
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mt-4 p-3 rounded-xl bg-emerald-500/40 border border-emerald-300/50 text-emerald-100 text-xs text-center font-bold flex items-center justify-center gap-2 animate-fade-in">
              <i className="fa-solid fa-circle-check text-emerald-300 text-sm"></i>
              <span>{successMessage}</span>
            </div>
          )}
        </div>

        <p className="text-emerald-200/60 text-[11px] mt-4">
          &copy; 2026 Toko Sepeda HayBike &bull; Role-Based Access Control System
        </p>
      </div>
    </div>
  );
};


import React, { useState, useEffect } from 'react';
import {
  subscribeUserAccounts,
  createUserAccount,
  updateUserAccount,
  deleteUserAccount,
  changeOwnPassword,
  sendResetPasswordEmail,
  isInternalEmail,
  toAuthEmail
} from '../../services/firebaseService';
import { UserAccount } from '../../types';

interface PembuatanAkunModuleProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const PembuatanAkunModule: React.FC<PembuatanAkunModuleProps> = ({
  onSuccess,
  onError
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  // Form akun
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formPassword2, setFormPassword2] = useState('');
  const [formRole, setFormRole] = useState<'admin' | 'kasir'>('kasir');
  const [formStatus, setFormStatus] = useState<'active' | 'nonactive'>('active');
  const [saving, setSaving] = useState(false);

  // Pencarian
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('ALL');

  // Ganti password sendiri
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pinSuccessMsg, setPinSuccessMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeUserAccounts((data) => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinSuccessMsg('');

    if (!oldPass) return onError('Masukkan password Anda saat ini.');
    if (!newPass || newPass.length < 8) return onError('Password baru minimal 8 karakter.');
    if (newPass !== confirmPass) return onError('Konfirmasi password baru tidak cocok.');
    if (newPass === oldPass) return onError('Password baru harus berbeda dari yang lama.');

    setSavingPassword(true);
    try {
      const res = await changeOwnPassword(oldPass, newPass);
      if (res.ok) {
        setOldPass('');
        setNewPass('');
        setConfirmPass('');
        setPinSuccessMsg('Password Anda berhasil diperbarui.');
        onSuccess('Password berhasil diubah!');
      } else {
        onError(res.msg || 'Gagal memperbarui password.');
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setFormName('');
    setFormUsername('');
    setFormEmail('');
    setFormPassword('');
    setFormPassword2('');
    setFormRole('kasir');
    setFormStatus('active');
    setShowModal(true);
  };

  const handleOpenEditModal = (user: UserAccount) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormUsername(user.username);
    setFormEmail(isInternalEmail(user.email) ? '' : user.email || '');
    setFormPassword('');
    setFormPassword2('');
    setFormRole(user.role);
    setFormStatus(user.status);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return onError('Nama lengkap wajib diisi!');
    if (!formUsername.trim()) return onError('Username / ID Login wajib diisi!');

    setSaving(true);
    try {
      if (editingUser && editingUser.id) {
        const res = await updateUserAccount(editingUser.id, {
          name: formName,
          username: formUsername,
          email: formEmail.trim() || editingUser.email,
          role: formRole,
          status: formStatus
        });
        if (res.ok) {
          onSuccess(`Akun "${formName}" berhasil diperbarui.`);
          setShowModal(false);
        } else {
          onError(res.msg || 'Gagal memperbarui akun.');
        }
      } else {
        if (!formPassword) return onError('Password wajib diisi untuk akun baru.');
        if (formPassword.length < 8) return onError('Password minimal 8 karakter.');
        if (formPassword !== formPassword2) return onError('Konfirmasi password tidak cocok.');

        const res = await createUserAccount({
          name: formName,
          username: formUsername,
          email: formEmail,
          password: formPassword,
          role: formRole,
          status: formStatus
        });
        if (res.ok) {
          onSuccess(`Akun "${formName}" berhasil dibuat di Firebase Authentication.`);
          setShowModal(false);
        } else {
          onError(res.msg || 'Gagal membuat akun.');
        }
      }
    } catch (err: any) {
      onError(err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (user: UserAccount) => {
    if (!user.id) return;
    const newStatus = user.status === 'active' ? 'nonactive' : 'active';
    const res = await updateUserAccount(user.id, { status: newStatus });
    if (res.ok) {
      onSuccess(
        `Akun "${user.name}" kini ${newStatus === 'active' ? 'AKTIF' : 'NON-AKTIF'}.` +
          (newStatus === 'nonactive' ? ' Sesi yang sedang berjalan langsung terputus.' : '')
      );
    } else {
      onError(res.msg || 'Gagal mengubah status akun.');
    }
  };

  const handleResetPassword = async (user: UserAccount) => {
    if (isInternalEmail(user.email)) {
      onError(
        `Akun "${user.username}" memakai username tanpa surel, jadi tautan reset tidak bisa dikirim. ` +
          'Hapus akunnya lalu buat ulang dengan password baru.'
      );
      return;
    }
    const res = await sendResetPasswordEmail(user.email || user.username);
    if (res.ok) {
      onSuccess(`Tautan atur ulang password dikirim ke ${user.email}.`);
    } else {
      onError(res.msg || 'Gagal mengirim tautan reset.');
    }
  };

  const handleDelete = async (user: UserAccount) => {
    if (!user.id) return;
    if (
      !window.confirm(
        `Cabut akses akun "${user.name}" (${user.username})?\n\n` +
          'Profil dan seluruh hak aksesnya dihapus permanen. Kredensial login di ' +
          'Firebase Authentication tetap ada, tetapi tanpa profil ia tidak bisa ' +
          'membaca maupun menulis data apa pun.'
      )
    ) {
      return;
    }
    const res = await deleteUserAccount(user.id);
    if (res.ok) {
      onSuccess(`Akses akun "${user.name}" berhasil dicabut.`);
    } else {
      onError(res.msg || 'Gagal menghapus akun.');
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      u.name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.email && u.email.toLowerCase().includes(q));
    const matchRole = filterRole === 'ALL' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  const totalKasir = users.filter((u) => u.role === 'kasir').length;
  const kasirAktif = users.filter((u) => u.role === 'kasir' && u.status === 'active').length;
  const totalAdmin = users.filter((u) => u.role === 'admin').length;

  const previewEmail = formEmail.trim() || (formUsername.trim() ? toAuthEmail(formUsername) : '');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-cyan-950 text-white p-5 rounded-2xl shadow-md border border-emerald-700/50 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-emerald-700/50 rounded-xl border border-emerald-500/30 text-emerald-300">
              <i className="fa-solid fa-user-gear text-xl"></i>
            </span>
            <h2 className="text-lg font-black tracking-wide">Pembuatan &amp; Kelola Akun</h2>
          </div>
          <p className="text-xs text-emerald-200">
            Kredensial dikelola Firebase Authentication. Firestore hanya menyimpan nama,
            username, role, dan status &mdash; tidak pernah password.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowTutorialModal(true)}
            className="px-3.5 py-2.5 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 text-xs font-bold rounded-xl border border-emerald-500/40 transition flex items-center gap-2 cursor-pointer shadow-md"
          >
            <i className="fa-solid fa-book-open text-amber-300"></i>
            <span>Tutorial &amp; Keamanan</span>
          </button>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-4 py-2.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black rounded-xl shadow-lg transition flex items-center gap-2 cursor-pointer"
          >
            <i className="fa-solid fa-user-plus text-sm"></i>
            <span>Buat Akun Baru</span>
          </button>
        </div>
      </div>

      {/* Ganti password sendiri */}
      <form
        onSubmit={handleChangeOwnPassword}
        className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm space-y-3"
      >
        <div className="flex items-center gap-2 pb-3 border-b border-emerald-100">
          <i className="fa-solid fa-lock text-amber-600 text-base"></i>
          <h3 className="font-bold text-emerald-950 text-sm">Ganti Password Akun Saya</h3>
        </div>

        <p className="text-xs text-gray-500">
          Berlaku untuk akun yang sedang Anda pakai. Firebase meminta password lama sebagai
          verifikasi &mdash; tanpa itu, siapa pun yang menemukan perangkat Anda dalam keadaan
          terbuka bisa mengunci Anda keluar dari sistem sendiri.
        </p>

        {pinSuccessMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <i className="fa-solid fa-circle-check text-emerald-600"></i>
            {pinSuccessMsg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-semibold text-emerald-900 block mb-1">Password Saat Ini *</label>
            <input
              type="password"
              autoComplete="current-password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              placeholder="Password lama"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-emerald-900 block mb-1">Password Baru *</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Minimal 8 karakter"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-emerald-900 block mb-1">Konfirmasi Password Baru *</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Ulangi password baru"
              className="w-full px-3 py-2 border-2 border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={savingPassword}
          className="py-2.5 px-5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
        >
          <i className="fa-solid fa-key"></i>
          {savingPassword ? 'Memperbarui...' : 'Perbarui Password Saya'}
        </button>
      </form>

      {/* Kartu statistik */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-semibold mb-0.5">Total Akun Kasir</p>
            <p className="text-xl font-black text-emerald-950">{totalKasir}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-lg border border-cyan-100">
            <i className="fa-solid fa-cash-register"></i>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-semibold mb-0.5">Kasir Aktif</p>
            <p className="text-xl font-black text-emerald-600">{kasirAktif}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg border border-emerald-100">
            <i className="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-semibold mb-0.5">Akun Admin Pemilik</p>
            <p className="text-xl font-black text-emerald-950">{totalAdmin}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center text-lg border border-emerald-100">
            <i className="fa-solid fa-user-shield"></i>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-700 font-semibold mb-0.5">Model Keamanan</p>
            <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Firebase Auth + Rules
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-lg border border-teal-100">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
        </div>
      </div>

      {/* Tabel akun */}
      <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-users-gear text-emerald-700"></i>
            <h3 className="font-bold text-emerald-950 text-sm">Daftar Akun Pengguna</h3>
            <span className="px-2 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded-full">
              {filteredUsers.length} Akun
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari nama / username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 w-48 sm:w-64"
              />
              <i className="fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-400 text-xs"></i>
            </div>

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-1.5 bg-white border border-emerald-200 rounded-xl text-xs font-medium text-emerald-900 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">Semua Role</option>
              <option value="kasir">Role Kasir</option>
              <option value="admin">Role Admin</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-emerald-900 text-white font-bold uppercase tracking-wider text-[11px]">
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3">Nama Lengkap</th>
                <th className="p-3">Username / ID Login</th>
                <th className="p-3">Email Login</th>
                <th className="p-3 text-center">Role</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Login Terakhir</th>
                <th className="p-3 text-center w-36">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-50 text-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-emerald-600 font-medium">
                    <i className="fa-solid fa-circle-notch fa-spin text-xl mb-2 block"></i>
                    Memuat daftar akun...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-500">
                    <i className="fa-solid fa-user-slash text-2xl text-slate-300 mb-2 block"></i>
                    Belum ada akun terdaftar atau sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u, idx) => (
                  <tr key={u.id || idx} className="hover:bg-emerald-50/40 transition">
                    <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                    <td className="p-3 font-bold text-emerald-950">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            u.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                          }`}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <span>{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-mono font-bold text-slate-700">{u.username}</td>
                    <td className="p-3 text-slate-500">
                      {isInternalEmail(u.email) ? (
                        <span className="text-slate-400 italic">username internal</span>
                      ) : (
                        u.email || '-'
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          u.role === 'admin'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-cyan-100 text-cyan-800 border border-cyan-300'
                        }`}
                      >
                        {u.role === 'admin' ? 'ADMIN' : 'KASIR'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        title="Klik untuk mengubah status"
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition flex items-center gap-1 mx-auto cursor-pointer ${
                          u.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        ></span>
                        <span>{u.status === 'active' ? 'Aktif' : 'Non-Aktif'}</span>
                      </button>
                    </td>
                    <td className="p-3 text-center text-slate-500 text-[11px]">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('id-ID') : '-'}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(u)}
                          title="Edit Akun"
                          className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-800 rounded-lg transition cursor-pointer"
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(u)}
                          title="Kirim tautan atur ulang password"
                          className="p-1.5 bg-slate-100 hover:bg-amber-100 text-slate-700 hover:text-amber-700 rounded-lg transition cursor-pointer"
                        >
                          <i className="fa-solid fa-key"></i>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          title="Cabut Akses"
                          className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-700 hover:text-rose-700 rounded-lg transition cursor-pointer"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tambah / edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-emerald-100 shadow-2xl animate-fade-in space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <i className={`fa-solid ${editingUser ? 'fa-pen-to-square' : 'fa-user-plus'}`}></i>
                </span>
                <h3 className="font-bold text-emerald-950 text-base">
                  {editingUser ? 'Edit Akun Pengguna' : 'Tambah Akun Baru'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-emerald-900 block mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Siti Aminah"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-900 block mb-1">Username / ID Login *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: kasir_siti"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Huruf kecil, angka, titik, garis bawah, atau strip. Minimal 3 karakter.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-emerald-900 block mb-1">Email Asli (Opsional)</label>
                <input
                  type="email"
                  placeholder="Kosongkan bila kasir hanya pakai username"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
                {previewEmail && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Identitas Firebase: <code className="text-emerald-700">{previewEmail}</code>
                    {isInternalEmail(previewEmail) && ' (internal, tidak bisa dikirimi surel reset)'}
                  </p>
                )}
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="text-xs font-bold text-emerald-900 block mb-1">Password *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Minimal 8 karakter"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-emerald-900 block mb-1">Konfirmasi Password *</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder="Ulangi password"
                      value={formPassword2}
                      onChange={(e) => setFormPassword2(e.target.value)}
                      className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Catat baik-baik lalu serahkan langsung ke karyawan. Setelah tersimpan,
                      password tidak bisa dilihat lagi oleh siapa pun &mdash; termasuk Anda.
                    </p>
                  </div>
                </>
              )}

              {editingUser && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                  <i className="fa-solid fa-circle-info mr-1"></i>
                  Password tidak dapat diubah dari sini. Untuk akun ber-email asli, gunakan
                  tombol kunci di tabel untuk mengirim tautan atur ulang.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-emerald-900 block mb-1">Role</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="kasir">KASIR</option>
                    <option value="admin">ADMIN</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-emerald-900 block mb-1">Status Akun</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-emerald-50/30 border border-emerald-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="active">AKTIF</option>
                    <option value="nonactive">NON-AKTIF</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {saving && <i className="fa-solid fa-spinner fa-spin"></i>}
                  <span>{editingUser ? 'Simpan Perubahan' : 'Buat Akun'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal tutorial */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 text-white rounded-3xl max-w-2xl w-full p-6 border border-emerald-500/40 shadow-2xl space-y-5 animate-fade-in my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div>
                  <h3 className="font-black text-sm text-white">Panduan Keamanan Akun</h3>
                  <p className="text-[11px] text-emerald-300/80">Manajemen Role Admin &amp; Kasir HayBike</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTutorialModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs flex items-center justify-center">1</span>
                  <h4 className="font-bold text-emerald-200 text-xs">Bagaimana Login Bekerja Sekarang</h4>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px] pl-8">
                  Password diperiksa oleh server Firebase Authentication, bukan oleh peramban.
                  Setelah lolos, sistem membaca dokumen profil untuk mengetahui role dan status.
                  Kasir yang mengetik <code>kasir_siti</code> sebenarnya masuk sebagai
                  <code> kasir_siti@haybike.local</code> &mdash; alamat internal yang dibentuk otomatis.
                </p>
              </div>

              <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs flex items-center justify-center">2</span>
                  <h4 className="font-bold text-emerald-200 text-xs">Karyawan Berhenti Bekerja</h4>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px] pl-8">
                  Klik lencana statusnya menjadi <b className="text-rose-400">Non-Aktif</b>.
                  Sesi yang sedang berjalan di perangkat mana pun langsung terputus saat itu juga,
                  tanpa perlu menunggu ia menutup aplikasi. Untuk pencabutan permanen, gunakan
                  tombol hapus.
                </p>
              </div>

              <div className="bg-emerald-950/60 p-4 rounded-2xl border border-emerald-800/80 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-400 text-emerald-950 font-black text-xs flex items-center justify-center">3</span>
                  <h4 className="font-bold text-emerald-200 text-xs">Password Lupa</h4>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px] pl-8">
                  Akun ber-email asli bisa dikirimi tautan atur ulang lewat tombol kunci.
                  Akun berbasis username tidak punya kotak surat, jadi jalan satu-satunya adalah
                  mencabut akun lalu membuatnya kembali. Bila Anda ingin semua karyawan bisa
                  mengatur ulang sendiri, daftarkan mereka dengan email asli.
                </p>
              </div>

              <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                <h4 className="font-bold text-amber-300 text-xs flex items-center gap-2">
                  <i className="fa-solid fa-list-check text-amber-400"></i>
                  <span>Daftar Periksa Pemilik Toko</span>
                </h4>
                <ul className="space-y-1.5 text-[11px] text-slate-300 pl-2">
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-check text-emerald-400 mt-0.5"></i>
                    <span>Pastikan <b>Anonymous sign-in</b> berstatus mati di Firebase Console.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-check text-emerald-400 mt-0.5"></i>
                    <span>Pastikan <code>firestore.rules</code> versi terbaru sudah dipublikasikan.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-check text-emerald-400 mt-0.5"></i>
                    <span>Satu karyawan satu akun. Jangan ada akun bersama.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <i className="fa-solid fa-check text-emerald-400 mt-0.5"></i>
                    <span>Batasi jumlah akun ber-role Admin sesedikit mungkin.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="pt-2 text-center border-t border-emerald-800/80">
              <button
                type="button"
                onClick={() => setShowTutorialModal(false)}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black rounded-xl transition shadow-lg cursor-pointer"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

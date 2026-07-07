// src/app/settings/SettingsClient.jsx
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useWhisper } from '@/contexts/WhisperContext';
import ToggleSwitch from '@/components/ui/ToggleSwitch';

// ── Country dial codes ──
const DIAL_CODES = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+61', country: 'AU' },
  { code: '+81', country: 'JP' },
  { code: '+86', country: 'CN' },
  { code: '+91', country: 'IN' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+39', country: 'IT' },
  { code: '+34', country: 'ES' },
  { code: '+55', country: 'BR' },
  { code: '+7', country: 'RU' },
  { code: '+82', country: 'KR' },
  { code: '+31', country: 'NL' },
  { code: '+46', country: 'SE' },
  { code: '+41', country: 'CH' },
  { code: '+27', country: 'ZA' },
  { code: '+234', country: 'NG' },
  { code: '+254', country: 'KE' },
  { code: '+256', country: 'UG' },
  { code: '+255', country: 'TZ' },
  { code: '+233', country: 'GH' },
  { code: '+52', country: 'MX' },
  { code: '+54', country: 'AR' },
  { code: '+56', country: 'CL' },
  { code: '+57', country: 'CO' },
  { code: '+60', country: 'MY' },
  { code: '+63', country: 'PH' },
  { code: '+64', country: 'NZ' },
  { code: '+65', country: 'SG' },
  { code: '+66', country: 'TH' },
  { code: '+351', country: 'PT' },
  { code: '+353', country: 'IE' },
  { code: '+45', country: 'DK' },
  { code: '+47', country: 'NO' },
  { code: '+358', country: 'FI' },
  { code: '+30', country: 'GR' },
  { code: '+90', country: 'TR' },
  { code: '+966', country: 'SA' },
  { code: '+971', country: 'AE' },
  { code: '+92', country: 'PK' },
  { code: '+880', country: 'BD' },
  { code: '+62', country: 'ID' },
];

function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000';
  return `${base}${url}`;
}

function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 60%)`;
}

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);
  const bgColor = type === 'error' ? 'var(--color-rose)' : 'var(--color-green)';
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium" style={{ background: bgColor }}>
      {message}
    </div>
  );
}

export default function SettingsClient() {
  const { user, login } = useAuth();
  const router = useRouter();
  const { settings, fetchSettings, regenerateSlug, updateSettings } = useWhisper();

  // ── Form state ──
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [password, setPassword] = useState('');
  const [location, setLocation] = useState('');
  const [school, setSchool] = useState('');
  const [occupation, setOccupation] = useState('');
  const [website, setWebsite] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [dialCode, setDialCode] = useState('+1');
  const [phone, setPhone] = useState('');

  // ── Notification preferences ──
  const [notifPrefs, setNotifPrefs] = useState({
    likes: true,
    comments: true,
    reposts: true,
    new_post: true,
    profile_pic: true,
    mention: true,
    milestone: true,
  });

  // ── Push preferences ──
  const [pushEnabled, setPushEnabled] = useState(true);
  const [pushPrefs, setPushPrefs] = useState({
    likes: true,
    comments: true,
    reposts: true,
    new_post: true,
    profile_pic: true,
    mention: true,
    milestone: true,
  });

  // ── Privacy preferences ──
  const [privPrefs, setPrivPrefs] = useState({
    account: true,
    activity: true,
  });

  // ── UI state ──
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // ── Load user data and whisper settings ──
  useEffect(() => {
    async function loadData() {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        // Load profile
        const response = await apiClient(`/api/users/${user.id}/profile`);
        const profile = response.data || {};

        const merged = { ...user, ...profile };

        setName(merged.name || '');
        setUsername(merged.username || '');
        setEmail(merged.email || '');
        setBio(merged.bio || '');
        setLocation(merged.location || '');
        setSchool(merged.school || '');
        setOccupation(merged.occupation || '');
        setWebsite(merged.website || '');
        setGender(merged.gender || '');
        if (merged.dateOfBirth) {
          setDateOfBirth(merged.dateOfBirth.split('T')[0]);
        }
        const phoneRaw = merged.phone || '';
        const parts = phoneRaw.split('|');
        if (parts.length === 2) {
          setDialCode(parts[0]);
          setPhone(parts[1]);
        } else {
          setPhone(phoneRaw);
        }

        const storedPrefs = localStorage.getItem('circle_notif_prefs');
        if (storedPrefs) {
          const parsed = JSON.parse(storedPrefs);
          setNotifPrefs((prev) => ({ ...prev, ...parsed }));
          setPushPrefs((prev) => ({ ...prev, ...parsed }));
          setPrivPrefs({
            account: parsed.account !== undefined ? parsed.account : true,
            activity: parsed.activity !== undefined ? parsed.activity : true,
          });
          if (parsed.pushEnabled !== undefined) {
            setPushEnabled(parsed.pushEnabled);
          }
        }

        // ── Load Whisper settings ──
        await fetchSettings();
      } catch (err) {
        console.error('Failed to load profile data:', err);
        setName(user.name || '');
        setUsername(user.username || '');
        setEmail(user.email || '');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user, router, fetchSettings]);

  // ── Show toast ──
  const showToast = (msg, type = 'success') => {
    setToast({ message: msg, type });
  };

  // ── Handle phone change ──
  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    setPhone(digits);
  };

  // ── Toggle whisper acceptance ──
  const handleToggleWhisper = async (enabled) => {
    try {
      await updateSettings(enabled);
      showToast(enabled ? 'Whisper enabled' : 'Whisper disabled');
    } catch {
      showToast('Failed to update whisper settings', 'error');
    }
  };

  // ── Regenerate Whisper link ──
  const handleRegenerateSlug = async () => {
    if (!confirm('This will generate a new link for your Whisper page. Your old link will stop working. Continue?')) return;
    try {
      await regenerateSlug();
      showToast('New Whisper link generated! 🔗', 'success');
    } catch {
      showToast('Failed to generate new link.', 'error');
    }
  };

  // ── Save profile ──
  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) {
      showToast('Name is required.', 'error');
      return;
    }
    if (!email.trim()) {
      showToast('Email is required.', 'error');
      return;
    }
    if (username && !/^[a-z0-9_]{3,25}$/.test(username)) {
      showToast('Username must be 3–25 letters, numbers, underscores.', 'error');
      return;
    }

    setSaving(true);

    try {
      const patch = { name: name.trim(), email: email.trim() };
      const current = user;

      if (bio !== (current.bio || '')) patch.bio = bio || null;
      if (location !== (current.location || '')) patch.location = location || null;
      if (school !== (current.school || '')) patch.school = school || null;
      if (occupation !== (current.occupation || '')) patch.occupation = occupation || null;
      if (website !== (current.website || '')) patch.website = website || null;
      if (gender !== (current.gender || '')) patch.gender = gender || null;

      const currentDob = current.dateOfBirth ? current.dateOfBirth.split('T')[0] : null;
      if (dateOfBirth !== currentDob) patch.dateOfBirth = dateOfBirth || null;

      const fullPhone = phone ? `${dialCode}|${phone}` : null;
      if (fullPhone !== (current.phone || null)) patch.phone = fullPhone;

      if (password) patch.password = password;

      let updatedUser = { ...current };
      if (Object.keys(patch).length > 0) {
        const res = await apiClient(`/api/users/${user.id}`, {
          method: 'PUT',
          body: patch,
        });
        updatedUser = { ...updatedUser, ...res.data };
      }

      if (username && username !== current.username) {
        await apiClient(`/api/users/${user.id}/username`, {
          method: 'PUT',
          body: { username },
        });
        updatedUser.username = username;
      }

      const prefs = { ...notifPrefs, ...privPrefs, pushEnabled, ...pushPrefs };
      localStorage.setItem('circle_notif_prefs', JSON.stringify(prefs));

      const finalUser = {
        ...updatedUser,
        picture: resolveMediaUrl(updatedUser.picture),
      };
      localStorage.setItem('circle_user', JSON.stringify(finalUser));
      login(finalUser);

      showToast('Profile updated successfully! ✅', 'success');

      try {
        await apiClient('/api/posts', {
          method: 'POST',
          body: { type: 'profile_update', text: bio || '' },
        });
      } catch (_) {}

      setTimeout(() => router.push('/profile'), 800);
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center text-[var(--color-txt2)]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        <p className="mt-4">Loading settings…</p>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <h1 className="text-2xl font-head font-bold text-[var(--color-txt)] mb-6">Settings</h1>

      {/* ── Profile Picture ── */}
      <div className="mb-8 flex items-center gap-4">
        <div
          className="h-20 w-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md overflow-hidden"
          style={{
            background: user?.picture ? 'transparent' : stringToColor(user?.name || ''),
          }}
        >
          {user?.picture ? (
            <img src={resolveMediaUrl(user.picture)} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            (user?.name?.charAt(0)?.toUpperCase() || '?')
          )}
        </div>
        <div>
          <p className="font-medium text-[var(--color-txt)]">{user?.name}</p>
          <p className="text-sm text-[var(--color-txt2)]">@{user?.username}</p>
          <p className="text-xs text-[var(--color-txt3)] mt-1">Profile picture can be changed on your profile page.</p>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Username */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="3–25 chars, letters/numbers/underscores"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none resize-y"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Location</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* School */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">School</label>
          <input
            type="text"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Occupation */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Occupation</label>
          <input
            type="text"
            value={occupation}
            onChange={(e) => setOccupation(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Website */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Website</label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Date of Birth</label>
          <input
            type="date"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
          />
        </div>

        {/* Gender */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Gender</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not">Prefer not to say</option>
          </select>
        </div>

        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Phone</label>
          <div className="flex gap-2">
            <select
              value={dialCode}
              onChange={(e) => setDialCode(e.target.value)}
              className="w-28 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-2 py-2 text-[var(--color-txt)] focus:border-[var(--color-accent)] focus:outline-none"
            >
              {DIAL_CODES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.code} ({item.country})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={phone}
              onChange={handlePhoneChange}
              className="flex-1 rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
              placeholder="Phone number (digits only)"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-[var(--color-txt2)] mb-1">Change Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[var(--radius-radius-sm)] border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-[var(--color-txt)] placeholder:text-[var(--color-txt3)] focus:border-[var(--color-accent)] focus:outline-none"
            placeholder="Leave blank to keep current"
          />
        </div>
      </div>

      {/* ── Whisper Settings ── */}
      <div className="mt-10 border-t border-[var(--color-border)] pt-6">
        <h2 className="text-lg font-head font-semibold text-[var(--color-txt)] mb-3">💬 Whisper</h2>

        <ToggleSwitch
          checked={settings.enabled || false}
          onChange={handleToggleWhisper}
          label="Accept anonymous messages"
          description="When enabled, others can send you anonymous whispers via your link."
        />

        <div className="mt-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold text-[var(--color-txt3)] uppercase tracking-wider">Your Whisper link</div>
            {settings.link_slug ? (
              <div className="text-sm font-mono text-[var(--color-accent)] break-all">
                {`${window.location.origin}/whisper/send/${settings.link_slug}`}
              </div>
            ) : (
              <div className="text-sm text-[var(--color-txt2)]">No link generated yet.</div>
            )}
          </div>
          <div className="flex gap-2">
            {settings.link_slug && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/whisper/send/${settings.link_slug}`);
                  showToast('Link copied! 🔗', 'success');
                }}
                className="px-4 py-2 bg-[var(--color-accent-bg)] text-[var(--color-accent)] rounded-full text-sm font-bold hover:bg-[var(--color-accent)]/20 transition"
              >
                Copy link
              </button>
            )}
            <button
              onClick={handleRegenerateSlug}
              className="flex items-center gap-1.5 px-4 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-txt2)] rounded-full text-sm font-bold hover:bg-[var(--color-accent-bg)] transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M23 4v6h-6" />
                <path d="M1 20v-6h6" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
              </svg>
              <span>New link</span>
            </button>
          </div>
        </div>
        <p className="text-xs text-[var(--color-txt3)] mt-2">Generate a new link to stop spam on your old link.</p>
      </div>

      {/* ── Notification Preferences ── */}
      <div className="mt-10">
        <h2 className="text-lg font-head font-semibold text-[var(--color-txt)] mb-3">Notification Preferences</h2>
        <div className="space-y-2">
          <ToggleSwitch
            checked={notifPrefs.likes}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, likes: val }))}
            label="Likes on my posts"
          />
          <ToggleSwitch
            checked={notifPrefs.comments}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, comments: val }))}
            label="Comments on my posts"
          />
          <ToggleSwitch
            checked={notifPrefs.reposts}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, reposts: val }))}
            label="Reposts of my posts"
          />
          <ToggleSwitch
            checked={notifPrefs.new_post}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, new_post: val }))}
            label="New posts from people I follow"
          />
          <ToggleSwitch
            checked={notifPrefs.profile_pic}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, profile_pic: val }))}
            label="Profile picture updates from friends"
          />
          <ToggleSwitch
            checked={notifPrefs.mention}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, mention: val }))}
            label="Mentions"
          />
          <ToggleSwitch
            checked={notifPrefs.milestone}
            onChange={(val) => setNotifPrefs((prev) => ({ ...prev, milestone: val }))}
            label="Milestones"
          />
        </div>
      </div>

      {/* ── Push Notifications (styled with ToggleSwitch) ── */}
      <div className="mt-8">
        <h2 className="text-lg font-head font-semibold text-[var(--color-txt)] mb-3">🔔 Push Notifications</h2>
        <div className="space-y-4">
          <ToggleSwitch
            checked={pushEnabled}
            onChange={setPushEnabled}
            label="Enable push notifications"
            description="Receive push notifications on your device"
          />

          {pushEnabled && (
            <div className="ml-6 border-l-2 border-[var(--color-border)] pl-4 space-y-2">
              <ToggleSwitch
                checked={pushPrefs.likes}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, likes: val }))}
                label="Likes"
              />
              <ToggleSwitch
                checked={pushPrefs.comments}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, comments: val }))}
                label="Comments"
              />
              <ToggleSwitch
                checked={pushPrefs.reposts}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, reposts: val }))}
                label="Reposts"
              />
              <ToggleSwitch
                checked={pushPrefs.new_post}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, new_post: val }))}
                label="New posts"
              />
              <ToggleSwitch
                checked={pushPrefs.profile_pic}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, profile_pic: val }))}
                label="Profile picture updates"
              />
              <ToggleSwitch
                checked={pushPrefs.mention}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, mention: val }))}
                label="Mentions"
              />
              <ToggleSwitch
                checked={pushPrefs.milestone}
                onChange={(val) => setPushPrefs((prev) => ({ ...prev, milestone: val }))}
                label="Milestones"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Privacy Preferences ── */}
      <div className="mt-8">
        <h2 className="text-lg font-head font-semibold text-[var(--color-txt)] mb-3">Privacy Preferences</h2>
        <div className="space-y-2">
          <ToggleSwitch
            checked={privPrefs.account}
            onChange={(val) => setPrivPrefs((prev) => ({ ...prev, account: val }))}
            label="Account visible to everyone"
          />
          <ToggleSwitch
            checked={privPrefs.activity}
            onChange={(val) => setPrivPrefs((prev) => ({ ...prev, activity: val }))}
            label="Show my activity status"
          />
        </div>
      </div>

      {/* ── Save Button ── */}
      <div className="mt-8 flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-[var(--color-accent)] text-white rounded-[var(--radius-radius-sm)] font-medium hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button
          onClick={() => router.push('/profile')}
          className="px-6 py-2 border border-[var(--color-border)] text-[var(--color-txt2)] rounded-[var(--radius-radius-sm)] hover:bg-[var(--color-accent-bg)] transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
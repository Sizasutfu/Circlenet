// src/app/admin/settings/page.jsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { apiClient } from '@/lib/api';
import AdminSidebar from '@/components/admin/AdminSidebar';

// ─── Icons ──────────────────────────────────────────────────────────────

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const BellIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

const GlobeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
  </svg>
);

const DatabaseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// ─── Components ─────────────────────────────────────────────────────────

function SettingsSection({ title, description, icon: Icon, children }) {
  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-[var(--color-accent-bg)] text-[var(--color-accent)]">
          <Icon />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-txt)]">{title}</h2>
          {description && <p className="text-sm text-[var(--color-txt2)]">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 border-b border-[var(--color-border)] last:border-0">
      <div>
        <div className="text-sm font-medium text-[var(--color-txt)]">{label}</div>
        {description && <div className="text-xs text-[var(--color-txt2)]">{description}</div>}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );
}

function ToggleSwitch({ enabled, onChange, disabled = false }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
        enabled ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-border)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);

  // ── Settings state ──
  const [settings, setSettings] = useState({
    siteName: 'Circle',
    siteDescription: 'A social platform for creators',
    maintenanceMode: false,
    registrationEnabled: true,
    emailVerificationRequired: true,
    maxPostLength: 500,
    maxImageSize: 5,
    maxVideoSize: 50,
    allowVideoUploads: true,
    allowImageUploads: true,
    defaultUserRole: 'user',
    enableNotifications: true,
    enablePushNotifications: true,
    enableEmailNotifications: true,
    adminEmail: '',
    supportEmail: '',
    analyticsEnabled: true,
    debugMode: false,
  });

  useEffect(() => {
    const adminToken = localStorage.getItem('circle_admin_token');
    if (!adminToken) {
      router.push('/admin/login');
      return;
    }
    if (user && user.role !== 'admin') {
      router.push('/');
    }
    // Load settings
    loadSettings();
  }, [user, router]);

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient('/api/admin/settings', { admin: true });
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (err) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setSuccess(null);
    setError(null);
    try {
      await apiClient('/api/admin/settings', {
        method: 'PUT',
        admin: true,
        body: settings,
      });
      setSuccess('Settings saved successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[var(--color-bg)]">
        <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 ml-0 md:ml-[260px] flex items-center justify-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-accent)] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-bg)]">
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ─── Main Content ─── */}
      <div className="flex-1 ml-0 md:ml-[260px]">
        {/* ─── Topbar ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden p-1.5 rounded-lg text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <MenuIcon />
            </button>
            <div>
              <span className="font-semibold text-[var(--color-txt)]">Settings</span>
              <span className="text-[var(--color-txt2)] ml-1">Configuration</span>
            </div>
          </div>
          <button
            onClick={loadSettings}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[var(--color-txt2)] hover:text-[var(--color-txt)] hover:bg-[var(--color-surface)] transition"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>

        {/* ─── Content ─── */}
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-head font-extrabold text-[var(--color-txt)]">Settings</h1>
              <p className="text-sm text-[var(--color-txt2)]">Configure your platform settings</p>
            </div>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-4 py-2 rounded-lg hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
            >
              <SaveIcon />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          {/* Messages */}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-500 rounded-xl p-4 mb-6 flex items-center gap-2">
              <CheckIcon />
              <span className="text-sm">{success}</span>
            </div>
          )}
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl p-4 mb-6">
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            {/* ─── General Settings ─── */}
            <SettingsSection title="General" description="Basic platform settings" icon={GlobeIcon}>
              <SettingRow label="Site Name" description="The name of your platform">
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => handleChange('siteName', e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none w-full sm:w-64"
                />
              </SettingRow>
              <SettingRow label="Site Description" description="A short description of your platform">
                <input
                  type="text"
                  value={settings.siteDescription}
                  onChange={(e) => handleChange('siteDescription', e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none w-full sm:w-64"
                />
              </SettingRow>
              <SettingRow label="Maintenance Mode" description="Put the site in maintenance mode">
                <ToggleSwitch
                  enabled={settings.maintenanceMode}
                  onChange={(val) => handleChange('maintenanceMode', val)}
                />
              </SettingRow>
              <SettingRow label="Registration Enabled" description="Allow new users to register">
                <ToggleSwitch
                  enabled={settings.registrationEnabled}
                  onChange={(val) => handleChange('registrationEnabled', val)}
                />
              </SettingRow>
              <SettingRow label="Email Verification" description="Require email verification for new users">
                <ToggleSwitch
                  enabled={settings.emailVerificationRequired}
                  onChange={(val) => handleChange('emailVerificationRequired', val)}
                />
              </SettingRow>
            </SettingsSection>

            {/* ─── Content Settings ─── */}
            <SettingsSection title="Content" description="Content and media settings" icon={DatabaseIcon}>
              <SettingRow label="Max Post Length" description="Maximum characters per post">
                <select
                  value={settings.maxPostLength}
                  onChange={(e) => handleChange('maxPostLength', parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
                >
                  <option value="280">280</option>
                  <option value="500">500</option>
                  <option value="1000">1,000</option>
                  <option value="2000">2,000</option>
                  <option value="5000">5,000</option>
                </select>
              </SettingRow>
              <SettingRow label="Max Image Size (MB)" description="Maximum file size for image uploads">
                <select
                  value={settings.maxImageSize}
                  onChange={(e) => handleChange('maxImageSize', parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
                >
                  <option value="2">2 MB</option>
                  <option value="5">5 MB</option>
                  <option value="10">10 MB</option>
                  <option value="20">20 MB</option>
                </select>
              </SettingRow>
              <SettingRow label="Max Video Size (MB)" description="Maximum file size for video uploads">
                <select
                  value={settings.maxVideoSize}
                  onChange={(e) => handleChange('maxVideoSize', parseInt(e.target.value))}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
                >
                  <option value="10">10 MB</option>
                  <option value="50">50 MB</option>
                  <option value="100">100 MB</option>
                  <option value="200">200 MB</option>
                  <option value="500">500 MB</option>
                </select>
              </SettingRow>
              <SettingRow label="Allow Image Uploads" description="Enable image uploads">
                <ToggleSwitch
                  enabled={settings.allowImageUploads}
                  onChange={(val) => handleChange('allowImageUploads', val)}
                />
              </SettingRow>
              <SettingRow label="Allow Video Uploads" description="Enable video uploads">
                <ToggleSwitch
                  enabled={settings.allowVideoUploads}
                  onChange={(val) => handleChange('allowVideoUploads', val)}
                />
              </SettingRow>
            </SettingsSection>

            {/* ─── User Settings ─── */}
            <SettingsSection title="Users" description="User management settings" icon={UserIcon}>
              <SettingRow label="Default User Role" description="Role assigned to new users">
                <select
                  value={settings.defaultUserRole}
                  onChange={(e) => handleChange('defaultUserRole', e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none"
                >
                  <option value="user">User</option>
                  <option value="moderator">Moderator</option>
                </select>
              </SettingRow>
            </SettingsSection>

            {/* ─── Notification Settings ─── */}
            <SettingsSection title="Notifications" description="Notification preferences" icon={BellIcon}>
              <SettingRow label="Enable Notifications" description="Turn on/off all notifications">
                <ToggleSwitch
                  enabled={settings.enableNotifications}
                  onChange={(val) => handleChange('enableNotifications', val)}
                />
              </SettingRow>
              <SettingRow label="Push Notifications" description="Send push notifications to users">
                <ToggleSwitch
                  enabled={settings.enablePushNotifications}
                  onChange={(val) => handleChange('enablePushNotifications', val)}
                />
              </SettingRow>
              <SettingRow label="Email Notifications" description="Send email notifications to users">
                <ToggleSwitch
                  enabled={settings.enableEmailNotifications}
                  onChange={(val) => handleChange('enableEmailNotifications', val)}
                />
              </SettingRow>
            </SettingsSection>

            {/* ─── Email Settings ─── */}
            <SettingsSection title="Email" description="Email configuration" icon={ShieldIcon}>
              <SettingRow label="Admin Email" description="Email address for admin notifications">
                <input
                  type="email"
                  value={settings.adminEmail}
                  onChange={(e) => handleChange('adminEmail', e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none w-full sm:w-64"
                  placeholder="admin@example.com"
                />
              </SettingRow>
              <SettingRow label="Support Email" description="Email address for support requests">
                <input
                  type="email"
                  value={settings.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="px-3 py-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-txt)] focus:border-[var(--color-accent)] outline-none w-full sm:w-64"
                  placeholder="support@example.com"
                />
              </SettingRow>
            </SettingsSection>

            {/* ─── Advanced Settings ─── */}
            <SettingsSection title="Advanced" description="Advanced configuration" icon={DatabaseIcon}>
              <SettingRow label="Analytics" description="Enable analytics tracking">
                <ToggleSwitch
                  enabled={settings.analyticsEnabled}
                  onChange={(val) => handleChange('analyticsEnabled', val)}
                />
              </SettingRow>
              <SettingRow label="Debug Mode" description="Show debug information">
                <ToggleSwitch
                  enabled={settings.debugMode}
                  onChange={(val) => handleChange('debugMode', val)}
                />
              </SettingRow>
            </SettingsSection>
          </div>

          {/* Save Button (Bottom) */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="flex items-center gap-2 bg-[var(--color-accent)] text-white px-6 py-2.5 rounded-lg hover:bg-[var(--color-accent-h)] transition disabled:opacity-50"
            >
              <SaveIcon />
              {saving ? 'Saving...' : 'Save All Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
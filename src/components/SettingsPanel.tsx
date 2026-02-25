import React, { useState, useEffect, useRef } from 'react';
import { NexusProfile, LayoutType, NexusLayouts, WidgetId, ThemeMode } from '../types';
import { getNexusProfile, setNexusProfile, getNexusLayouts, setStorage } from '../utils/storage';
import { APP } from '../utils/common';
import AIAssistantTab from './settings/AIAssistantTab';
import { WIDGET_ICONS, TAB_ICONS, THEME_ICONS, IconClose, IconCheck } from '../icons';

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeLayout: LayoutType;
}

const WIDGET_GROUPS: { label: string; items: { id: WidgetId; name: string; desc: string }[] }[] = [
  { label: 'Core', items: [
    { id: 'clock', name: 'Clock & Greeting', desc: 'Time, date, personalized message' },
    { id: 'search', name: 'Search Bar', desc: 'Web search and URL navigation' },
    { id: 'tasks', name: 'Tasks', desc: 'Task manager with list & board views' },
    { id: 'quicklinks', name: 'Quick Links', desc: 'Favorite links with favicons' },
  ]},
  { label: 'Productivity', items: [
    { id: 'bookmarks', name: 'Bookmarks', desc: 'Browse Chrome bookmarks' },
    { id: 'notes', name: 'Notes', desc: 'Quick scratchpad' },
    { id: 'pomodoro', name: 'Pomodoro Timer', desc: 'Focus timer with work/break' },
    { id: 'rss', name: 'RSS Feeds', desc: 'Auto-refresh article reader' },
  ]},
  { label: 'Integrations', items: [
    { id: 'weather', name: 'Weather', desc: 'Current weather via OpenWeather' },
    { id: 'gitlab', name: 'GitLab Activity', desc: 'Issues, events, projects' },
    { id: 'github', name: 'GitHub Activity', desc: 'PRs, issues, contributions' },
    { id: 'embed', name: 'Custom Embed', desc: 'Embed any URL in an iframe' },
    { id: 'shortcuts', name: 'Shortcuts', desc: 'Keyboard launcher' },
  ]},
];

const ACCENT_PRESETS = [
  { color: '#3B82F6', name: 'Blue' }, { color: '#8B5CF6', name: 'Violet' }, { color: '#EC4899', name: 'Pink' },
  { color: '#10B981', name: 'Emerald' }, { color: '#F59E0B', name: 'Amber' }, { color: '#EF4444', name: 'Red' },
  { color: '#06B6D4', name: 'Cyan' }, { color: '#F97316', name: 'Orange' },
];

const LAYOUT_LABELS: Record<LayoutType, { name: string; desc: string }> = {
  focus: { name: 'Focus', desc: 'Minimal — clock, search, essentials' },
  dashboard: { name: 'Dashboard', desc: 'Full bento grid — everything visible' },
  workflow: { name: 'Workflow', desc: 'Split view — tasks + side stack' },
};

type SettingsTab = 'general' | 'widgets' | 'ai';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'widgets', label: 'Widgets' },
  { id: 'ai', label: 'AI Assistant' },
];

// ── Unsplash ──────────────────────────────────────────────────────────────────
interface UnsplashPhoto {
  id: string;
  thumb: string;
  full: string;
  label: string;
}

const uImg = (photoId: string, w: number) =>
  `https://images.unsplash.com/${photoId}?w=${w}&q=80&auto=format&fit=crop`;

const CURATED_PHOTOS: UnsplashPhoto[] = [
  { id: 'photo-1469474968028-56623f02e42e', label: 'Meadow'     },
  { id: 'photo-1506905925346-21bda4d32df4', label: 'Mountains'  },
  { id: 'photo-1519681393784-d120267933ba', label: 'Starry Sky' },
  { id: 'photo-1477959858617-67f85cf4f1df', label: 'City Night' },
  { id: 'photo-1448375240586-882707db888b', label: 'Forest'     },
  { id: 'photo-1531366936337-7c912a4589a7', label: 'Aurora'     },
  { id: 'photo-1505118380757-91f5f5632de0', label: 'Ocean'      },
  { id: 'photo-1464822759023-fed622ff2c3b', label: 'Lake'       },
  { id: 'photo-1500534314209-a25ddb2bd429', label: 'Sunset'     },
  { id: 'photo-1493246507139-91e8fad9978e', label: 'Valley'     },
].map(p => ({ ...p, thumb: uImg(p.id, 400), full: uImg(p.id, 1920) }));

const REPO_URL = 'https://github.com/encoreshao/nexus-tab';

// ── Component ─────────────────────────────────────────────────────────────────
const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose, activeLayout }) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [profile, setProfile] = useState<NexusProfile>({
    username: '', greeting: '', backgroundUrl: '', accentColor: '#3B82F6', theme: 'system',
  });
  const [layouts, setLayouts] = useState<NexusLayouts | null>(null);

  // Unsplash state
  const [unsplashQuery, setUnsplashQuery]       = useState('');
  const [unsplashResults, setUnsplashResults]   = useState<UnsplashPhoto[]>(CURATED_PHOTOS);
  const [unsplashLoading, setUnsplashLoading]   = useState(false);
  const [unsplashError, setUnsplashError]       = useState('');
  const [unsplashKey, setUnsplashKey]           = useState(() => localStorage.getItem('nexus.unsplashKey') || '');
  const [showKeyField, setShowKeyField]         = useState(false);
  const [previewPhoto, setPreviewPhoto]         = useState<UnsplashPhoto | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      getNexusProfile(setProfile);
      getNexusLayouts(setLayouts);
    }
  }, [isOpen]);

  const handleProfileChange = (field: keyof NexusProfile, value: string) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    setNexusProfile(updated);
    if (field === 'accentColor') document.documentElement.style.setProperty('--accent-color', value);
    if (field === 'theme') {
      const resolved = value === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : value;
      document.documentElement.setAttribute('data-theme', resolved);
    }
  };

  const handleToggleWidget = (widgetId: WidgetId) => {
    if (!layouts) return;
    const currentConfig = layouts[activeLayout];
    const updated = currentConfig.widgets.includes(widgetId)
      ? currentConfig.widgets.filter(id => id !== widgetId)
      : [...currentConfig.widgets, widgetId];
    const newLayouts = { ...layouts, [activeLayout]: { ...currentConfig, widgets: updated } };
    setLayouts(newLayouts);
    setStorage({ 'nexus.layouts': newLayouts });
  };

  const saveUnsplashKey = (key: string) => {
    setUnsplashKey(key);
    localStorage.setItem('nexus.unsplashKey', key);
  };

  const searchUnsplash = async () => {
    const q = unsplashQuery.trim();
    if (!q) { setUnsplashResults(CURATED_PHOTOS); setUnsplashError(''); return; }
    if (!unsplashKey) {
      setUnsplashError('Add an Unsplash Access Key below to search.');
      return;
    }
    setUnsplashLoading(true);
    setUnsplashError('');
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=10&orientation=landscape&client_id=${unsplashKey}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const photos: UnsplashPhoto[] = data.results.map((p: { id: string; urls: { small: string; regular: string }; alt_description: string }) => ({
        id: p.id,
        thumb: p.urls.small,
        full: p.urls.regular,
        label: p.alt_description || q,
      }));
      setUnsplashResults(photos.length ? photos : CURATED_PHOTOS);
      if (!photos.length) setUnsplashError('No results — showing curated photos.');
    } catch {
      setUnsplashError('Search failed. Please check your API key.');
      setUnsplashResults(CURATED_PHOTOS);
    } finally {
      setUnsplashLoading(false);
    }
  };

  const applyPhoto = (photo: UnsplashPhoto) => {
    handleProfileChange('backgroundUrl', photo.full);
    setPreviewPhoto(photo);
  };

  if (!isOpen) return null;

  const enabledCount = layouts ? layouts[activeLayout].widgets.length : 0;

  return (
    <>
      <div
        className="fixed inset-0 backdrop-blur-sm z-40 animate-fade-in"
        style={{ backgroundColor: 'var(--backdrop-overlay)' }}
        onClick={onClose}
      />
      {/* Panel — 10% narrower than original 720px */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[648px] z-50 animate-slide-in">
        <div className="h-full backdrop-blur-2xl shadow-2xl flex flex-col" style={{ backgroundColor: 'var(--panel-bg)', borderLeft: '1px solid var(--panel-border)' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
            <div>
              <h2 className="text-lg font-semibold t-primary">Settings</h2>
              <p className="text-xs t-muted mt-0.5">Personalize your {APP.shortName}</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl t-muted hover:t-primary transition-colors cursor-pointer">
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-6 pt-4 shrink-0" style={{ borderBottom: '1px solid var(--panel-border)' }}>
            {TABS.map(({ id, label }) => {
              const TabIcon = TAB_ICONS[id];
              return (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all cursor-pointer ${
                    activeTab === id ? 't-primary' : 't-muted hover:t-tertiary'
                  }`}
                  style={activeTab === id ? { backgroundColor: 'var(--glass-bg)', borderBottom: '2px solid var(--accent-color)' } : {}}
                >
                  {TabIcon && <TabIcon className="w-4 h-4" />}
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {activeTab === 'general' && (
              <div className="space-y-8">

                {/* Profile */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider t-faint mb-4">Profile</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs t-tertiary mb-1">Name</label>
                      <input
                        type="text"
                        value={profile.username}
                        onChange={e => handleProfileChange('username', e.target.value)}
                        placeholder="Your name"
                        className="glass-input text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-xs t-tertiary mb-1">Custom Greeting</label>
                      <input
                        type="text"
                        value={profile.greeting}
                        onChange={e => handleProfileChange('greeting', e.target.value)}
                        placeholder="e.g. Ready to build something great?"
                        className="glass-input text-sm w-full"
                      />
                    </div>
                  </div>
                </section>

                {/* Appearance */}
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider t-faint mb-4">Appearance</h3>
                  <div className="space-y-6">

                    {/* Theme */}
                    <div>
                      <label className="block text-xs t-tertiary mb-2">Theme</label>
                      <div className="flex gap-2 p-1.5 rounded-xl" style={{ backgroundColor: 'var(--glass-bg)' }}>
                        {THEME_OPTIONS.map(({ value, label }) => {
                          const active = (profile.theme || 'system') === value;
                          const ThemeIcon = THEME_ICONS[value];
                          return (
                            <button
                              key={value}
                              onClick={() => handleProfileChange('theme', value)}
                              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${active ? 't-primary' : 't-muted'}`}
                              style={active ? { backgroundColor: 'var(--glass-bg-hover)', boxShadow: '0 1px 3px var(--shadow-color)' } : {}}
                            >
                              {ThemeIcon && <ThemeIcon className="w-4 h-4" />}
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Background Image */}
                    <div>
                      <label className="block text-xs t-tertiary mb-3">Background Image</label>

                      {/* Unsplash search bar */}
                      <div className="flex gap-2 mb-3">
                        <input
                          ref={searchInputRef}
                          type="text"
                          value={unsplashQuery}
                          onChange={e => setUnsplashQuery(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && searchUnsplash()}
                          placeholder="Search Unsplash photos…"
                          className="glass-input text-sm flex-1"
                        />
                        <button
                          onClick={searchUnsplash}
                          disabled={unsplashLoading}
                          className="px-3 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 disabled:opacity-50"
                          style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                          title="Search Unsplash"
                        >
                          {unsplashLoading ? (
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          )}
                        </button>
                      </div>

                      {/* Error / hint */}
                      {unsplashError && (
                        <p className="text-[11px] t-ghost mb-2">{unsplashError}</p>
                      )}

                      {/* Photo grid */}
                      <div className="grid grid-cols-5 gap-1.5 mb-3">
                        {unsplashResults.map(photo => {
                          const isActive = profile.backgroundUrl === photo.full;
                          return (
                            <button
                              key={photo.id}
                              onClick={() => applyPhoto(photo)}
                              onMouseEnter={() => setPreviewPhoto(photo)}
                              onMouseLeave={() => setPreviewPhoto(null)}
                              className="relative aspect-video rounded-lg overflow-hidden cursor-pointer transition-all duration-150 hover:scale-105 hover:z-10 focus:outline-none"
                              style={{
                                border: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                                boxShadow: isActive ? `0 0 0 2px var(--accent-color)40` : 'none',
                              }}
                              title={photo.label}
                            >
                              <img
                                src={photo.thumb}
                                alt={photo.label}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              {isActive && (
                                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}>
                                  <IconCheck className="w-4 h-4 text-white" strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Hover preview strip */}
                      {previewPhoto && previewPhoto.full !== profile.backgroundUrl && (
                        <div className="mb-3 rounded-xl overflow-hidden h-24 relative animate-fade-in">
                          <img src={previewPhoto.thumb} alt={previewPhoto.label} className="w-full h-full object-cover opacity-80" />
                          <div className="absolute bottom-1.5 left-2">
                            <span className="text-[10px] text-white/80 font-medium drop-shadow">{previewPhoto.label}</span>
                          </div>
                        </div>
                      )}

                      {/* API key field (collapsible) */}
                      <div className="mb-3">
                        <button
                          onClick={() => setShowKeyField(v => !v)}
                          className="flex items-center gap-1.5 text-[11px] t-ghost hover:t-muted transition-colors cursor-pointer"
                        >
                          <svg className={`w-3 h-3 transition-transform ${showKeyField ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          Unsplash API key {unsplashKey ? '(configured)' : '(optional — enables search)'}
                        </button>
                        {showKeyField && (
                          <div className="mt-2 flex gap-2 animate-fade-in">
                            <input
                              type="password"
                              value={unsplashKey}
                              onChange={e => saveUnsplashKey(e.target.value)}
                              placeholder="Your Unsplash Access Key"
                              className="glass-input text-xs flex-1 font-mono"
                            />
                            <a
                              href="https://unsplash.com/developers"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 flex items-center px-2.5 text-[11px] rounded-lg transition-colors t-muted hover:t-secondary cursor-pointer"
                              style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
                              title="Get a free Unsplash API key"
                            >
                              Get key
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Manual URL input */}
                      <div>
                        <label className="block text-[11px] t-ghost mb-1.5">Or paste an image URL</label>
                        <input
                          type="text"
                          value={profile.backgroundUrl}
                          onChange={e => { handleProfileChange('backgroundUrl', e.target.value); setPreviewPhoto(null); }}
                          placeholder="https://images.unsplash.com/…"
                          className="glass-input text-sm w-full"
                        />
                        {profile.backgroundUrl && (
                          <div className="mt-2 rounded-xl overflow-hidden h-20 relative">
                            <img
                              src={profile.backgroundUrl}
                              alt="Preview"
                              className="w-full h-full object-cover opacity-60"
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                            <button
                              onClick={() => { handleProfileChange('backgroundUrl', ''); setPreviewPhoto(null); }}
                              className="absolute top-2 right-2 p-1.5 rounded-lg cursor-pointer"
                              style={{ backgroundColor: 'var(--glass-bg)' }}
                              title="Remove background"
                            >
                              <IconClose className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Accent color */}
                    <div>
                      <label className="block text-xs t-tertiary mb-2">Accent Color</label>
                      <div className="grid grid-cols-12 gap-2 mb-2">
                        {ACCENT_PRESETS.map(({ color, name }) => (
                          <button
                            key={color}
                            onClick={() => handleProfileChange('accentColor', color)}
                            className="group relative w-full aspect-square rounded-xl border-2 transition-all duration-200 cursor-pointer hover:scale-110"
                            style={{ backgroundColor: color, borderColor: profile.accentColor === color ? 'white' : 'transparent', boxShadow: profile.accentColor === color ? `0 0 12px ${color}40` : 'none' }}
                            title={name}
                          >
                            {profile.accentColor === color && (
                              <IconCheck className="w-4 h-4 t-primary absolute inset-0 m-auto" strokeWidth={3} />
                            )}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={profile.accentColor} onChange={e => handleProfileChange('accentColor', e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer bg-transparent border-0 p-0" />
                        <input type="text" value={profile.accentColor} onChange={e => handleProfileChange('accentColor', e.target.value)} className="glass-input text-xs flex-1 font-mono" maxLength={7} />
                      </div>
                    </div>

                  </div>
                </section>

              </div>
            )}

            {activeTab === 'widgets' && (
              <div>
                <div className="flex items-baseline justify-between mb-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider t-faint">Widgets</h3>
                  <span className="text-xs t-faint">{enabledCount} enabled for <span className="capitalize t-muted">{LAYOUT_LABELS[activeLayout].name}</span></span>
                </div>
                <p className="text-sm t-muted mb-4">{LAYOUT_LABELS[activeLayout].desc}</p>
                <div className="space-y-5">
                  {WIDGET_GROUPS.map(group => (
                    <div key={group.label}>
                      <p className="text-[11px] font-medium t-ghost uppercase tracking-wider mb-2">{group.label}</p>
                      <div className="space-y-1.5">
                        {group.items.map(({ id, name, desc }) => {
                          const enabled = layouts ? layouts[activeLayout].widgets.includes(id) : false;
                          const WidgetIcon = WIDGET_ICONS[id];
                          return (
                            <button
                              key={id}
                              onClick={() => handleToggleWidget(id)}
                              className="w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer text-left"
                              style={{ backgroundColor: enabled ? 'var(--glass-bg)' : 'transparent' }}
                            >
                              {WidgetIcon && (
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: enabled ? `${profile.accentColor}20` : 'var(--glass-bg)' }}>
                                  <WidgetIcon className="w-4 h-4" style={enabled ? { color: profile.accentColor } : {}} />
                                </div>
                              )}
                              <div className={`w-10 h-6 rounded-full transition-all flex items-center shrink-0 ${enabled ? 'justify-end' : 'justify-start'}`} style={{ backgroundColor: enabled ? `${profile.accentColor}40` : 'var(--glass-bg)' }}>
                                <div className="w-4 h-4 rounded-full mx-[3px]" style={{ backgroundColor: enabled ? 'var(--text-primary)' : 'var(--text-ghost)', boxShadow: enabled ? `0 0 6px ${profile.accentColor}60` : 'none' }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className={`text-sm font-medium ${enabled ? 't-secondary' : 't-muted'}`}>{name}</p>
                                <p className="text-xs t-ghost truncate">{desc}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ai' && <AIAssistantTab />}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 shrink-0 flex items-center justify-between gap-4" style={{ borderTop: '1px solid var(--divider)' }}>
            <p className="text-[11px] t-ghost">
              {APP.shortName}{' '}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="t-muted hover:t-secondary transition-colors cursor-pointer"
                title="View source on GitHub"
              >
                v{APP.version}
              </a>
              {' · '}{APP.authorName}
            </p>
            <div className="flex items-center gap-3">
              <a
                href={APP.homepageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] t-ghost hover:t-muted transition-colors cursor-pointer"
                title="Visit homepage"
              >
                Website
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] t-ghost hover:t-muted transition-colors cursor-pointer flex items-center gap-1"
                title="View source on GitHub"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
                GitHub
              </a>
            </div>
          </div>

        </div>
      </div>
    </>
  );
};

export default SettingsPanel;

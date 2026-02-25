import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { LayoutType, NexusLayouts, NexusProfile, WidgetId, WidgetSettings } from './types';
import {
  migrateFromQuoteMaster,
  getNexusProfile,
  getActiveLayout,
  setActiveLayout,
  getNexusLayouts,
  setStorage,
  DEFAULT_PROFILE,
  DEFAULT_LAYOUT,
  DEFAULT_LAYOUTS,
} from './utils/storage';
import { useKeyboardShortcuts, useAIChatShortcut, ShortcutAction, SHORTCUT_MAP } from './hooks/useKeyboardShortcuts';
import { getAIConfig } from './utils/storage';

import FocusLayout from './components/layouts/FocusLayout';
import DashboardLayout from './components/layouts/DashboardLayout';
import WorkflowLayout from './components/layouts/WorkflowLayout';
import LayoutSwitcher from './components/LayoutSwitcher';
import SettingsPanel from './components/SettingsPanel';
import AddWidgetPanel from './components/AddWidgetPanel';
import ShortcutsHelp from './components/ShortcutsHelp';
import AIChatPopup from './components/AIChatPopup';
import { IconSettings, IconPlus, IconShortcuts, IconAi, IconGrid } from './icons';

// Widgets
import ClockWidget from './components/widgets/ClockWidget';
import SearchWidget from './components/widgets/SearchWidget';
import QuickLinksWidget from './components/widgets/QuickLinksWidget';
import TasksWidget from './components/widgets/TasksWidget';
import NotesWidget from './components/widgets/NotesWidget';
import BookmarksWidget from './components/widgets/BookmarksWidget';
import PomodoroWidget from './components/widgets/PomodoroWidget';
import WeatherWidget from './components/widgets/WeatherWidget';
import RSSWidget from './components/widgets/RSSWidget';
import PlaceholderWidget from './components/widgets/PlaceholderWidget';

function App() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<NexusProfile>(DEFAULT_PROFILE);
  const [activeLayoutId, setActiveLayoutId] = useState<LayoutType>(DEFAULT_LAYOUT);
  const [layouts, setLayouts] = useState<NexusLayouts>(DEFAULT_LAYOUTS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const [aiChatOpen, setAIChatOpen] = useState(false);
  const [aiChatShortcut, setAIChatShortcut] = useState<'ctrl+space' | 'alt+space' | 'meta+space'>('alt+space');
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const navMenuRef = useRef<HTMLDivElement>(null);

  // Initialize: migrate then load
  useEffect(() => {
    migrateFromQuoteMaster(() => {
      getNexusProfile(setProfile);
      getActiveLayout(setActiveLayoutId);
      getNexusLayouts(setLayouts);
      setReady(true);
    });
  }, []);

  // Apply accent color
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', profile.accentColor);
  }, [profile.accentColor]);

  // Apply theme (dark / light / system auto-detect)
  useEffect(() => {
    const applyTheme = (resolved: 'dark' | 'light') => {
      document.documentElement.setAttribute('data-theme', resolved);
    };

    if (profile.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mq.matches ? 'dark' : 'light');
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    } else {
      applyTheme(profile.theme || 'dark');
    }
  }, [profile.theme]);

  // Reload profile/layouts when settings close
  useEffect(() => {
    if (!settingsOpen && ready) {
      getNexusProfile(setProfile);
      getNexusLayouts(setLayouts);
    }
  }, [settingsOpen, ready]);

  // Load AI config for shortcut
  useEffect(() => {
    if (ready) getAIConfig(c => setAIChatShortcut(c.chatShortcut));
  }, [ready, settingsOpen]);

  // Refresh active layout when AI performs layout_change
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.widget === 'layout') {
        getActiveLayout(setActiveLayoutId);
      }
    };
    window.addEventListener('nexus-widget-refresh', handler);
    return () => window.removeEventListener('nexus-widget-refresh', handler);
  }, []);

  const handleLayoutChange = useCallback((layout: LayoutType) => {
    setActiveLayoutId(layout);
    setActiveLayout(layout);
  }, []);

  // Persist widget reorder
  const handleReorder = useCallback((newWidgets: WidgetId[]) => {
    setLayouts(prev => {
      const currentConfig = prev[activeLayoutId];
      const updated = { ...prev, [activeLayoutId]: { ...currentConfig, widgets: newWidgets } };
      setStorage({ 'nexus.layouts': updated });
      return updated;
    });
  }, [activeLayoutId]);

  // Add a widget to the current layout
  const handleAddWidget = useCallback((widgetId: WidgetId) => {
    setLayouts(prev => {
      const currentConfig = prev[activeLayoutId];
      if (currentConfig.widgets.includes(widgetId)) return prev;
      const updated = { ...prev, [activeLayoutId]: { ...currentConfig, widgets: [...currentConfig.widgets, widgetId] } };
      setStorage({ 'nexus.layouts': updated });
      return updated;
    });
  }, [activeLayoutId]);

  // Remove a widget from the current layout
  const handleRemoveWidget = useCallback((widgetId: WidgetId) => {
    setLayouts(prev => {
      const currentConfig = prev[activeLayoutId];
      const newWidgets = currentConfig.widgets.filter(id => id !== widgetId);
      const newSettings = { ...currentConfig.widgetSettings };
      delete newSettings[widgetId];
      const updated = { ...prev, [activeLayoutId]: { ...currentConfig, widgets: newWidgets, widgetSettings: newSettings } };
      setStorage({ 'nexus.layouts': updated });
      return updated;
    });
  }, [activeLayoutId]);

  // Update widget size/style settings for the current layout
  const handleWidgetSettingsChange = useCallback((widgetId: WidgetId, settings: WidgetSettings) => {
    setLayouts(prev => {
      const currentConfig = prev[activeLayoutId];
      const newSettings = { ...currentConfig.widgetSettings, [widgetId]: settings };
      const updated = { ...prev, [activeLayoutId]: { ...currentConfig, widgetSettings: newSettings } };
      setStorage({ 'nexus.layouts': updated });
      return updated;
    });
  }, [activeLayoutId]);

  // ── Keyboard shortcuts ──
  const shortcuts: ShortcutAction[] = useMemo(() => [
    {
      key: SHORTCUT_MAP.ESCAPE,
      label: 'Esc',
      description: 'Close panel / blur input',
      global: true,
      action: () => {
        if (shortcutsHelpOpen) { setShortcutsHelpOpen(false); return; }
        if (settingsOpen) { setSettingsOpen(false); return; }
        if (addWidgetOpen) { setAddWidgetOpen(false); return; }
        if (aiChatOpen) { setAIChatOpen(false); return; }
        // Blur any focused input
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
    },
    {
      key: SHORTCUT_MAP.SETTINGS,
      label: ',',
      description: 'Open Settings',
      action: () => { setAddWidgetOpen(false); setShortcutsHelpOpen(false); setSettingsOpen(prev => !prev); },
    },
    {
      key: SHORTCUT_MAP.ADD_WIDGET,
      label: 'A',
      description: 'Add Widget',
      action: () => { setSettingsOpen(false); setShortcutsHelpOpen(false); setAddWidgetOpen(prev => !prev); },
    },
    {
      key: SHORTCUT_MAP.SEARCH,
      label: '/',
      description: 'Focus search bar',
      action: () => {
        setSettingsOpen(false); setAddWidgetOpen(false); setShortcutsHelpOpen(false);
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]');
        searchInput?.focus();
      },
    },
    {
      key: SHORTCUT_MAP.HELP,
      label: '?',
      description: 'Keyboard shortcuts',
      action: () => { setSettingsOpen(false); setAddWidgetOpen(false); setShortcutsHelpOpen(prev => !prev); },
    },
    {
      key: SHORTCUT_MAP.LAYOUT_FOCUS,
      label: '1',
      description: 'Focus layout',
      action: () => handleLayoutChange('focus'),
    },
    {
      key: SHORTCUT_MAP.LAYOUT_DASHBOARD,
      label: '2',
      description: 'Dashboard layout',
      action: () => handleLayoutChange('dashboard'),
    },
    {
      key: SHORTCUT_MAP.LAYOUT_WORKFLOW,
      label: '3',
      description: 'Workflow layout',
      action: () => handleLayoutChange('workflow'),
    },
  ], [settingsOpen, addWidgetOpen, shortcutsHelpOpen, aiChatOpen, handleLayoutChange]);

  useKeyboardShortcuts(shortcuts);
  useAIChatShortcut(aiChatShortcut, () => setAIChatOpen(prev => !prev), true);

  // Close nav menu on outside click
  useEffect(() => {
    if (!navMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (navMenuRef.current && !navMenuRef.current.contains(e.target as Node)) {
        setNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [navMenuOpen]);

  // Widget renderer
  const renderWidget = useCallback((id: WidgetId): React.ReactNode => {
    switch (id) {
      case 'clock':
        return <ClockWidget key={id} username={profile.username} greeting={profile.greeting} />;
      case 'search':
        return <SearchWidget key={id} />;
      case 'quicklinks':
        return <QuickLinksWidget key={id} />;
      case 'tasks':
        return <TasksWidget key={id} />;
      case 'notes':
        return <NotesWidget key={id} />;
      case 'bookmarks':
        return <BookmarksWidget key={id} />;
      case 'pomodoro':
        return <PomodoroWidget key={id} />;
      case 'weather':
        return <WeatherWidget key={id} />;
      case 'rss':
        return <RSSWidget key={id} />;
      case 'gitlab':
        return <PlaceholderWidget key={id} name="GitLab Activity" icon="gitlab" />;
      case 'github':
        return <PlaceholderWidget key={id} name="GitHub Activity" icon="github" />;
      case 'embed':
        return <PlaceholderWidget key={id} name="Custom Embed" icon="embed" />;
      case 'shortcuts':
        return <PlaceholderWidget key={id} name="Keyboard Shortcuts" icon="shortcuts" />;
      default:
        return null;
    }
  }, [profile.username, profile.greeting]);

  const currentLayout = layouts[activeLayoutId] || { widgets: [], widgetSettings: {} };
  const currentWidgets = currentLayout.widgets;
  const currentWidgetSettings = currentLayout.widgetSettings || {};

  // Layout renderer
  const renderLayout = () => {
    const props = {
      widgets: currentWidgets,
      renderWidget,
      onReorder: handleReorder,
      onRemove: handleRemoveWidget,
      onWidgetSettingsChange: handleWidgetSettingsChange,
      widgetSettings: currentWidgetSettings,
    };
    switch (activeLayoutId) {
      case 'focus':
        return <FocusLayout {...props} />;
      case 'workflow':
        return <WorkflowLayout {...props} />;
      case 'dashboard':
      default:
        return <DashboardLayout {...props} />;
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--loading-bg)' }}>
        <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--text-ghost)', borderTopColor: 'var(--text-secondary)' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen relative"
      style={{
        background: profile.backgroundUrl
          ? `linear-gradient(var(--bg-overlay-from), var(--bg-overlay-to)), url("${profile.backgroundUrl}") center/cover fixed no-repeat`
          : 'var(--bg-gradient)',
      }}
    >
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 sm:px-6 py-3">
        {/* Left controls — single launcher */}
        <div ref={navMenuRef} className="relative">
          <button
            onClick={() => setNavMenuOpen(prev => !prev)}
            className={`p-2 rounded-xl backdrop-blur-xl transition-all duration-200 cursor-pointer ${navMenuOpen ? 't-secondary' : 't-tertiary'}`}
            style={{
              backgroundColor: navMenuOpen ? 'var(--glass-bg)' : 'var(--glass-bg-subtle)',
              border: '1px solid var(--glass-border-subtle)',
            }}
            title="Menu"
          >
            <IconGrid className="w-4 h-4" />
          </button>

          {/* Nav popup */}
          {navMenuOpen && (
            <div
              className="absolute left-0 top-full mt-2 z-50 rounded-xl overflow-hidden backdrop-blur-xl shadow-xl min-w-[200px] animate-fade-in"
              style={{ backgroundColor: 'var(--panel-bg)', border: '1px solid var(--glass-border)' }}
            >
              <button
                onClick={() => { setSettingsOpen(true); setNavMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--glass-bg)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Open Settings"
              >
                <IconSettings className="w-4 h-4 shrink-0 t-muted" />
                <span className="flex-1 text-left">Settings</span>
                <span className="text-[10px] t-ghost font-mono">,</span>
              </button>

              <button
                onClick={() => { setAddWidgetOpen(true); setNavMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--glass-bg)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="Add a widget to the current layout"
              >
                <IconPlus className="w-4 h-4 shrink-0 t-muted" />
                <span className="flex-1 text-left">Add Widget</span>
                <span className="text-[10px] t-ghost font-mono">A</span>
              </button>

              <button
                onClick={() => { setShortcutsHelpOpen(true); setNavMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--glass-bg)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                title="View all keyboard shortcuts"
              >
                <IconShortcuts className="w-4 h-4 shrink-0 t-muted" />
                <span className="flex-1 text-left">Shortcuts</span>
                <span className="text-[10px] t-ghost font-mono">?</span>
              </button>

              <div className="mx-3 my-1" style={{ height: '1px', backgroundColor: 'var(--glass-border)' }} />

              <button
                onClick={() => { setAIChatOpen(prev => !prev); setNavMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors duration-150 cursor-pointer"
                style={{ color: aiChatOpen ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--glass-bg)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                title={`Toggle AI Assistant (${aiChatShortcut === 'ctrl+space' ? 'Ctrl' : aiChatShortcut === 'meta+space' ? '⌘' : 'Alt'}+Space)`}
              >
                <IconAi className={`w-4 h-4 shrink-0 ${aiChatOpen ? '' : 't-muted'}`} />
                <span className="flex-1 text-left">AI Assistant</span>
                <span className="text-[10px] t-ghost font-mono">
                  {aiChatShortcut === 'ctrl+space' ? 'Ctrl' : aiChatShortcut === 'meta+space' ? '⌘' : 'Alt'}+Space
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Layout switcher (right) */}
        <LayoutSwitcher activeLayout={activeLayoutId} onLayoutChange={handleLayoutChange} />
      </div>

      {/* Main content */}
      <main className="pt-14 pb-8">
        {renderLayout()}
      </main>

      {/* Settings panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        activeLayout={activeLayoutId}
      />

      {/* Add Widget panel */}
      <AddWidgetPanel
        isOpen={addWidgetOpen}
        onClose={() => setAddWidgetOpen(false)}
        currentWidgets={currentWidgets}
        onAddWidget={handleAddWidget}
        accentColor={profile.accentColor}
      />

      {/* Shortcuts help */}
      <ShortcutsHelp
        isOpen={shortcutsHelpOpen}
        onClose={() => setShortcutsHelpOpen(false)}
        aiChatShortcut={aiChatShortcut}
      />

      {/* AI Chat popup */}
      <AIChatPopup
        isOpen={aiChatOpen}
        onClose={() => setAIChatOpen(false)}
      />
    </div>
  );
}

export default App;

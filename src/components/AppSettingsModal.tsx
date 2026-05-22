import React, { useState, useEffect, useRef } from 'react';
import { HoverEdgeAutoScroll } from './HoverEdgeAutoScroll';
import { t, Language, TranslationKey } from '../localization';
import { GOOGLEAISTUDIOICON_ICON, VERTEXAIICON_ICON } from '../assets/icons';
import bananyangIcon from '../assets/bananyang-icon.png';
import openaiIconUrl from '../assets/openai-icon.png';
import fluxIconUrl from '../assets/flux-icon.png';
import { OpenAIApiSection } from './settings/OpenAIApiSection';
import { FluxApiSection } from './settings/FluxApiSection';
import { GoogleAIApiSection } from './settings/GoogleAIApiSection';
import { CloseIcon, SettingsIcon, FolderPlusIcon, PencilIcon, StarIcon, TrashIcon, DotsVerticalIcon, InfoIcon, DownloadIcon, UploadIcon, FolderIcon, LanguageIcon, GlassEffectIcon, BroomIcon, UndoHistoryIcon, UserCircleIcon, ShieldCheckIcon, CreditCardIcon, SlidersIcon, EyeOpenIcon, ResetIcon } from './icons';
import { getUseGoogleAuth, setUseGoogleAuth, getGeminiApiKeyActive, setGeminiApiKeyActive, getGeminiBackend, getApiKeyAvailableModels, setApiKeyAvailableModels, getVertexAiAvailableModels, setVertexAiAvailableModels, getChatbotModel, setChatbotModel, setVertexProjectId } from '../services/geminiService';
import { AuthService, UserProfile } from '../services/authService';
import { MonthlyCredit, PromptFolder, PromptItem, ModelName } from '../types';
import { MODEL_NAMES } from '../constants';
import { Tooltip } from './Tooltip';
import { useShortcutStore, formatShortcut, ShortcutAction, Shortcut, shortcutLabels, shortcutCategories } from '../hooks/useShortcuts';
import { useSettingsStore, GlassEffectLevel } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { Z_INDEX } from '../constants/zIndex';
import { MemoryMonitor } from './MemoryMonitor';


type AppSettingsTab = 'general' | 'toolbar' | 'system' | 'api' | 'shortcuts' | 'presets';
type ApiSubTab = 'google' | 'apiKey' | 'openai' | 'flux';

interface AppSettingsModalProps {
  isOpen: boolean;
  initialTab?: AppSettingsTab;
  initialApiSubTab?: ApiSubTab;
  onSaveApiKey: (apiKey: string) => void;
  onClose: () => void;
  language: Language;
  monthlyCredit: MonthlyCredit;
  onUpdateTotalCredit: (newTotal: number) => void;
  folders: PromptFolder[];
  saveFolders: (folders: PromptFolder[]) => void;
  currentPrompt: string;
  onLoadPrompt: (prompt: string) => void;
  onNotification: (message: string, type: 'success' | 'error') => void;
  manualUsedCredit: number | '';
  onManualUsedCreditChange: (value: string) => void;
  onUpdateCredit: () => void;
  onCreditInputBlur: () => void;
  modelName: ModelName;
  setModelName: (model: ModelName) => void;
  userAcknowledgedPaidUsage: boolean;
  setUserAcknowledgedPaidUsage: (acknowledged: boolean) => void;
}

// Glass Effect Level Toggle Component - Simple on/off switch (on = sunglasses, off = opaque)
const GlassEffectToggle: React.FC = () => {
  const glassEffectLevel = useSettingsStore(state => state.glassEffectLevel);
  const setGlassEffectLevel = useSettingsStore(state => state.setGlassEffectLevel);

  // On = sunglasses (default liquid glass), Off = opaque (no blur)
  const isEnabled = glassEffectLevel === 'sunglasses' || glassEffectLevel === 'transparent';

  const handleToggle = (checked: boolean) => {
    setGlassEffectLevel(checked ? 'sunglasses' : 'off');
  };

  return (
    <ToggleSwitch checked={isEnabled} onChange={handleToggle} />
  );
};



const ShowCreditToggle: React.FC = () => {
  const showCreditInLeftPanel = useSettingsStore(state => state.showCreditInLeftPanel);
  const setShowCreditInLeftPanel = useSettingsStore(state => state.setShowCreditInLeftPanel);

  return (
    <ToggleSwitch checked={showCreditInLeftPanel} onChange={setShowCreditInLeftPanel} />
  );
};

const GroupAutoAddToggle: React.FC = () => {
  const groupAutoAdd = useSettingsStore(state => state.groupAutoAdd);
  const setGroupAutoAdd = useSettingsStore(state => state.setGroupAutoAdd);

  return (
    <ToggleSwitch checked={groupAutoAdd} onChange={setGroupAutoAdd} />
  );
};

const FlickPanningToggle: React.FC = () => {
  const flickPanning = useSettingsStore(state => state.flickPanning);
  const setFlickPanning = useSettingsStore(state => state.setFlickPanning);

  return (
    <ToggleSwitch checked={flickPanning} onChange={setFlickPanning} />
  );
};

const CanvasAutoAddIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="8" height="8" rx="1" />
    <rect x="14" y="2" width="8" height="8" rx="1" />
    <rect x="2" y="14" width="8" height="8" rx="1" />
    <rect x="14" y="17" width="3" height="3" rx="0.5" />
    <line x1="19" y1="14" x2="19" y2="22" />
    <line x1="15" y1="18" x2="23" y2="18" />
  </svg>
);

const CanvasAutoAddToggle: React.FC = () => {
  const autoAddToCanvas = useSettingsStore(state => state.autoAddToCanvas);
  const setAutoAddToCanvas = useSettingsStore(state => state.setAutoAddToCanvas);

  return (
    <ToggleSwitch checked={autoAddToCanvas} onChange={setAutoAddToCanvas} />
  );
};

const AutoResumeOnRateLimitToggle: React.FC = () => {
  const autoResumeOnRateLimit = useSettingsStore(state => state.autoResumeOnRateLimit);
  const setAutoResumeOnRateLimit = useSettingsStore(state => state.setAutoResumeOnRateLimit);

  return (
    <ToggleSwitch checked={autoResumeOnRateLimit} onChange={setAutoResumeOnRateLimit} />
  );
};

const AutoClosePopoverOnGenerateToggle: React.FC = () => {
  const autoClosePopoverOnGenerate = useSettingsStore(state => state.autoClosePopoverOnGenerate);
  const setAutoClosePopoverOnGenerate = useSettingsStore(state => state.setAutoClosePopoverOnGenerate);

  return (
    <ToggleSwitch checked={autoClosePopoverOnGenerate} onChange={setAutoClosePopoverOnGenerate} />
  );
};

const AutoGroupGeneratedIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="2" />
    <rect x="5" y="5" width="6" height="6" rx="1" />
    <rect x="13" y="5" width="6" height="6" rx="1" />
    <rect x="5" y="13" width="6" height="6" rx="1" />
    <rect x="13" y="13" width="6" height="6" rx="1" />
  </svg>
);

const AutoGroupGeneratedToggle: React.FC = () => {
  const autoGroupGenerated = useSettingsStore(state => state.autoGroupGenerated);
  const setAutoGroupGenerated = useSettingsStore(state => state.setAutoGroupGenerated);

  return (
    <ToggleSwitch checked={autoGroupGenerated} onChange={setAutoGroupGenerated} />
  );
};

const DeveloperModeToggle: React.FC = () => {
  const developerMode = useSettingsStore(state => state.developerMode);
  const setDeveloperMode = useSettingsStore(state => state.setDeveloperMode);

  return (
    <ToggleSwitch checked={developerMode} onChange={setDeveloperMode} />
  );
};

const AutoUpdateToggle: React.FC = () => {
  const autoUpdateEnabled = useSettingsStore(state => state.autoUpdateEnabled);
  const setAutoUpdateEnabled = useSettingsStore(state => state.setAutoUpdateEnabled);

  return (
    <ToggleSwitch checked={autoUpdateEnabled} onChange={setAutoUpdateEnabled} />
  );
};


const AutoBindToolbarToOriginalToggle: React.FC = () => {
  const autoBindToolbarToOriginal = useSettingsStore(state => state.autoBindToolbarToOriginal);
  const setAutoBindToolbarToOriginal = useSettingsStore(state => state.setAutoBindToolbarToOriginal);

  return (
    <ToggleSwitch checked={autoBindToolbarToOriginal} onChange={setAutoBindToolbarToOriginal} />
  );
};

const ToolbarBindingSideControl: React.FC = () => {
  const bindingSide = useSettingsStore(state => state.toolbarBindingSide);
  const setToolbarBindingSide = useSettingsStore(state => state.setToolbarBindingSide);
  const autoBindEnabled = useSettingsStore(state => state.autoBindToolbarToOriginal);
  const language = useSettingsStore(state => state.language);

  return (
    <div className={`flex items-center gap-2 ${!autoBindEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
      {(['left', 'right'] as const).map(side => (
        <button
          key={side}
          onClick={() => setToolbarBindingSide(side)}
          disabled={!autoBindEnabled}
          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
            bindingSide === side
              ? 'bg-key/20 border-key/40 text-key'
              : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
          }`}
        >
          {t((side === 'left' ? 'toolbar.bindLeft' : 'toolbar.bindRight') as TranslationKey, language)}
        </button>
      ))}
    </div>
  );
};

const UndoHistorySizeControl: React.FC = () => {
  const undoHistorySize = useSettingsStore(state => state.undoHistorySize);
  const setUndoHistorySize = useSettingsStore(state => state.setUndoHistorySize);

  return (
    <div className="flex items-center gap-2 min-w-0">
      <button
        onClick={() => setUndoHistorySize(Math.max(1, undoHistorySize - 5))}
        disabled={undoHistorySize <= 5}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Decrease undo history"
      >
        −
      </button>
      <span className="w-8 text-center text-white font-semibold text-sm tabular-nums">{undoHistorySize}</span>
      <button
        onClick={() => setUndoHistorySize(Math.min(50, undoHistorySize + 5))}
        disabled={undoHistorySize >= 50}
        className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-lg font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        aria-label="Increase undo history"
      >
        +
      </button>
    </div>
  );
};


// Auto Download Section Component
const AutoDownloadSection: React.FC<{
  language: Language;
  onNotification: (message: string, type: 'success' | 'error') => void;
  onFolderChange?: (path: string | null) => void;
}> = ({ language, onNotification, onFolderChange }) => {
  const autoDownloadEnabled = useSettingsStore(state => state.autoDownloadEnabled);
  const autoDownloadPath = useSettingsStore(state => state.autoDownloadPath);
  const setAutoDownloadEnabled = useSettingsStore(state => state.setAutoDownloadEnabled);
  const setAutoDownloadPath = useSettingsStore(state => state.setAutoDownloadPath);

  const handleSelectFolder = async () => {
    try {
      if (window.electronAPI?.selectDirectory) {
        const result = await window.electronAPI.selectDirectory();
        if (result) {
          setAutoDownloadPath(result);
          onFolderChange?.(result);
          onNotification(t('autoDownload.folderSet' as TranslationKey, language), 'success');
        }
      } else if (window.showDirectoryPicker) {
        const handle = await window.showDirectoryPicker();
        setAutoDownloadPath(handle.name);
        onFolderChange?.(handle.name);
        // Store handle in memory for later use (File System Access API)
        (window as any).__autoDownloadHandle = handle;
        onNotification(t('autoDownload.folderSet' as TranslationKey, language), 'success');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Failed to select folder:', err);
        onNotification(t('autoDownload.folderSetError' as TranslationKey, language), 'error');
      }
    }
  };

  const handleOpenFolder = async () => {
    if (autoDownloadPath && (window as any).electronAPI?.showItemInFolder) {
      await (window as any).electronAPI.showItemInFolder(autoDownloadPath);
    } else if ((window as any).__autoDownloadHandle) {
      // For File System Access API, we can't directly open folders
      onNotification(t('autoDownload.browserNotSupported' as TranslationKey, language), 'error');
    }
  };

  const handleClearPath = () => {
    setAutoDownloadPath(null);
    setAutoDownloadEnabled(false);
    onFolderChange?.(null);
    (window as any).__autoDownloadHandle = null;
  };

  const handleToggle = (enabled: boolean) => {
    if (enabled && !autoDownloadPath) {
      onNotification(t('autoDownload.selectFolderFirst' as TranslationKey, language), 'error');
      return;
    }
    setAutoDownloadEnabled(enabled);
  };

  // Extract folder name from path
  const folderName = autoDownloadPath ? autoDownloadPath.split(/[\\/]/).pop() || autoDownloadPath : null;

  return (
    <div className="px-6 py-4 border-b border-white/[0.06] hover:bg-white/[0.025] transition-colors duration-150">
      <div className="flex items-center justify-between gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <DownloadIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            {t('autoDownload.title' as TranslationKey, language)}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">{t('autoDownload.description' as TranslationKey, language)}</p>
        </div>
        <button
          onClick={() => handleToggle(!autoDownloadEnabled)}
          disabled={!autoDownloadPath}
          className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer flex-shrink-0 ${!autoDownloadPath ? 'bg-zinc-800 cursor-not-allowed opacity-50' :
            autoDownloadEnabled ? 'bg-yellow-400' : 'bg-zinc-700'
            }`}
        >
          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${autoDownloadEnabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>

      {/* Folder Selection */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {autoDownloadPath ? (
            <div className="flex items-center gap-2 text-xs bg-black/30 text-zinc-300 rounded-md p-1 pr-2 border border-white/10">
              <Tooltip tip={t('autoDownload.openFolder' as TranslationKey, language)} position='top'>
                <button onClick={handleOpenFolder} className="p-1 text-zinc-300 hover:text-white transition-colors rounded-full hover:bg-white/20 cursor-pointer">
                  <FolderIcon className="w-4 h-4 flex-shrink-0" />
                </button>
              </Tooltip>
              <Tooltip tip={autoDownloadPath} position='top'>
                <span className="font-mono truncate max-w-[120px]">{folderName}</span>
              </Tooltip>
              <Tooltip tip={t('autoDownload.clearPath' as TranslationKey, language)} position='top'>
                <button onClick={handleClearPath} className="p-1 text-zinc-500 hover:text-white transition-colors rounded-full hover:bg-white/20 cursor-pointer">
                  <CloseIcon className="w-3 h-3" />
                </button>
              </Tooltip>
            </div>
          ) : (
            <span className="text-xs text-zinc-500">{t('autoDownload.noFolder' as TranslationKey, language)}</span>
          )}
        </div>
        <button
          onClick={handleSelectFolder}
          className="px-3 py-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-150 border border-white/10 cursor-pointer"
        >
          {t('autoDownload.selectFolder' as TranslationKey, language)}
        </button>
      </div>
    </div>
  );
};

// Toggle Switch Component for settings
const ToggleSwitch: React.FC<{ checked: boolean; onChange: (checked: boolean) => void }> = ({ checked, onChange }) => {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-12 h-6 rounded-full transition-colors duration-200 cursor-pointer ${checked ? 'bg-yellow-400' : 'bg-zinc-700'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${checked ? 'left-7' : 'left-1'}`} />
    </button>
  );
};

// ── Flat-panel layout primitives ─────────────────────────────────────────────
const SectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="px-6 pt-5 pb-2">
    <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">{label}</span>
  </div>
);

const SettingRow: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  noBorder?: boolean;
  children?: React.ReactNode;
}> = ({ icon, label, description, control, noBorder, children }) => (
  <div className={`px-6 py-4 hover:bg-white/[0.025] transition-colors duration-150 cursor-default ${!noBorder ? 'border-b border-white/[0.06]' : ''}`}>
    <div className="flex items-center justify-between gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 leading-snug">
          {icon}
          {label}
        </div>
        {description && <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {control && <div className="flex-shrink-0">{control}</div>}
    </div>
    {children && <div className="mt-3">{children}</div>}
  </div>
);

const SettingsPanel: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`bg-white/[0.03] rounded-2xl border border-white/[0.07] overflow-hidden ${className ?? ''}`}>
    {children}
  </div>
);

// ── Flat (Claude-style) layout primitives ─────────────────────────────────────
const FlatSectionHeader: React.FC<{ label: string }> = ({ label }) => (
  <div className="pb-1.5">
    <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">{label}</span>
  </div>
);

const FlatSettingRow: React.FC<{
  icon?: React.ReactNode;
  label: React.ReactNode;
  description?: React.ReactNode;
  control?: React.ReactNode;
  subContent?: React.ReactNode;
  noBorder?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}> = ({ icon, label, description, control, subContent, noBorder, isActive, onClick, children }) => (
  <div
    className={`py-3.5 transition-colors duration-150 ${!noBorder ? 'border-b border-white/[0.06]' : ''} ${onClick ? `cursor-pointer -mx-6 px-6 ${isActive ? 'bg-yellow-400/[0.07] hover:bg-yellow-400/[0.10]' : 'hover:bg-white/[0.04]'}` : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      {icon && <div className="w-4 h-4 flex-shrink-0 text-zinc-500">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-zinc-200 leading-snug">{label}</div>
        {description && <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      {control && <div className="flex-shrink-0">{control}</div>}
    </div>
    {(subContent || children) && <div className="mt-3 ml-7">{subContent ?? children}</div>}
  </div>
);

const FlatSection: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`border border-white/[0.07] rounded-2xl overflow-hidden px-6 ${className ?? ''}`}>
    {children}
  </div>
);

// BanaNyang Account Section Component
const AccountSection: React.FC<{
  language: Language;
  onLoginClick: () => void;
}> = ({ language, onLoginClick }) => {
  const { authState, email, openLoginModal, logout } = useAuthStore();
  const autoLogin = useSettingsStore(state => state.autoLogin);
  const setAutoLogin = useSettingsStore(state => state.setAutoLogin);
  const isLoggedIn = authState === 'authenticated' || authState === 'offline_grace';

  const handleLoginClick = () => {
    onLoginClick();
    openLoginModal();
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <FlatSection>
      <div className="pt-4 pb-1">
        <FlatSectionHeader label={t('account.sectionTitle' as TranslationKey, language)} />
      </div>
      <FlatSettingRow
        icon={<UserCircleIcon className="w-4 h-4" />}
        label={t('account.sectionTitle' as TranslationKey, language)}
        description={isLoggedIn ? email ?? undefined : t('account.notLoggedIn' as TranslationKey, language)}
        control={
          isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 hover:bg-white/[0.15] text-zinc-300 transition-colors duration-150 cursor-pointer border border-white/[0.08]"
            >
              {t('account.logout' as TranslationKey, language)}
            </button>
          ) : (
            <button
              onClick={handleLoginClick}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-200 hover:bg-white text-zinc-900 transition-colors duration-150 cursor-pointer"
            >
              {t('account.login' as TranslationKey, language)}
            </button>
          )
        }
      />
      <FlatSettingRow
        icon={<ShieldCheckIcon className="w-4 h-4" />}
        label={t('account.autoLogin' as TranslationKey, language)}
        description={t('account.autoLoginDescription' as TranslationKey, language)}
        control={<ToggleSwitch checked={autoLogin} onChange={setAutoLogin} />}
        noBorder
      />
      <div className="pb-2" />
    </FlatSection>
  );
};

export const AppSettingsModal: React.FC<AppSettingsModalProps> = ({
  isOpen,
  onSaveApiKey,
  onClose,
  language,
  monthlyCredit,
  onUpdateTotalCredit,
  folders,
  saveFolders,
  currentPrompt,
  onLoadPrompt,
  onNotification,
  manualUsedCredit,
  onManualUsedCreditChange,
  onUpdateCredit,
  onCreditInputBlur,
  modelName,
  setModelName,
  initialTab,
  initialApiSubTab,
}) => {
  const [totalCreditInput, setTotalCreditInput] = useState(monthlyCredit.total.toString());
  const [activeTab, setActiveTab] = useState<AppSettingsTab>(initialTab || 'general');
  const [isEditingTotalCredit, setIsEditingTotalCredit] = useState(false);
  const [isPricingPopoverOpen, setIsPricingPopoverOpen] = useState(false);
  const [pricingTab, setPricingTab] = useState<'gemini' | 'openai' | 'flux'>('gemini');
  const totalCreditInputRef = useRef<HTMLInputElement>(null);
  const pricingButtonRef = useRef<HTMLButtonElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const folderListScrollRef = useRef<HTMLDivElement>(null);
  const presetListScrollRef = useRef<HTMLDivElement>(null);

  // Sync activeTab when initialTab changes (e.g., opening from different menu items)
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  // Google Auth State — extended to include openai / flux sub-tabs
  const resolveInitialAuthMode = (): 'apiKey' | 'google' | 'openai' | 'flux' => {
    if (initialApiSubTab === 'openai') return 'openai';
    if (initialApiSubTab === 'flux') return 'flux';
    return getUseGoogleAuth() ? 'google' : 'apiKey';
  };
  const [authMode, setAuthMode] = useState<'apiKey' | 'google' | 'openai' | 'flux'>(resolveInitialAuthMode);
  const [geminiBackend, setGeminiBackendState] = useState<'vertex' | 'apiKey' | 'none'>(() => getGeminiBackend());

  // Sync authMode when initialApiSubTab changes (e.g. navigating from ModelSelector)
  useEffect(() => {
    if (initialApiSubTab === 'openai') setAuthMode('openai');
    else if (initialApiSubTab === 'flux') setAuthMode('flux');
  }, [initialApiSubTab]);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoadingLogin, setIsLoadingLogin] = useState(getUseGoogleAuth());
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectIdInput, setProjectIdInput] = useState('');
  const [accountEmail, setAccountEmail] = useState<string | null>(null);

  // Model availability per authentication method
  const [apiKeyModels, setApiKeyModels] = useState<ModelName[]>([
    MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW as ModelName,
    MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE as ModelName,
    'gemini-2.5-flash' as ModelName,
    'gemini-2.5-flash-lite' as ModelName
  ]);
  const [vertexAiModels, setVertexAiModels] = useState<ModelName[]>([
    MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW as ModelName,
    MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE as ModelName,
    'gemini-2.5-flash' as ModelName,
    'gemini-2.5-flash-lite' as ModelName
  ]);
  const [chatbotModel, setChatbotModelState] = useState<string>(() => getChatbotModel());

  const monthlyCreditPercentage = monthlyCredit.total > 0 ? Math.min(100, (monthlyCredit.current / monthlyCredit.total) * 100) : 0;

  // Settings store subscription for toggle switch reactivity
  const showCreditInLeftPanel = useSettingsStore(state => state.showCreditInLeftPanel);

  const authService = AuthService.getInstance();

  // Auto-focus and select input when editing total credit
  useEffect(() => {
    if (isEditingTotalCredit) {
      totalCreditInputRef.current?.focus();
      totalCreditInputRef.current?.select();
    }
  }, [isEditingTotalCredit]);

  // Update totalCreditInput when monthlyCredit.total changes (but not while editing)
  useEffect(() => {
    if (!isEditingTotalCredit) {
      setTotalCreditInput(monthlyCredit.total.toString());
    }
  }, [monthlyCredit.total, isEditingTotalCredit]);

  useEffect(() => {
    const checkLoginStatus = async () => {
      // apiKey 탭으로 전환 시: 로그인 상태만 초기화하고 즉시 반환
      // (ADC 감지로 authMode를 강제 복귀시키면 무한 루프 발생)
      if (authMode !== 'google') {
        setIsLoggedIn(false);
        setIsLoadingLogin(false);
        return;
      }
      setIsLoadingLogin(true);
      try {
        // 1) 앱 내 ADC 인증 상태 확인 (google-auth-status)
        if (window.electronAPI?.googleAuthStatus) {
          const status = await window.electronAPI.googleAuthStatus();
          if (status.hasAdc) {
            setIsLoggedIn(true);
            if (status.projectId) {
              setProjectId(status.projectId);
              setProjectIdInput(status.projectId);
              setVertexProjectId(status.projectId);
            }
            // safeStorage에서 이메일 복원
            if (window.electronAPI?.safeStorageGet) {
              const email = await window.electronAPI.safeStorageGet('vertex_ai_email');
              if (email) setAccountEmail(email);
            }
            // projectId 없으면 프로젝트 목록 자동 조회
            if (!status.projectId) {
              setIsLoadingLogin(false);
              fetchProjects();
            }
            return;
          }
        }
        setIsLoggedIn(false);
      } catch (error) {
        console.error('Failed to check login status', error);
        setIsLoggedIn(false);
      } finally {
        setIsLoadingLogin(false);
      }
    };
    checkLoginStatus();

    // Ensure all models are available
    setApiKeyAvailableModels([MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW as ModelName, MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE as ModelName, 'gemini-2.5-flash' as ModelName, 'gemini-2.5-flash-lite' as ModelName]);
    setVertexAiAvailableModels([MODEL_NAMES.GEMINI_3_PRO_IMAGE_PREVIEW as ModelName, MODEL_NAMES.GEMINI_2_5_FLASH_IMAGE as ModelName, 'gemini-2.5-flash' as ModelName, 'gemini-2.5-flash-lite' as ModelName]);
  }, [authMode]);

  const handleAuthModeChange = (mode: 'apiKey' | 'google') => {
    setAuthMode(mode);
    setUseGoogleAuth(mode === 'google');
  };

  const [isRefreshingThumb, setIsRefreshingThumb] = useState(false);
  const [thumbRefreshMsg, setThumbRefreshMsg] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [projectList, setProjectList] = useState<{ projectId: string; name: string }[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectFilter, setProjectFilter] = useState('');

  const fetchProjects = async (accessToken?: string | null) => {
    if (!window.electronAPI?.googleAuthListProjects) return;
    setIsLoadingProjects(true);
    setLoginError(null);
    try {
      const result = await window.electronAPI.googleAuthListProjects(accessToken ?? null);
      if (result.success && result.projects) {
        setProjectList(result.projects);
      } else {
        setProjectList([]);
        setLoginError(result.error || t('appSettingsModal.projectListFailed', language));
      }
    } catch (error: any) {
      setProjectList([]);
      setLoginError(t('appSettingsModal.projectListFailed', language));
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleSelectProject = async (pid: string) => {
    await window.electronAPI?.googleAuthSetProject?.(pid);
    setProjectId(pid);
    setProjectIdInput(pid);
    setVertexProjectId(pid);
    setUseGoogleAuth(true);
    setAuthMode('google');
    onNotification(t('appSettingsModal.vertexConnectedLabel', language), 'success');
  };

  const handleGoogleCancel = async () => {
    await window.electronAPI?.googleAuthCancel?.();
    setIsLoggingIn(false);
    setLoginError(t('appSettingsModal.authCancelled', language));
  };

  const handleGoogleConnect = async () => {
    if (!window.electronAPI?.googleAuthStart) {
      setLoginError(t('appSettingsModal.authUnavailable', language));
      return;
    }
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await window.electronAPI.googleAuthStart('');
      if (result.success) {
        setIsLoggedIn(true);
        if (result.email) {
          setAccountEmail(result.email);
          await window.electronAPI.safeStorageSet?.('vertex_ai_email', result.email);
        }
        setProjectId(null);
        await fetchProjects(result.accessToken);
      } else {
        throw new Error(result.error || t('appSettingsModal.connectionFailed', language));
      }
    } catch (error: any) {
      setLoginError(error.message || t('appSettingsModal.unknownError', language));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // 계정 전환 (재인증)
  const handleGoogleReconnect = async () => {
    if (!window.electronAPI?.googleAuthStart) return;
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await window.electronAPI.googleAuthStart('');
      if (result.success) {
        if (result.email) {
          setAccountEmail(result.email);
          await window.electronAPI.safeStorageSet?.('vertex_ai_email', result.email);
        }
        setProjectId(null);
        await fetchProjects(result.accessToken);
      } else {
        throw new Error(result.error || t('appSettingsModal.switchAccountFailed', language));
      }
    } catch (error: any) {
      setLoginError(error.message);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGcloudDisconnect = async () => {
    try {
      await window.electronAPI?.googleAuthLogout?.();
    } catch (e) {
      console.warn('ADC 파일 삭제 실패:', e);
    }
    try {
      await window.electronAPI?.safeStorageDelete?.('vertex_ai_email');
    } catch (e) {
      console.warn('이메일 삭제 실패:', e);
    }
    setIsLoggedIn(false);
    setUseGoogleAuth(false);
    setAuthMode('apiKey');
    setAccountEmail(null);
    setProjectId(null);
    setVertexProjectId(null);
    setProjectIdInput('');
    setProjectList([]);
    onNotification(t('appSettingsModal.disconnected', language), 'success');
  };

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<{ id: string, name: string } | null>(null);
  const [editingPreset, setEditingPreset] = useState<PromptItem | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetPrompt, setNewPresetPrompt] = useState('');
  // Dropdown menu state
  const [openFolderDropdown, setOpenFolderDropdown] = useState<string | null>(null);
  const [openPresetDropdown, setOpenPresetDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenFolderDropdown(null);
        setOpenPresetDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { shortcuts, setShortcut, resetShortcuts } = useShortcutStore();
  const [listeningFor, setListeningFor] = useState<ShortcutAction | null>(null);
  const [pendingShortcut, setPendingShortcut] = useState<Shortcut | null>(null);

  // Handle confirming the pending shortcut
  const handleConfirmShortcut = () => {
    if (listeningFor && pendingShortcut) {
      setShortcut(listeningFor, pendingShortcut);
    }
    setListeningFor(null);
    setPendingShortcut(null);
  };

  // Handle canceling the shortcut edit
  const handleCancelShortcut = () => {
    setListeningFor(null);
    setPendingShortcut(null);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Only cancel shortcut listening, don't close the modal
        if (listeningFor) {
          handleCancelShortcut();
        }
        return;
      }

      if (listeningFor) {
        e.preventDefault();
        e.stopPropagation();

        // Check if any Ctrl/Cmd modifier was pressed (platform-agnostic)
        const hasCtrlModifier = e.ctrlKey || e.metaKey;

        const newShortcut: Shortcut = {
          key: e.key,
          // Set BOTH ctrlKey and metaKey true when any Ctrl/Cmd is pressed
          // This matches the default shortcuts format for consistent comparison
          ctrlKey: hasCtrlModifier,
          metaKey: hasCtrlModifier,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
        };

        // Update pending shortcut instead of immediately saving
        setPendingShortcut(newShortcut);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [onClose, listeningFor]);

  useEffect(() => {
    setTotalCreditInput(monthlyCredit.total.toString());
  }, [monthlyCredit.total]);

  useEffect(() => {
    const currentSelectionExists = folders.some(f => f.id === selectedFolderId);
    if (!currentSelectionExists && folders.length > 0) {
      setSelectedFolderId(folders[0].id);
    } else if (folders.length === 0) {
      setSelectedFolderId(null);
    }
  }, [folders, selectedFolderId]);

  const handleTotalCreditUpdate = () => {
    const newTotal = parseFloat(totalCreditInput);
    if (!isNaN(newTotal) && newTotal >= 0) {
      onUpdateTotalCredit(newTotal);
    } else {
      setTotalCreditInput(monthlyCredit.total.toFixed(2));
    }
    setIsEditingTotalCredit(false);
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    return isNaN(num) ? '' : num.toFixed(2);
  };

  // --- Preset Manager Logic ---
  const handleAddFolder = () => {
    const newFolder: PromptFolder = {
      id: crypto.randomUUID(),
      name: `${t('presets.folder', language)} ${folders.length + 1}`,
      presets: [],
      showInQuickBar: true,
    };
    const newFolders = [...folders, newFolder];
    saveFolders(newFolders);
    setSelectedFolderId(newFolder.id);
    setEditingFolder({ id: newFolder.id, name: newFolder.name });
  };

  const handleDeleteFolder = (folderId: string) => {
    if (window.confirm(t('presets.deleteFolderConfirm', language))) {
      const newFolders = folders.filter(f => f.id !== folderId);
      saveFolders(newFolders);
      if (selectedFolderId === folderId) {
        setSelectedFolderId(newFolders.length > 0 ? newFolders[0].id : null);
      }
    }
  };

  const handleRenameFolder = () => {
    if (!editingFolder || !editingFolder.name.trim()) {
      setEditingFolder(null);
      return;
    };
    const newFolders = folders.map(f =>
      f.id === editingFolder.id ? { ...f, name: editingFolder.name.trim() } : f
    );
    saveFolders(newFolders);
    setEditingFolder(null);
  };

  const handleSaveCurrentPrompt = () => {
    if (!selectedFolderId || !currentPrompt.trim()) return;
    const presetName = prompt(t('presets.presetNamePlaceholder', language), t('presets.untitled', language))
    if (!presetName || !presetName.trim()) return;

    const newPreset: PromptItem = { id: crypto.randomUUID(), name: presetName.trim(), prompt: currentPrompt };
    const newFolders = folders.map(folder => folder.id === selectedFolderId ? { ...folder, presets: [...folder.presets, newPreset] } : folder);
    saveFolders(newFolders);
    onNotification(t('presets.promptSaved', language), 'success');
  };

  const handleAddNewPreset = () => {
    if (!selectedFolderId || !newPresetName.trim() || !newPresetPrompt.trim()) return;
    const newPreset: PromptItem = { id: crypto.randomUUID(), name: newPresetName.trim(), prompt: newPresetPrompt.trim() };
    const newFolders = folders.map(folder => folder.id === selectedFolderId ? { ...folder, presets: [...folder.presets, newPreset] } : folder);
    saveFolders(newFolders);
    setNewPresetName(''); setNewPresetPrompt('');
    onNotification(t('presets.promptSaved', language), 'success');
  };

  const handleDeletePreset = (presetId: string) => {
    if (!selectedFolderId || !window.confirm(t('presets.deleteConfirm', language))) return;
    const newFolders = folders.map(folder => folder.id === selectedFolderId ? { ...folder, presets: folder.presets.filter(p => p.id !== presetId) } : folder);
    saveFolders(newFolders);
  };

  const handleSavePresetEdit = () => {
    if (!editingPreset || !editingPreset.name.trim() || !selectedFolderId) {
      setEditingPreset(null);
      return;
    }
    const newFolders = folders.map(f => f.id === selectedFolderId ? { ...f, presets: f.presets.map(p => p.id === editingPreset.id ? editingPreset : p) } : f);
    saveFolders(newFolders);
    setEditingPreset(null);
  };

  const handleToggleQuickBar = (folderId: string) => {
    const newFolders = folders.map(f => f.id === folderId ? { ...f, showInQuickBar: !(f.showInQuickBar ?? true) } : f);
    saveFolders(newFolders);
  };

  // Export all presets to a .prompt file
  const handleExportPresets = async () => {
    try {
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        folders: folders
      };
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });

      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`,
          types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        onNotification(t('presets.exportSuccess', language), 'success');
      } else {
        // Fallback for browsers without File System Access API
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `bananyang-presets-${new Date().toISOString().slice(0, 10)}.prompt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        onNotification(t('presets.exportSuccess', language), 'success');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Export failed:', error);
        onNotification(t('presets.exportFailed', language), 'error');
      }
    }
  };

  // Import presets from a .prompt file
  const handleImportPresets = async () => {
    try {
      if (window.showOpenFilePicker) {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'Prompt Presets', accept: { 'application/json': ['.prompt'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const content = await file.text();
        const importData = JSON.parse(content);

        if (importData.folders && Array.isArray(importData.folders)) {
          if (window.confirm(t('presets.importConfirm', language))) {
            saveFolders(importData.folders);
            onNotification(t('presets.importSuccess', language), 'success');
          }
        } else {
          onNotification(t('presets.importInvalid', language), 'error');
        }
      } else {
        // Fallback using file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.prompt';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const content = await file.text();
            const importData = JSON.parse(content);

            if (importData.folders && Array.isArray(importData.folders)) {
              if (window.confirm(t('presets.importConfirm', language))) {
                saveFolders(importData.folders);
                onNotification(t('presets.importSuccess', language), 'success');
              }
            } else {
              onNotification(t('presets.importInvalid', language), 'error');
            }
          }
        };
        input.click();
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Import failed:', error);
        onNotification(t('presets.importFailed', language), 'error');
      }
    }
  };

  const selectedFolder = folders.find(f => f.id === selectedFolderId);
  const shortcutActions = Object.keys(shortcuts) as ShortcutAction[];

  const tabs: { id: AppSettingsTab; label: TranslationKey; group?: 'settings' | 'other' }[] = [
    { id: 'general',   label: 'appSettingsModal.generalTitle',   group: 'settings' },
    { id: 'toolbar',   label: 'appSettingsModal.toolbarTitle',   group: 'settings' },
    { id: 'system',    label: 'appSettingsModal.systemTitle',    group: 'settings' },
    { id: 'api',       label: 'appSettingsModal.personalTitle',  group: 'other' },
    { id: 'shortcuts', label: 'appSettingsModal.shortcutsTitle', group: 'other' },
    { id: 'presets',   label: 'appSettingsModal.presetTitle',    group: 'other' },
  ];



  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center" style={{ zIndex: Z_INDEX.MODAL_BACKDROP }} onClick={onClose}>
      <div
        className="glass-dialog w-[min(780px,72vw)] h-[min(840px,88vh)] rounded-2xl flex flex-col overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 px-5 py-3 border-b border-white/10 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <img src={bananyangIcon} alt="Logo" className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('appSettingsModal.title', language)}</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm font-semibold text-white/40 uppercase tracking-wider">By.Park Kyoung Min</div>
            <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-full hover:bg-white/10 transition-colors z-10">
              <CloseIcon className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-grow flex min-h-0">
          <nav className="w-36 flex-shrink-0 border-r border-white/10 py-6 bg-black/20 flex flex-col h-full">
            <ul className="space-y-1 px-4 flex-grow">
              {tabs.map((tab, i) => (
                <li key={tab.id}>
                  {i > 0 && tabs[i - 1].group !== tab.group && (
                    <div className="my-2 border-t border-white/[0.06]" />
                  )}
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative w-full text-left flex items-center gap-3 px-4 py-2.5 text-sm rounded-lg transition-all duration-150 cursor-pointer ${activeTab === tab.id
                      ? 'text-key bg-key/[0.08] font-medium'
                      : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300 font-normal'
                      }`}
                  >
                    {activeTab === tab.id && <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-key rounded-full" />}
                    <span>{t(tab.label, language)}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="px-4 mt-4 pt-4 border-t border-white/10">
              <button
                onClick={async () => {
                  if (confirm(t('confirm.resetCache', language))) {
                    // Clear Web LocalStorage
                    localStorage.clear();
                    // Clear IndexedDB (optional, if needed, but 'clear-app-cache' in main might cover partition storage)
                    // If we have a robust way to clear IDB here:
                    try {
                      // Call Electron to clear cache and relaunch
                      if (window.electronAPI?.clearAppCache) {
                        await window.electronAPI.clearAppCache();
                      } else {
                        window.location.reload();
                      }
                    } catch (e) {
                      console.error("Failed to reset app", e);
                      window.location.reload();
                    }
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-base font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
              >
                <TrashIcon className="w-5 h-5" />
                <span>{t('appSettingsModal.resetApp' as TranslationKey, language)}</span>
              </button>
            </div>
          </nav>

          <div className="flex-grow relative min-h-0">
          <main ref={mainScrollRef} className="h-full overflow-y-auto p-8 bg-black/10 dark-glass-scrollbar">

            {/* General Tab — Language, Display, Canvas & Workspace */}
            {activeTab === 'general' && (
              <div className="space-y-4 animate-category-fade-in">
                <h3 className="text-base font-bold text-zinc-200 mb-2">{t('appSettingsModal.generalTitle', language)}</h3>
                <SettingsPanel>
                  <SectionHeader label={t('settings.section.display', language)} />
                  <SettingRow
                    icon={<LanguageIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.language' as TranslationKey, language)}
                    description={t('settings.languageDescription' as TranslationKey, language)}
                    control={
                      <select
                        value={language}
                        onChange={(e) => useSettingsStore.getState().setLanguage(e.target.value as Language)}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-white/20 focus:border-transparent outline-none cursor-pointer"
                      >
                        <option value="ko">한국어</option>
                        <option value="en">English</option>
                        <option value="ja">日本語</option>
                        <option value="id">Bahasa Indonesia</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                      </select>
                    }
                  />
                  <SettingRow
                    icon={<GlassEffectIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.glassEffectTitle' as TranslationKey, language)}
                    description={t('settings.glassEffectDescription' as TranslationKey, language)}
                    control={<GlassEffectToggle />}
                  />
                  <SettingRow
                    icon={<DownloadIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoUpdate.label' as TranslationKey, language)}
                    description={t('settings.autoUpdate.description' as TranslationKey, language)}
                    control={<AutoUpdateToggle />}
                    noBorder
                  />
                </SettingsPanel>
                <SettingsPanel>
                  <SectionHeader label={t('settings.section.canvas', language)} />
                  <SettingRow
                    icon={<FolderPlusIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.groupAutoAddTitle' as TranslationKey, language)}
                    description={t('settings.groupAutoAddDescription' as TranslationKey, language)}
                    control={<GroupAutoAddToggle />}
                  />
                  <SettingRow
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-zinc-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v6" /><path d="M10 10.5V6a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.9-5.8-2.4l-3.1-3.5c-.7-.8-.7-2 .1-2.7h0a1.9 1.9 0 0 1 2.7.1L6 14" /></svg>}
                    label={t('settings.flickPanningTitle' as TranslationKey, language)}
                    description={t('settings.flickPanningDescription' as TranslationKey, language)}
                    control={<FlickPanningToggle />}
                    noBorder
                  />
                </SettingsPanel>
                <SettingsPanel>
                  <SectionHeader label={t('settings.section.generation' as TranslationKey, language)} />
                  <SettingRow
                    icon={<CanvasAutoAddIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoAddToCanvasTitle' as TranslationKey, language)}
                    description={t('settings.autoAddToCanvasDescription' as TranslationKey, language)}
                    control={<CanvasAutoAddToggle />}
                  />
                  <AutoDownloadSection language={language} onNotification={onNotification} />
                  <SettingRow
                    icon={<CloseIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoClosePopoverOnGenerateTitle' as TranslationKey, language)}
                    description={t('settings.autoClosePopoverOnGenerateDescription' as TranslationKey, language)}
                    control={<AutoClosePopoverOnGenerateToggle />}
                  />
                  <SettingRow
                    icon={<AutoGroupGeneratedIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoGroupGeneratedTitle' as TranslationKey, language)}
                    description={t('settings.autoGroupGeneratedDescription' as TranslationKey, language)}
                    control={<AutoGroupGeneratedToggle />}
                  />
                  <SettingRow
                    icon={<ResetIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoResumeOnRateLimitTitle' as TranslationKey, language)}
                    description={t('settings.autoResumeOnRateLimitDescription' as TranslationKey, language)}
                    control={<AutoResumeOnRateLimitToggle />}
                    noBorder
                  />
                </SettingsPanel>
              </div>
            )}

            {/* Toolbar Tab — Orientation, binding */}
            {activeTab === 'toolbar' && (
              <div className="space-y-4 animate-category-fade-in">
                <h3 className="text-base font-bold text-zinc-200 mb-2">{t('appSettingsModal.toolbarTitle', language)}</h3>
                <SettingsPanel>
                  <SectionHeader label={t('settings.section.toolbar', language)} />
                  <SettingRow
                    icon={<SlidersIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.autoBindToolbarToOriginalTitle' as TranslationKey, language)}
                    description={t('settings.autoBindToolbarToOriginalDescription' as TranslationKey, language)}
                    control={<AutoBindToolbarToOriginalToggle />}
                  />
                  <SettingRow
                    icon={<SlidersIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('toolbar.bindingDirection' as TranslationKey, language)}
                    control={<ToolbarBindingSideControl />}
                    noBorder
                  />
                </SettingsPanel>
              </div>
            )}


            {/* System Tab — Diagnostics & developer */}
            {activeTab === 'system' && (
              <div className="space-y-4 animate-category-fade-in">
                <h3 className="text-base font-bold text-zinc-200 mb-2">{t('appSettingsModal.systemTitle', language)}</h3>
                <SettingsPanel>
                  <SectionHeader label={t('settings.section.system', language)} />
                  {!!window.electronAPI?.refreshThumbnailHandler && (
                    <SettingRow
                      icon={<InfoIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                      label={t('appSettingsModal.resetThumbnailHandler', language)}
                      description={t('appSettingsModal.resetThumbnailHandlerDesc', language)}
                      control={
                        <div className="flex items-center gap-2">
                          {thumbRefreshMsg && <span className="text-xs text-zinc-400">{thumbRefreshMsg}</span>}
                          <button
                            disabled={isRefreshingThumb}
                            onClick={async () => {
                              if (!window.electronAPI?.refreshThumbnailHandler) return;
                              setIsRefreshingThumb(true);
                              setThumbRefreshMsg(null);
                              try {
                                const result = await window.electronAPI.refreshThumbnailHandler();
                                setThumbRefreshMsg(result.success ? t('appSettingsModal.thumbnailReregisterComplete', language) : t('appSettingsModal.thumbnailReregisterFailed', language, { reason: result.reason ?? 'unknown' }));
                              } catch {
                                setThumbRefreshMsg(t('appSettingsModal.thumbnailError', language));
                              } finally {
                                setIsRefreshingThumb(false);
                              }
                            }}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.06] hover:bg-white/10 text-zinc-300 border border-white/[0.08] transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                          >
                            {isRefreshingThumb ? t('appSettingsModal.processing', language) : t('appSettingsModal.resetThumbnailButton', language)}
                          </button>
                        </div>
                      }
                    />
                  )}
                  <SettingRow
                    icon={<InfoIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.developerModeTitle' as TranslationKey, language)}
                    description={t('settings.developerModeDescription' as TranslationKey, language)}
                    control={<DeveloperModeToggle />}
                  />
                  <SettingRow
                    icon={<UndoHistoryIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />}
                    label={t('settings.undoHistoryTitle' as TranslationKey, language)}
                    description={t('settings.undoHistoryDescription' as TranslationKey, language)}
                    control={<UndoHistorySizeControl />}
                  />
                  <div className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-200 mb-1">
                      <BroomIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                      {t('settings.memoryTitle' as TranslationKey, language)}
                    </div>
                    <p className="text-xs text-zinc-500 mb-4">{t('settings.memoryDescription' as TranslationKey, language)}</p>
                    <MemoryMonitor compact={false} showGraph={true} language={language} />
                  </div>
                </SettingsPanel>
              </div>
            )}

            {activeTab === 'api' && (
              <div className="space-y-4 animate-category-fade-in">
                <h3 className="text-base font-bold text-zinc-200 mb-2">{t('appSettingsModal.personalTitle', language)}</h3>

                {/* BanaNyang Account Section */}
                <AccountSection language={language} onLoginClick={onClose} />

                {/* API Configuration group */}
                <FlatSection>
                  <div className="pt-4 pb-3">
                    <FlatSectionHeader label="API" />
                  </div>

                  {/* Tab Navigation */}
                  <div className="flex flex-wrap gap-1.5 pb-4 border-b border-white/[0.06]">
                    <button
                      onClick={() => setAuthMode('google')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        authMode === 'google'
                          ? 'border-yellow-500 text-white'
                          : 'border-transparent text-white hover:border-white/20'
                      }`}
                    >
                      <img src={VERTEXAIICON_ICON} alt="" className={`w-4 h-4 ${authMode !== 'google' ? 'grayscale opacity-50' : ''}`} />
                      Vertex AI
                    </button>
                    <button
                      onClick={() => setAuthMode('apiKey')}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        authMode === 'apiKey'
                          ? 'border-yellow-500 text-white'
                          : 'border-transparent text-white hover:border-white/20'
                      }`}
                    >
                      <img src={GOOGLEAISTUDIOICON_ICON} alt="" className={`w-4 h-4 ${authMode !== 'apiKey' ? 'grayscale opacity-50' : ''}`} />
                      Google AI Studio
                    </button>
                    <button
                      onClick={() => { setAuthMode('openai'); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        authMode === 'openai'
                          ? 'border-zinc-300 text-white'
                          : 'border-transparent text-white hover:border-white/20'
                      }`}
                    >
                      <img src={openaiIconUrl} alt="" className={`w-4 h-4 ${authMode !== 'openai' ? 'grayscale opacity-50' : ''}`} />
                      OpenAI
                    </button>
                    <button
                      onClick={() => { setAuthMode('flux'); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        authMode === 'flux'
                          ? 'border-orange-400 text-white'
                          : 'border-transparent text-white hover:border-white/20'
                      }`}
                    >
                      <img src={fluxIconUrl} alt="" className={`w-4 h-4 ${authMode !== 'flux' ? 'grayscale opacity-50' : ''}`} />
                      Flux
                    </button>
                  </div>

                  {/* Tab Content */}
                  <div className="py-4">
                    {authMode === 'google' ? (
                      <div className="flex flex-col gap-4">
                        {/* Vertex AI 활성화 행 */}
                        <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <img src={VERTEXAIICON_ICON} alt="" className="w-4 h-4 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-zinc-200">{t('appSettingsModal.vertexActivationLabel', language)}</span>
                                <Tooltip tip={t('appSettingsModal.vertexActivationTooltip', language)} position="right" tipClassName="max-w-xs">
                                  <span className="flex items-center cursor-default">
                                    <InfoIcon className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                                  </span>
                                </Tooltip>
                              </div>
                              <p className="text-xs text-zinc-500 mt-0.5">{t('appSettingsModal.vertexCallingAccount', language)}</p>
                            </div>
                          </div>
                          <ToggleSwitch
                            checked={geminiBackend === 'vertex'}
                            onChange={(enabled) => {
                              setUseGoogleAuth(enabled);
                              setGeminiBackendState(getGeminiBackend());
                            }}
                          />
                        </div>
                        {isLoadingLogin ? (
                          /* ── 로딩 ── */
                          <div className="flex items-center gap-2.5 py-3">
                            <div className="w-4 h-4 border-2 border-zinc-600/40 border-t-zinc-400 rounded-full animate-spin flex-shrink-0" />
                            <span className="text-xs text-zinc-500">{t('appSettingsModal.checkingConnection', language)}</span>
                          </div>
                        ) : isLoggedIn && projectId ? (
                          /* ── 연결됨 ── */
                          <div className="flex flex-col gap-3">
                            {/* 상태 뱃지 */}
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-key animate-pulse flex-shrink-0" />
                              <span className="text-xs font-semibold text-white">{t('appSettingsModal.vertexConnectedLabel', language)}</span>
                            </div>

                            {/* 이메일 */}
                            {accountEmail && (
                              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                                <div className="w-6 h-6 rounded-full bg-key/20 flex items-center justify-center flex-shrink-0">
                                  <svg className="w-3.5 h-3.5 text-key" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                  </svg>
                                </div>
                                <span className="text-xs text-zinc-300 truncate">{accountEmail}</span>
                              </div>
                            )}

                            {/* Project ID (수정 가능) */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-xs font-medium text-zinc-500">Cloud Project ID</label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={projectIdInput}
                                  onChange={(e) => setProjectIdInput(e.target.value)}
                                  placeholder="your-project-id"
                                  className="flex-1 min-w-0 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-key/40 focus:ring-1 focus:ring-key/20 transition-all"
                                />
                                {projectIdInput.trim() !== (projectId || '') && projectIdInput.trim() && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      const pid = projectIdInput.trim();
                                      await window.electronAPI?.googleAuthSetProject?.(pid);
                                      setProjectId(pid);
                                      setVertexProjectId(pid);
                                      onNotification(t('appSettingsModal.projectIdUpdated', language), 'success');
                                    }}
                                    className="px-3 py-2 text-xs font-medium rounded-lg bg-key/20 hover:bg-key/30 text-key border border-key/20 transition-colors cursor-pointer flex-shrink-0"
                                  >
                                    {t('appSettingsModal.saveProjectId', language)}
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* 액션 버튼 */}
                            <div className="flex gap-2 pt-1 flex-wrap">
                              <button
                                onClick={(e) => { e.stopPropagation(); setProjectId(null); setProjectList([]); fetchProjects(); }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-zinc-300 border border-white/[0.08] transition-colors cursor-pointer"
                              >
                                {t('appSettingsModal.changeProject', language)}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGoogleReconnect(); }}
                                disabled={isLoggingIn}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.07] hover:bg-white/[0.12] text-zinc-300 border border-white/[0.08] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {isLoggingIn ? (
                                  <span className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                                    {t('appSettingsModal.processing', language)}
                                  </span>
                                ) : t('appSettingsModal.switchAccount', language)}
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGcloudDisconnect(); }}
                                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/[0.04] hover:bg-red-500/15 text-zinc-500 hover:text-red-300 border border-white/[0.05] hover:border-red-500/20 transition-colors cursor-pointer"
                              >
                                {t('appSettingsModal.disconnect', language)}
                              </button>
                            </div>
                            {loginError && (
                              <p className="text-xs text-red-400 mt-1">{loginError}</p>
                            )}
                          </div>
                        ) : isLoggedIn ? (
                          /* ── 프로젝트 선택 단계 ── */
                          <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-key animate-pulse flex-shrink-0" />
                              <span className="text-xs font-semibold text-white">{t('appSettingsModal.accountConnected', language)}</span>
                            </div>
                            {accountEmail && (
                              <p className="text-xs text-zinc-400">{accountEmail}</p>
                            )}

                            {isLoadingProjects ? (
                              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                                <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin flex-shrink-0" />
                                <span className="text-xs text-zinc-300">{t('appSettingsModal.loadingProjects', language)}</span>
                              </div>
                            ) : projectList.length > 0 ? (
                              <div className="flex flex-col gap-2">
                                <p className="text-[11px] text-zinc-500">{t('appSettingsModal.clickProjectBelow', language)}</p>
                                {projectList.length > 5 && (
                                  <input
                                    type="text"
                                    value={projectFilter}
                                    onChange={(e) => setProjectFilter(e.target.value)}
                                    placeholder={t('appSettingsModal.searchProject', language)}
                                    className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-key/40 focus:ring-1 focus:ring-key/20 transition-all"
                                  />
                                )}
                                <div className="max-h-48 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/20">
                                  {projectList
                                    .filter(p => !projectFilter || p.projectId.includes(projectFilter.toLowerCase()) || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
                                    .map((p) => (
                                      <button
                                        key={p.projectId}
                                        onClick={(e) => { e.stopPropagation(); handleSelectProject(p.projectId); }}
                                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-white/[0.06] transition-colors border-b border-white/[0.04] last:border-b-0 cursor-pointer flex items-center gap-2.5 group"
                                      >
                                        <div className="w-3 h-3 rounded-full border border-zinc-600 group-hover:border-key/70 group-hover:bg-key/10 flex-shrink-0 transition-all" />
                                        <span className="font-medium text-zinc-200">{p.projectId}</span>
                                        {p.name !== p.projectId && (
                                          <span className="ml-2 text-zinc-500">{p.name}</span>
                                        )}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-2">
                                <p className="text-xs text-zinc-500">{t('appSettingsModal.projectNotFound', language)}</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={projectIdInput}
                                    onChange={(e) => setProjectIdInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && projectIdInput.trim()) handleSelectProject(projectIdInput.trim()); }}
                                    placeholder="your-project-id"
                                    className="flex-1 min-w-0 bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder-zinc-600 outline-none focus:border-key/40 focus:ring-1 focus:ring-key/20 transition-all"
                                  />
                                  <button
                                    onClick={(e) => { e.stopPropagation(); if (projectIdInput.trim()) handleSelectProject(projectIdInput.trim()); }}
                                    disabled={!projectIdInput.trim()}
                                    className="px-3 py-2 text-xs font-medium rounded-lg bg-key/20 hover:bg-key/30 text-key border border-key/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                                  >
                                    {t('appSettingsModal.confirm', language)}
                                  </button>
                                </div>
                              </div>
                            )}

                            {loginError && (
                              <p className="text-xs text-red-400">{loginError}</p>
                            )}
                          </div>
                        ) : (
                          /* ── 연결 안 됨 ── */
                          <div className="flex flex-col gap-3">
                            {/* 연결 버튼 / 인증 진행 중 */}
                            {isLoggingIn ? (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                                  <div className="w-4 h-4 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin flex-shrink-0" />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs font-semibold text-zinc-200">{t('appSettingsModal.browserAuthInProgress', language)}</span>
                                    <span className="text-xs text-zinc-500">{t('appSettingsModal.allowGoogleAuth', language)}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleGoogleCancel(); }}
                                  className="w-full px-4 py-2 text-sm font-medium rounded-xl bg-white/[0.05] hover:bg-white/[0.10] text-zinc-400 hover:text-zinc-200 border border-white/[0.08] transition-colors cursor-pointer"
                                >
                                  {t('settings.google.cancel', language)}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleGoogleConnect(); }}
                                className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 text-sm font-semibold rounded-xl bg-white text-black hover:bg-zinc-100 active:scale-[0.98] transition-all cursor-pointer"
                              >
                                <img src={VERTEXAIICON_ICON} alt="" className="w-4 h-4" />
                                {t('appSettingsModal.connectGoogle', language)}
                              </button>
                            )}

                            {loginError && (
                              <div className="flex flex-col gap-2">
                                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                  <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                  </svg>
                                  <p className="text-xs text-red-300 leading-relaxed">{loginError}</p>
                                </div>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setLoginError(null); handleGoogleConnect(); }}
                                  className="w-full px-4 py-2 text-xs font-semibold rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 border border-white/[0.10] transition-colors cursor-pointer"
                                >
                                  {t('appSettingsModal.retry', language)}
                                </button>
                              </div>
                            )}

                            {/* 안내 */}
                            <div className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                              <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                              </svg>
                              <p className="text-xs text-zinc-500 leading-relaxed">
                                {t('appSettingsModal.clickToConnect', language)}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      authMode === 'openai' ? (
                        <OpenAIApiSection onNotification={onNotification} isOpen={isOpen && authMode === 'openai'} />
                      ) : authMode === 'flux' ? (
                        <FluxApiSection onNotification={onNotification} isOpen={isOpen && authMode === 'flux'} />
                      ) : (
                        <div className="flex flex-col gap-4">
                          {/* Google AI Studio 활성화 행 */}
                          <div className="flex items-center justify-between gap-4 pb-3 border-b border-white/[0.08]">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={GOOGLEAISTUDIOICON_ICON} alt="" className="w-4 h-4 flex-shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-medium text-zinc-200">{t('appSettingsModal.gasActivationLabel', language)}</span>
                                  <Tooltip tip={t('appSettingsModal.gasActivationTooltip', language)} position="right" tipClassName="max-w-xs">
                                    <span className="flex items-center cursor-default">
                                      <InfoIcon className="w-3.5 h-3.5 text-zinc-600 hover:text-zinc-400 transition-colors" />
                                    </span>
                                  </Tooltip>
                                </div>
                                <p className="text-xs text-zinc-500 mt-0.5">{t('appSettingsModal.gasCallingAccount', language)}</p>
                              </div>
                            </div>
                            <ToggleSwitch
                              checked={geminiBackend === 'apiKey'}
                              onChange={(enabled) => {
                                setGeminiApiKeyActive(enabled);
                                setGeminiBackendState(getGeminiBackend());
                              }}
                            />
                          </div>
                          <GoogleAIApiSection onNotification={onNotification} />
                        </div>
                      )
                    )}
                  </div>
                </FlatSection>

                {/* Credit Settings Section - Google AI Studio only */}
                {authMode === 'apiKey' && (
                  <FlatSection>
                    <div className="pt-4 pb-1">
                      <FlatSectionHeader label={t('appSettingsModal.creditTitle' as TranslationKey, language)} />
                    </div>

                    {/* Monthly Credit row */}
                    <FlatSettingRow
                      icon={<CreditCardIcon className="w-4 h-4" />}
                      label={t('appSettingsModal.maxCreditLabel' as TranslationKey, language)}
                      control={
                        <div className="flex items-center gap-2">
                          {isEditingTotalCredit ? (
                            <input
                              ref={totalCreditInputRef}
                              type="text"
                              value={totalCreditInput}
                              onChange={(e) => setTotalCreditInput(e.target.value.replace(/[^0-9.]/g, ''))}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleTotalCreditUpdate(); if (e.key === 'Escape') { setIsEditingTotalCredit(false); setTotalCreditInput(monthlyCredit.total.toFixed(2)); } }}
                              onBlur={handleTotalCreditUpdate}
                              className="w-20 bg-black/30 border border-white/20 rounded-lg px-2 py-1 text-xs text-zinc-200 text-right outline-none focus:ring-1 focus:ring-white/30"
                            />
                          ) : (
                            <button
                              onClick={() => setIsEditingTotalCredit(true)}
                              className="text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                              title={t('tooltip.editTotalCredit' as TranslationKey, language)}
                            >
                              ${monthlyCredit.total.toFixed(2)}
                            </button>
                          )}
                        </div>
                      }
                    >
                      <div title={t('tooltip.monthlyCreditProgressBar' as TranslationKey, language)}>
                        <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${monthlyCreditPercentage}%`, backgroundColor: '#a1a1aa' }} />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[11px] text-zinc-600">${monthlyCredit.current.toFixed(2)} / ${monthlyCredit.total.toFixed(2)}</span>
                          <span className="text-[11px] text-zinc-600">{monthlyCreditPercentage.toFixed(1)}%</span>
                        </div>
                      </div>
                    </FlatSettingRow>

                    {/* Manual Credit Adjustment row */}
                    <FlatSettingRow
                      icon={<SlidersIcon className="w-4 h-4" />}
                      label={t('creditAdjustment.usedAmount' as TranslationKey, language)}
                      control={
                        <div className="flex items-center gap-2" title={t('tooltip.creditAdjustment' as TranslationKey, language)}>
                          <input
                            type="text"
                            value={manualUsedCredit === '' ? '' : Number(manualUsedCredit).toFixed(2)}
                            onChange={(e) => onManualUsedCreditChange(e.target.value.replace(/[^0-9.]/g, ''))}
                            onBlur={onCreditInputBlur}
                            className="w-20 bg-black/30 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-zinc-200 text-right outline-none focus:ring-1 focus:ring-white/20"
                          />
                          <button
                            onClick={onUpdateCredit}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white/10 text-zinc-200 hover:bg-white/20 transition-colors duration-150 border border-white/10 cursor-pointer"
                          >
                            {t('creditAdjustment.updateButton' as TranslationKey, language)}
                          </button>
                        </div>
                      }
                    />

                    {/* Show Credit toggle row */}
                    <FlatSettingRow
                      icon={<EyeOpenIcon className="w-4 h-4" />}
                      label={t('settings.showCreditInLeftPanel' as TranslationKey, language)}
                      description={t('settings.showCreditInLeftPanelDescription' as TranslationKey, language)}
                      control={<ShowCreditToggle />}
                      noBorder
                    />
                    <div className="pb-2" />
                  </FlatSection>
                )}

                {/* Model Pricing Info */}
                <SettingsPanel>
                  <SectionHeader label={t('settings.pricingPopoverTitle' as TranslationKey, language)} />
                  <div className="px-6 pb-5">

                  {/* Pricing category tab nav */}
                  <div className="flex gap-1.5 mb-4 mt-1">
                    {(['gemini', 'openai', 'flux'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setPricingTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          pricingTab === tab
                            ? 'border-yellow-500/50 text-yellow-300 bg-yellow-500/10'
                            : 'border-white/10 text-zinc-500 hover:text-zinc-300 hover:border-white/20'
                        }`}
                      >
                        {t(`settings.pricing.tab.${tab}` as TranslationKey, language)}
                      </button>
                    ))}
                  </div>

                  {/* ── Gemini tab ── */}
                  {pricingTab === 'gemini' && (
                    <>
                      <p className="text-xs text-zinc-500 mb-3">
                        {t('settings.pricing.perImage' as TranslationKey, language)}
                      </p>
                      <div className="grid grid-cols-3 gap-3">
                        {/* ① Nano Banana1 — gemini-2.5-flash-image (green) */}
                        <div className="p-3 rounded-xl bg-green-500/[0.04] border border-green-500/20 flex flex-col gap-2">
                          <span className="text-xs px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20 font-medium self-start">
                            {t('settings.pricing.fastestBadge' as TranslationKey, language)}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">Nano Banana1</p>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">gemini-2.5-flash-image</p>
                          </div>
                          <div className="space-y-1 pt-1 border-t border-green-500/[0.12]">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500">{t('settings.pricing.1kDefault', language)}</span>
                              <span className="text-xs font-medium text-green-300">$0.039</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-zinc-500">Batch 50% ↓</span>
                              <span className="text-xs font-medium text-green-400/70">$0.0195</span>
                            </div>
                          </div>
                          <p className="text-xs text-zinc-600 pt-0.5">{t('settings.pricing.allResFlat' as TranslationKey, language)}</p>
                        </div>

                        {/* ② Nano Banana Pro — gemini-3-pro (blue/center) */}
                        <div className="p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/30 flex flex-col gap-2 ring-1 ring-blue-500/10">
                          <span className="text-xs px-1.5 py-0.5 bg-blue-500/15 text-blue-300 rounded border border-blue-500/30 font-semibold self-start">Pro</span>
                          <div>
                            <p className="text-sm font-semibold text-zinc-100">Nano Banana Pro</p>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">gemini-3-pro-image</p>
                          </div>
                          <div className="space-y-1 pt-1 border-t border-blue-500/[0.15]">
                            {[{ label: '1K / 2K', price: '$0.134' }, { label: '4K (~16MP)', price: '$0.240' }].map(({ label, price }) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500">{label}</span>
                                <span className="text-xs font-medium text-blue-300">{price}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-600 pt-0.5">{t('settings.pricing.variesByRes' as TranslationKey, language)}</p>
                        </div>

                        {/* ③ Nano Banana2 — gemini-3.1-flash (yellow) */}
                        <div className="p-3 rounded-xl bg-yellow-500/[0.04] border border-yellow-500/20 flex flex-col gap-2">
                          <span className="text-xs px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded border border-yellow-500/20 font-medium self-start">Latest</span>
                          <div>
                            <p className="text-sm font-medium text-zinc-200">Nano Banana2</p>
                            <p className="text-xs text-zinc-500 font-mono mt-0.5 truncate">gemini-3.1-flash-image</p>
                          </div>
                          <div className="space-y-1 pt-1 border-t border-yellow-500/[0.12]">
                            {[
                              { label: '0.5K (512px)', price: '$0.045' },
                              { label: '1K (~1MP)', price: '$0.067' },
                              { label: '2K (~4MP)', price: '$0.101' },
                              { label: '4K (~16MP)', price: '$0.150' },
                            ].map(({ label, price }) => (
                              <div key={label} className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500">{label}</span>
                                <span className="text-xs font-medium text-yellow-300">{price}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-zinc-600 pt-0.5">{t('settings.pricing.variesByRes' as TranslationKey, language)}</p>
                        </div>
                      </div>

                      {/* Usage examples */}
                      <div className="mt-3 p-2.5 rounded-lg bg-black/20 border border-white/[0.06]">
                        <p className="text-xs text-zinc-500 font-medium mb-1.5">{t('settings.pricing.usageExamples' as TranslationKey, language)}</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-zinc-500">
                          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500 flex-shrink-0"></span><span>{t('settings.pricing.flashExample', language)}</span></div>
                          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0"></span><span>{t('settings.pricing.basicExample' as TranslationKey, language)}</span></div>
                          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-500 flex-shrink-0"></span><span>{t('settings.pricing.flashBulkExample', language)}</span></div>
                          <div className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-zinc-400 flex-shrink-0"></span><span>{t('settings.pricing.proExample' as TranslationKey, language)}</span></div>
                        </div>
                      </div>
                      <p className="text-xs text-zinc-600 mt-3 leading-relaxed">
                        {t('settings.pricing.disclaimer' as TranslationKey, language)}{' '}
                        <button onClick={() => window.electronAPI?.openExternal?.('https://ai.google.dev/pricing')} className="text-zinc-500 underline hover:text-zinc-400 transition-colors duration-200 cursor-pointer">
                          {t('settings.pricing.officialLink' as TranslationKey, language)} ↗
                        </button>
                      </p>
                    </>
                  )}

                  {/* ── OpenAI tab ── */}
                  {pricingTab === 'openai' && (
                    <div className="p-4 rounded-xl bg-zinc-500/[0.04] border border-zinc-500/20 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{t('settings.pricing.openai.title' as TranslationKey, language)}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">gpt-image-2</p>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 bg-zinc-500/15 text-zinc-300 rounded border border-zinc-500/30 font-medium">OpenAI</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-zinc-500/[0.15]">
                        {[
                          { label: t('settings.pricing.openai.lowLabel' as TranslationKey, language), price: '$0.006', badge: '' },
                          { label: t('settings.pricing.openai.medLabel' as TranslationKey, language), price: '$0.053', badge: t('settings.pricing.openai.standardBadge' as TranslationKey, language) },
                          { label: t('settings.pricing.openai.highLabel' as TranslationKey, language), price: '$0.211', badge: '' },
                        ].map(({ label, price, badge }) => (
                          <div key={label} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-400">{label}</span>
                              {badge && <span className="text-[10px] px-1 py-0.5 bg-zinc-500/20 text-zinc-400 rounded">{badge}</span>}
                            </div>
                            <span className="text-xs font-medium text-zinc-200">{price}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">{t('settings.pricing.openai.note' as TranslationKey, language)}</p>
                      <button
                        onClick={() => window.electronAPI?.openExternal?.('https://developers.openai.com/api/docs/guides/image-generation')}
                        className="text-xs text-zinc-500 underline hover:text-zinc-400 transition-colors duration-200 cursor-pointer self-start"
                      >
                        {t('settings.pricing.openai.officialLink' as TranslationKey, language)} ↗
                      </button>
                    </div>
                  )}

                  {/* ── Flux tab ── */}
                  {pricingTab === 'flux' && (
                    <div className="p-4 rounded-xl bg-orange-500/[0.04] border border-orange-500/20 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{t('settings.pricing.flux.title' as TranslationKey, language)}</p>
                          <p className="text-xs text-zinc-500 font-mono mt-0.5">api.bfl.ai/v1/flux-2-max</p>
                        </div>
                        <span className="text-xs px-1.5 py-0.5 bg-orange-500/15 text-orange-300 rounded border border-orange-500/30 font-medium">BFL</span>
                      </div>
                      <div className="space-y-1.5 pt-2 border-t border-orange-500/[0.15]">
                        {[
                          { label: '0.6 MP', price: '$0.042', badge: '' },
                          { label: '1 MP',   price: '$0.070', badge: t('settings.pricing.flux.defaultBadge' as TranslationKey, language) },
                          { label: '2 MP',   price: '$0.140', badge: t('settings.pricing.flux.recommendedBadge' as TranslationKey, language) },
                          { label: '4 MP',   price: '$0.280', badge: '' },
                        ].map(({ label, price, badge }) => (
                          <div key={label} className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-zinc-400">{label}</span>
                              {badge && <span className="text-[10px] px-1 py-0.5 bg-orange-500/20 text-orange-400 rounded">{badge}</span>}
                            </div>
                            <span className="text-xs font-medium text-orange-200">{price}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-600 leading-relaxed">{t('settings.pricing.flux.note' as TranslationKey, language)}</p>
                      <button
                        onClick={() => window.electronAPI?.openExternal?.('https://docs.bfl.ai/quick_start/pricing')}
                        className="text-xs text-zinc-500 underline hover:text-zinc-400 transition-colors duration-200 cursor-pointer self-start"
                      >
                        {t('settings.pricing.flux.officialLink' as TranslationKey, language)} ↗
                      </button>
                    </div>
                  )}

                  </div>
                </SettingsPanel>

              </div>
            )}



            {activeTab === 'shortcuts' && (
              <div className="animate-category-fade-in space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-base font-bold text-zinc-200">{t('appSettingsModal.shortcutsTitle', language)}</h3>
                  <button onClick={resetShortcuts} className="px-4 py-2 text-sm font-medium rounded-xl bg-white/[0.05] hover:bg-white/10 text-zinc-300 border border-white/[0.08] transition-colors duration-150 cursor-pointer">{t('appSettingsModal.resetDefaults', language)}</button>
                </div>
                <p className="text-sm text-zinc-500 mb-4">{t('appSettingsModal.shortcutsDescription', language)}</p>
                <div className="space-y-4">
                  {Object.entries(shortcutCategories).map(([category, actions]) => (
                    <SettingsPanel key={category}>
                      <SectionHeader label={
                        category === 'general' ? t('shortcuts.general', language) :
                        category === 'editing' ? t('shortcuts.editing', language) :
                        category === 'generation' ? t('shortcuts.generation', language) :
                        category === 'tools' ? t('shortcuts.tools', language) : category
                      } />
                      {actions.map((action, idx) => (
                        <div key={action} className={`flex items-center justify-between px-6 py-3.5 hover:bg-white/[0.025] transition-colors duration-150 ${idx < actions.length - 1 ? 'border-b border-white/[0.06]' : ''}`}>
                          <span className="text-sm font-medium text-zinc-300">{t(`shortcut.${action}` as TranslationKey, language)}</span>
                          {listeningFor === action ? (
                            <div className="flex items-center gap-2">
                              <div className="px-5 py-1.5 text-sm font-mono tracking-wider rounded-lg bg-zinc-200 text-zinc-900 min-w-[130px] text-center border border-zinc-300">
                                {pendingShortcut ? formatShortcut(pendingShortcut) : t('appSettingsModal.listening', language)}
                              </div>
                              <button
                                onClick={handleConfirmShortcut}
                                disabled={!pendingShortcut}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-200 hover:bg-white text-zinc-900 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                {t('appSettingsModal.confirm' as TranslationKey, language)}
                              </button>
                              <button
                                onClick={handleCancelShortcut}
                                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300 transition-colors duration-150 cursor-pointer"
                              >
                                {t('appSettingsModal.cancelShortcut' as TranslationKey, language)}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setListeningFor(action); setPendingShortcut(null); }}
                              className="px-5 py-1.5 text-sm font-mono tracking-wider rounded-lg transition-colors duration-150 min-w-[130px] text-center bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-white/[0.08] cursor-pointer"
                            >
                              {shortcuts[action] ? formatShortcut(shortcuts[action]) : 'N/A'}
                            </button>
                          )}
                        </div>
                      ))}
                    </SettingsPanel>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'presets' && (
              <div className="animate-category-fade-in h-full flex flex-col">
                <div className="flex-shrink-0 flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-zinc-200">{t('appSettingsModal.presetTitle', language)}</h3>
                  <div className="flex items-center gap-2">
                    <Tooltip tip={t('presets.exportTooltip', language)}>
                      <button onClick={handleExportPresets} disabled={folders.length === 0} className="px-4 py-2 text-sm font-semibold rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50 border border-white/10 flex items-center gap-2">
                        <DownloadIcon className="w-4 h-4" />
                        {t('presets.export', language)}
                      </button>
                    </Tooltip>
                    <Tooltip tip={t('presets.importTooltip', language)}>
                      <button onClick={handleImportPresets} className="px-4 py-2 text-sm font-semibold rounded-xl bg-white hover:bg-zinc-200 text-black transition-colors shadow-lg flex items-center gap-2">
                        <UploadIcon className="w-4 h-4" />
                        {t('presets.import', language)}
                      </button>
                    </Tooltip>
                  </div>
                </div>
                <div className="flex-grow flex min-h-0 border border-white/[0.07] rounded-2xl bg-white/[0.03] overflow-hidden">
                  {/* Folder List */}
                  <div className="w-1/3 flex-shrink-0 border-r border-white/10 flex flex-col bg-black/10">
                    <div className="p-3 border-b border-white/5"><button onClick={handleAddFolder} className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5"><FolderPlusIcon className="w-5 h-5" /><span>{t('presets.newFolder', language)}</span></button></div>
                    <div className="flex-grow relative min-h-0">
                    <div ref={folderListScrollRef} className="h-full overflow-y-auto px-2 py-2 space-y-0.5 dark-glass-scrollbar">
                      {folders.length === 0 ? <p className="text-center text-sm text-zinc-500 p-8">{t('presets.noFolders', language)}</p> : folders.map(folder => (
                        <div key={folder.id} className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${selectedFolderId === folder.id ? 'bg-white text-black shadow-lg' : 'hover:bg-white/5 text-zinc-300'}`} onClick={() => setSelectedFolderId(folder.id)}>
                          {editingFolder?.id === folder.id ? <input type="text" value={editingFolder.name} onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })} onBlur={handleRenameFolder} onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()} autoFocus className="bg-black/30 w-full outline-none text-white font-bold text-sm rounded px-1" /> : <span className="truncate font-bold text-sm">{folder.name}</span>}
                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                            <Tooltip tip={t('presets.toggleQuickBar', language)}><button onClick={(e) => { e.stopPropagation(); handleToggleQuickBar(folder.id); }} className={`p-1 rounded-md hover:bg-black/10 ${folder.showInQuickBar ? 'text-yellow-500' : 'text-zinc-400'}`}><StarIcon className="w-3.5 h-3.5" filled={folder.showInQuickBar ?? true} /></button></Tooltip>
                            <button onClick={(e) => { e.stopPropagation(); setEditingFolder({ id: folder.id, name: folder.name }); }} className="p-1 hover:bg-black/10 rounded-md text-zinc-400 hover:text-black"><PencilIcon className="w-3.5 h-3.5" /></button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }} className="p-1 hover:bg-red-500/20 rounded-md text-zinc-400 hover:text-red-500"><TrashIcon className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <HoverEdgeAutoScroll targetRef={folderListScrollRef} />
                    </div>
                  </div>
                  {/* Preset List */}
                  <div className="w-2/3 relative min-h-0">
                  <div ref={presetListScrollRef} className="h-full overflow-y-auto p-4 dark-glass-scrollbar">
                    {!selectedFolder ? (folders.length > 0 && <div className="flex items-center justify-center h-full text-zinc-500"><p>{t('presets.selectFolder', language)}</p></div>) : (<>
                      {selectedFolder.presets.length === 0 ? <p className="text-center text-sm text-zinc-500 pt-8">{t('presets.noPresets', language)}</p> : (
                        <div className="space-y-3">
                          {selectedFolder.presets.map(preset => (editingPreset?.id === preset.id ? (
                            <div key={preset.id} className="bg-neutral-800/80 p-4 rounded-xl border border-white/10 shadow-lg"><div className="flex flex-col gap-3">
                              <input type="text" value={editingPreset.name} onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm font-bold text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none" />
                              <textarea value={editingPreset.prompt} onChange={(e) => setEditingPreset({ ...editingPreset, prompt: e.target.value })} className="w-full bg-black/30 border border-white/10 rounded-lg py-2 px-3 text-sm text-zinc-300 placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none resize-y" rows={4} />
                              <div className="flex justify-end gap-2 mt-1">
                                <button onClick={() => setEditingPreset(null)} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/5">{t('presets.cancel', language)}</button>
                                <button onClick={handleSavePresetEdit} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors shadow-md">{t('presets.save', language)}</button>
                              </div>
                            </div></div>
                          ) : (
                            <div key={preset.id} className="group bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all duration-200">
                              <div className="flex items-start gap-3">
                                <div className="flex-grow min-w-0">
                                  <h4 className="text-sm font-bold text-zinc-100 mb-1">{preset.name}</h4>
                                  <p className="text-xs text-zinc-400 max-h-28 overflow-y-auto whitespace-pre-wrap leading-relaxed dark-glass-scrollbar">{preset.prompt}</p>
                                </div>
                                <div className="flex-shrink-0 flex flex-col items-end gap-1">
                                  <button onClick={() => { onLoadPrompt(preset.prompt); onClose(); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white text-white hover:text-black transition-colors border border-white/10">{t('presets.usePreset', language)}</button>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingPreset(preset)} className="p-1 hover:text-white text-zinc-400 rounded-md hover:bg-white/10"><PencilIcon className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => handleDeletePreset(preset.id)} className="p-1 hover:text-red-400 text-zinc-400 rounded-md hover:bg-red-500/20"><TrashIcon className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )))}
                        </div>
                      )}
                      <div className="mt-6 pt-6 border-t border-white/10"><h4 className="text-sm font-bold text-zinc-100 mb-3">{t('presets.addNewPresetTitle', language)}</h4><div className="flex flex-col gap-3 bg-black/20 p-4 rounded-xl border border-white/5">
                        <input type="text" placeholder={t('presets.presetNamePlaceholder', language)} value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none" />
                        <textarea placeholder={t('presets.promptContentPlaceholder', language)} value={newPresetPrompt} onChange={(e) => setNewPresetPrompt(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg py-2.5 px-3 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-white/30 outline-none resize-y" rows={3} />
                        <button onClick={handleAddNewPreset} disabled={!selectedFolderId || !newPresetName.trim() || !newPresetPrompt.trim()} className="mt-1 self-end px-5 py-2 text-sm font-semibold rounded-lg bg-white hover:bg-zinc-200 text-black transition-colors disabled:opacity-50 shadow-md">{t('presets.addPresetButton', language)}</button>
                      </div></div>
                    </>)}
                  </div>
                  <HoverEdgeAutoScroll targetRef={presetListScrollRef} />
                  </div>
                </div>
              </div>
            )}
          </main>
          <HoverEdgeAutoScroll targetRef={mainScrollRef} />
          </div>
        </div >
      </div >
    </div >
  );
};
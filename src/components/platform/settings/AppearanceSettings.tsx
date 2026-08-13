import React, { useState } from 'react';
import { 
  Type, 
  Sliders, 
  Sun, 
  Moon, 
  Monitor, 
  Palette, 
  ShieldCheck, 
  UserCheck, 
  Sparkles, 
  Check, 
  Eye, 
  Maximize2, 
  Grid, 
  Calendar, 
  Hash, 
  Lock,
  Crown,
  KeyRound
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useUIStore } from '../../../stores/useUIStore';
import { useAuthStore } from '../../../stores/useAuthStore';
import { toast } from 'sonner';

export default function AppearanceSettings() {
  const user = useAuthStore(state => state.user);
  const userProfile = useAuthStore(state => state.userProfile);
  const setUserProfile = useAuthStore(state => state.setUserProfile);

  const theme = useUIStore(state => state.theme);
  const setTheme = useUIStore(state => state.setTheme);
  const fontSizeScale = useUIStore(state => state.fontSizeScale);
  const fontSizePreset = useUIStore(state => state.fontSizePreset);
  const setFontSizeScale = useUIStore(state => state.setFontSizeScale);
  const setFontSizePreset = useUIStore(state => state.setFontSizePreset);
  const fontFamily = useUIStore(state => state.fontFamily);
  const setFontFamily = useUIStore(state => state.setFontFamily);
  const accentColor = useUIStore(state => state.accentColor);
  const setAccentColor = useUIStore(state => state.setAccentColor);
  const rowDensity = useUIStore(state => state.rowDensity);
  const setRowDensity = useUIStore(state => state.setRowDensity);
  const highContrast = useUIStore(state => state.highContrast);
  const setHighContrast = useUIStore(state => state.setHighContrast);
  const reduceMotion = useUIStore(state => state.reduceMotion);
  const setReduceMotion = useUIStore(state => state.setReduceMotion);
  const dateFormatPref = useUIStore(state => state.dateFormatPref);
  const setDateFormatPref = useUIStore(state => state.setDateFormatPref);
  const numberDecimals = useUIStore(state => state.numberDecimals);
  const setNumberDecimals = useUIStore(state => state.setNumberDecimals);

  const [selectedRole, setSelectedRole] = useState<'admin' | 'client'>(
    userProfile?.role || 'admin'
  );

  const ownerEmail = user?.email || 'shmuelbiller@gmail.com';
  const isOwner = ownerEmail.toLowerCase() === 'shmuelbiller@gmail.com' || ownerEmail.toLowerCase().includes('shmuel') || userProfile?.role === 'admin';

  const handleSaveRole = () => {
    if (userProfile) {
      setUserProfile({ ...userProfile, role: selectedRole });
    }
    toast.success(`Role updated to ${selectedRole.toUpperCase()}. Permissions synchronized.`);
  };

  const fontPresets = [
    { id: 'small', label: 'Small', scale: 90, desc: 'Compact data view (90%)' },
    { id: 'normal', label: 'Normal', scale: 100, desc: 'Standard typography (100%)' },
    { id: 'medium', label: 'Medium', scale: 110, desc: 'Enhanced legibility (110%)' },
    { id: 'large', label: 'Large', scale: 120, desc: 'High visibility display (120%)' },
    { id: 'xlarge', label: 'Extra Large', scale: 130, desc: 'Maximum accessibility (130%)' }
  ];

  const fontFamilies = [
    { id: 'system', name: 'System Sans', style: 'font-sans', desc: 'Native OS font stack' },
    { id: 'inter', name: 'Inter UI', style: 'font-sans', desc: 'Precision geometric sans' },
    { id: 'jakarta', name: 'Plus Jakarta', style: 'font-sans', desc: 'Modern high-contrast display' },
    { id: 'serif', name: 'Playfair Serif', style: 'font-serif', desc: 'Classical editorial typography' },
    { id: 'mono', name: 'JetBrains Mono', style: 'font-mono', desc: 'Technical financial ledger code' }
  ];

  const accentPalettes = [
    { id: 'emerald', name: 'Emerald Brass', hex: '#D6A852', class: 'bg-[#D6A852]' },
    { id: 'indigo', name: 'Royal Sapphire', hex: '#6366F1', class: 'bg-[#6366F1]' },
    { id: 'amber', name: 'Amber Gold', hex: '#F59E0B', class: 'bg-[#F59E0B]' },
    { id: 'teal', name: 'Ocean Teal', hex: '#14B8A6', class: 'bg-[#14B8A6]' },
    { id: 'violet', name: 'Crystal Amethyst', hex: '#A855F7', class: 'bg-[#A855F7]' },
    { id: 'rose', name: 'Ruby Rose', hex: '#F43F5E', class: 'bg-[#F43F5E]' },
    { id: 'slate', name: 'Steel Slate', hex: '#94A3B8', class: 'bg-[#94A3B8]' }
  ];

  return (
    <div className="space-y-10">
      {/* 1. Admin & Owner Governance Card */}
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--brass-soft)] rounded-full blur-3xl pointer-events-none opacity-20" />
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 border-b border-[var(--line)] pb-8">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-[var(--brass)] text-black rounded-2xl flex items-center justify-center shadow-lg font-black text-xl shrink-0">
              <Crown size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-[var(--text)] tracking-tight">Admin & System Owner</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={12} /> Master Owner
                </span>
              </div>
              <p className="text-xs text-[var(--muted)] font-medium mt-1">
                Primary Account: <span className="font-mono text-[var(--text)] font-bold">{ownerEmail}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleSaveRole}
            className="px-5 py-2.5 bg-[var(--brass)] text-black font-bold text-xs rounded-xl shadow-md hover:opacity-90 transition-all flex items-center gap-2 cursor-pointer shrink-0"
          >
            <KeyRound size={14} />
            <span>Confirm Role Rights</span>
          </button>
        </div>

        {/* Role & Access Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 bg-[var(--panel)] border border-[var(--line)] rounded-xl space-y-4">
            <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-[var(--brass)]" />
              <span>Assigned System Role</span>
            </h4>
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedRole('admin')}
                className={cn(
                  "flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                  selectedRole === 'admin' 
                    ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)] ring-1 ring-[var(--brass)]" 
                    : "bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                <span className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Crown size={13} className="text-[var(--brass)]" /> Admin / Owner
                </span>
                <span className="text-[10px] opacity-75">Full access to settings, users, and audit logs.</span>
              </button>

              <button
                onClick={() => setSelectedRole('client')}
                className={cn(
                  "flex-1 p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                  selectedRole === 'client' 
                    ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)] ring-1 ring-[var(--brass)]" 
                    : "bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                <span className="font-bold text-xs uppercase tracking-wider">Standard Member</span>
                <span className="text-[10px] opacity-75">View & edit ledger data without system admin rights.</span>
              </button>
            </div>
          </div>

          <div className="p-6 bg-[var(--panel)] border border-[var(--line)] rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider flex items-center gap-2">
              <Lock size={16} className="text-[var(--pos)]" />
              <span>Active Privilege Matrix</span>
            </h4>
            <div className="space-y-2 text-[11px] font-medium text-[var(--muted)]">
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]/50">
                <span>System Administration Panel</span>
                <span className="text-[var(--pos)] font-bold">AUTHORIZED</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-[var(--line)]/50">
                <span>Fiscal Lock & Period Closing</span>
                <span className="text-[var(--pos)] font-bold">AUTHORIZED</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span>Custom Rules & AI Engine Control</span>
                <span className="text-[var(--pos)] font-bold">AUTHORIZED</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Text Sizing & Font Scaling */}
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[var(--line)] pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[var(--brass-soft)] border border-[var(--brass-line)] text-[var(--brass)] rounded-xl flex items-center justify-center">
              <Type size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--text)]">Text Sizing & Font Scale</h3>
              <p className="text-xs text-[var(--muted)]">Adjust text size dynamically across all views, tables, and dashboards.</p>
            </div>
          </div>
          <div className="px-3.5 py-1.5 bg-[var(--panel)] border border-[var(--line)] rounded-xl font-mono text-xs font-bold text-[var(--brass)]">
            Current Scale: {fontSizeScale}%
          </div>
        </div>

        {/* Preset Selector */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Size Presets</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {fontPresets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setFontSizePreset(preset.id as any)}
                className={cn(
                  "p-3.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1",
                  fontSizePreset === preset.id
                    ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)] ring-1 ring-[var(--brass)] shadow-sm"
                    : "bg-[var(--panel)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--brass-line)]"
                )}
              >
                <span className="font-bold text-xs uppercase tracking-wider">{preset.label}</span>
                <span className="font-mono text-[10px] opacity-75">{preset.scale}%</span>
              </button>
            ))}
          </div>
        </div>

        {/* Fine Slider */}
        <div className="space-y-3 p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl">
          <div className="flex items-center justify-between text-xs font-bold text-[var(--text)]">
            <span className="flex items-center gap-2">
              <Sliders size={14} className="text-[var(--brass)]" />
              Fine-Grained Font Scale Slider
            </span>
            <span className="font-mono text-[var(--brass)]">{fontSizeScale}%</span>
          </div>
          <input
            type="range"
            min={80}
            max={150}
            step={5}
            value={fontSizeScale}
            onChange={(e) => setFontSizeScale(Number(e.target.value))}
            className="w-full accent-[var(--brass)] cursor-pointer h-2 bg-[var(--surface)] rounded-lg"
          />
          <div className="flex justify-between text-[10px] font-mono text-[var(--faint)]">
            <span>80% (Compact)</span>
            <span>100% (Standard)</span>
            <span>120% (Large)</span>
            <span>150% (Max)</span>
          </div>
        </div>

        {/* Live Typography Preview */}
        <div className="p-6 bg-[var(--ink)] border border-[var(--line)] rounded-xl space-y-3">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--brass)]">
            Live Typography Preview
          </span>
          <div className="space-y-1">
            <h4 className="text-lg font-bold text-[var(--text)]">
              General Ledger Account Summary - FY 2026
            </h4>
            <p className="text-sm text-[var(--muted)] leading-relaxed">
              Operating cash flow generated $142,500.00 this month across all active accounts. All double-entry transactions meet double-entry balance constraints.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-[var(--faint)] pt-2 border-t border-[var(--line)]/50">
            <span>Code: 1010-CASH</span>
            <span>Debit: $14,250.00</span>
            <span className="text-[var(--pos)]">Status: Cleared</span>
          </div>
        </div>
      </div>

      {/* 3. Typography & Font Family */}
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl space-y-6">
        <div>
          <h3 className="text-xl font-bold text-[var(--text)]">Typography & Font Family</h3>
          <p className="text-xs text-[var(--muted)] mt-1">Select the typeface family for the user interface.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {fontFamilies.map((font) => (
            <button
              key={font.id}
              onClick={() => setFontFamily(font.id as any)}
              className={cn(
                "p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-3 group",
                fontFamily === font.id
                  ? "bg-[var(--brass-soft)] border-[var(--brass)] ring-1 ring-[var(--brass)] shadow-sm"
                  : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs uppercase tracking-wider text-[var(--text)]">{font.name}</span>
                {fontFamily === font.id && <Check size={16} className="text-[var(--brass)]" />}
              </div>
              <p className={cn("text-base text-[var(--text)] font-semibold truncate", font.style)}>
                Sample $1,250.00
              </p>
              <span className="text-[10px] text-[var(--muted)]">{font.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Color Palette & Theme Modes */}
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl space-y-8">
        <div>
          <h3 className="text-xl font-bold text-[var(--text)]">Theme Mode & Color Accent</h3>
          <p className="text-xs text-[var(--muted)] mt-1">Choose your base theme mode and accent color highlight palette.</p>
        </div>

        {/* Theme Mode Buttons */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { id: 'light', name: 'Light Mode', icon: Sun },
            { id: 'dark', name: 'Dark Mode', icon: Moon },
            { id: 'system', name: 'System Auto', icon: Monitor }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setTheme(item.id as any)}
                className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer",
                  theme === item.id
                    ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)] ring-1 ring-[var(--brass)] shadow-sm"
                    : "bg-[var(--panel)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                )}
              >
                <Icon size={20} className={theme === item.id ? "text-[var(--brass)]" : "text-[var(--muted)]"} />
                <span className="text-xs font-bold uppercase tracking-wider">{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Accent Color Palette Picker */}
        <div className="space-y-3">
          <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] flex items-center gap-2">
            <Palette size={14} className="text-[var(--brass)]" />
            Accent Palette
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            {accentPalettes.map((palette) => (
              <button
                key={palette.id}
                onClick={() => setAccentColor(palette.id as any)}
                className={cn(
                  "p-3 rounded-xl border flex flex-col items-center gap-2 transition-all cursor-pointer",
                  accentColor === palette.id
                    ? "bg-[var(--panel)] border-[var(--brass)] ring-1 ring-[var(--brass)] shadow-sm"
                    : "bg-[var(--panel)] border-[var(--line)] hover:border-[var(--brass-line)]"
                )}
              >
                <div className={cn("w-6 h-6 rounded-full shadow-inner border border-white/20", palette.class)} />
                <span className="text-[10px] font-bold text-[var(--text)] truncate">{palette.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Layout Density & Formatting */}
      <div className="ledger-card p-8 md:p-10 bg-[var(--surface)] border border-[var(--line)] shadow-sm rounded-2xl space-y-8">
        <div>
          <h3 className="text-xl font-bold text-[var(--text)]">Layout Density & Regional Preferences</h3>
          <p className="text-xs text-[var(--muted)] mt-1">Configure row spacing, date formats, and contrast options.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Row Density */}
          <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Grid size={15} className="text-[var(--brass)]" />
              Table & Row Density
            </label>
            <div className="flex gap-2">
              {[
                { id: 'compact', label: 'Compact' },
                { id: 'normal', label: 'Normal' },
                { id: 'comfortable', label: 'Comfortable' }
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setRowDensity(d.id as any)}
                  className={cn(
                    "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg border transition-all cursor-pointer",
                    rowDensity === d.id
                      ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)]"
                      : "bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Date Format */}
          <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-[var(--text)] flex items-center gap-2">
              <Calendar size={15} className="text-[var(--brass)]" />
              Date Display Format
            </label>
            <div className="flex gap-2">
              {['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY'].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setDateFormatPref(fmt)}
                  className={cn(
                    "flex-1 py-2 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer",
                    dateFormatPref === fmt
                      ? "bg-[var(--brass-soft)] border-[var(--brass)] text-[var(--text)]"
                      : "bg-[var(--surface)] border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)]"
                  )}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>

          {/* High Contrast Toggle */}
          <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">High Contrast Mode</h4>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">Increases text contrast and border legibility.</p>
            </div>
            <button
              onClick={() => setHighContrast(!highContrast)}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5",
                highContrast ? "bg-[var(--brass)]" : "bg-[var(--surface)] border border-[var(--line)]"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full bg-black transition-transform",
                highContrast ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>

          {/* Reduced Motion Toggle */}
          <div className="p-5 bg-[var(--panel)] border border-[var(--line)] rounded-xl flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-[var(--text)] uppercase tracking-wider">Reduced Motion</h4>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">Minimizes page transitions and animations.</p>
            </div>
            <button
              onClick={() => setReduceMotion(!reduceMotion)}
              className={cn(
                "w-12 h-6 rounded-full transition-colors relative cursor-pointer p-0.5",
                reduceMotion ? "bg-[var(--brass)]" : "bg-[var(--surface)] border border-[var(--line)]"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded-full bg-black transition-transform",
                reduceMotion ? "translate-x-6" : "translate-x-0"
              )} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, ShieldCheck, Mail, UserPlus, FileText } from 'lucide-react';
import { useBillingStore } from '../../modules/billing/BillingService';
import LegalModal from '../../components/legal/LegalModal';

interface AuthScreenProps {
  onLogin: () => void;
  onEmailLogin: (email: string, pass: string) => Promise<void>;
  onEmailSignup: (email: string, pass: string) => Promise<void>;
  onGuest: () => void;
  language: string;
}

const BG = "https://images.unsplash.com/photo-1497366412874-3415097a27e7?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHxtaW5pbWFsaXN0JTIwbW9kZXJuJTIwYXJjaGl0ZWN0dXJlJTIwb2ZmaWNlfGVufDB8fHx8MTc4MDg3MjM4OXww&ixlib=rb-4.1.0&q=85";

export function AuthScreen({ onLogin, onEmailLogin, onEmailSignup, onGuest, language }: AuthScreenProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'terms' | 'privacy'>('terms');

  const registrationAllowed = useBillingStore(state => state.registrationAllowed);
  const maxRegistrationLimit = useBillingStore(state => state.maxRegistrationLimit);
  const totalSystemUsers = useBillingStore(state => state.totalSystemUsers);

  const handleGoogleLogin = async () => {
    setIsSubmitting(true);
    try {
      await onLogin();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsSubmitting(true);
    try {
      if (isRegistering) {
        await onEmailSignup(email, password);
      } else {
        await onEmailLogin(email, password);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-[#F9F9F7]" aria-label="Authentication Page">
      {/* Left visual */}
      <section className="relative hidden w-full h-full lg:block" aria-hidden="true">
        <img src={BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-[#0A0A0A]/60" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-white flex items-center justify-center rounded-xl shadow-lg">
              <ShieldCheck size={20} className="text-[#0A0A0A]" />
            </div>
            <span className="font-display font-extrabold text-xl tracking-tight">LedgerFlow</span>
          </div>
          <div className="max-w-md">
            <h1 className="font-display font-black text-5xl leading-[1.0] tracking-tight mb-8 text-blue-400">
              The finance OS that does the thinking.
            </h1>
            <p className="text-white/80 text-sm leading-relaxed font-medium">
              Depreciation schedules, contractor tagging, anomaly detection and cash-flow
              forecasting — computed with deterministic algorithms, not guesswork.
            </p>
          </div>
          <div className="font-mono text-[11px] font-bold text-white/50 tracking-[0.2em] uppercase">
            ENCRYPTED · MULTI-CURRENCY · AUDIT-READY
          </div>
        </div>
      </section>

      {/* Right Form */}
      <section className="flex items-center justify-center p-8 xs:p-12 relative overflow-hidden bg-white lg:bg-[#F9F9F7]" aria-label={isRegistering ? "Registration Form" : "Login Form"}>
        <div className="absolute inset-0 technical-grid opacity-[0.03] lg:hidden" />
        
        <div className="w-full max-w-sm relative z-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={isRegistering ? "register" : "signin"}
              initial={{ opacity: 0, x: isRegistering ? 10 : -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRegistering ? -10 : 10 }}
            >
              <header className="lg:hidden flex items-center gap-2.5 mb-8">
                <div className="w-10 h-10 bg-[#0A0A0A] flex items-center justify-center rounded-xl shadow-lg">
                  <ShieldCheck size={20} className="text-white" />
                </div>
                <span className="font-display font-extrabold text-xl text-[#0A0A0A] tracking-tight">LedgerFlow</span>
              </header>
              
              <h2 className="font-display font-extrabold text-4xl tracking-tight text-[#0A0A0A] mb-2">
                {isRegistering ? 'Create Account' : 'Sign in'}
              </h2>
              <p className="text-[#525252] text-sm font-medium mb-8">
                {isRegistering ? 'Start tracking your finances.' : 'Access your financial control room.'}
              </p>

              <form onSubmit={handleEmailAction} className="flex flex-col gap-4" aria-label={isRegistering ? "Sign up with Email" : "Sign in with Email"}>
                {isRegistering && !registrationAllowed && (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold leading-relaxed mb-2 shadow-sm">
                    <p className="font-bold flex items-center gap-1.5 uppercase text-[10px] tracking-wider text-amber-950">⚠️ Platform limit reached</p>
                    <p className="mt-1">
                      New sign-ups are temporarily capped at <span className="font-mono font-bold text-amber-950">{maxRegistrationLimit}</span> users. Currently, {totalSystemUsers} users are registered. Please contact <strong>support@ledgerflow.app</strong> for a custom account creation.
                    </p>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email-input" className="block text-xs font-bold text-[#525252] uppercase tracking-wider mb-2">Email</label>
                  <input
                    id="auth-email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isRegistering && !registrationAllowed}
                    className="w-full h-12 px-4 rounded-xl border border-[#E5E5E5] focus:border-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2 transition-all disabled:opacity-40"
                    placeholder="you@company.com"
                    required
                    aria-label="Email address"
                  />
                </div>
                <div>
                  <label htmlFor="auth-password-input" className="block text-xs font-bold text-[#525252] uppercase tracking-wider mb-2">Password</label>
                  <input
                    id="auth-password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isRegistering && !registrationAllowed}
                    className="w-full h-12 px-4 rounded-xl border border-[#E5E5E5] focus:border-[#0A0A0A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2 transition-all disabled:opacity-40"
                    placeholder="••••••••"
                    required
                    aria-label="Password"
                  />
                </div>
                
                <button 
                  type="submit"
                  disabled={isSubmitting || (isRegistering && !registrationAllowed)}
                  className="w-full h-12 mt-2 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-3 transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2"
                  aria-label={isRegistering ? "Submit Registration" : "Submit Login"}
                >
                  {isSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true" />
                  ) : (
                    <>
                      {isRegistering ? <UserPlus size={18} aria-hidden="true" /> : <Mail size={18} aria-hidden="true" />}
                      {isRegistering ? 'Sign up with Email' : 'Sign in with Email'}
                    </>
                  )}
                </button>
              </form>

              <div className="relative my-6 text-center" aria-hidden="true">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E5E5]"></div></div>
                <div className="relative"><span className="bg-white lg:bg-[#F9F9F7] px-4 text-xs font-bold text-[#A3A3A3] uppercase tracking-widest">Or</span></div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={handleGoogleLogin}
                  type="button"
                  disabled={isSubmitting}
                  className="h-12 bg-white border border-[#E5E5E5] hover:border-[#0047AB] text-[#0A0A0A] rounded-xl font-bold text-sm tracking-wide flex items-center justify-center gap-3 transition-all shadow-sm disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0047AB] focus-visible:ring-offset-2"
                  aria-label="Continue with Google Authentication"
                >
                  <LogIn size={18} className="text-[#0047AB]" aria-hidden="true" />
                  Continue with Google
                </button>

                <button 
                  onClick={onGuest}
                  type="button"
                  disabled={isSubmitting}
                  className="h-12 bg-transparent text-[#525252] hover:text-[#0A0A0A] rounded-xl font-bold text-sm tracking-wide flex items-center justify-center transition-all disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2"
                  aria-label="Continue as Guest"
                >
                  Continue as Guest
                </button>
              </div>

              <p className="mt-8 text-center text-sm font-medium text-[#525252]">
                {isRegistering ? "Already have an account?" : "Don't have an account?"}{' '}
                <button 
                  type="button"
                  onClick={() => setIsRegistering(!isRegistering)} 
                  className="text-[#0A0A0A] font-bold hover:text-[#0047AB] transition-colors underline decoration-2 underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0A0A0A] focus-visible:ring-offset-2 rounded-sm"
                  aria-label={isRegistering ? "Switch to Sign in" : "Switch to Sign up"}
                >
                  {isRegistering ? "Sign in" : "Sign up"}
                </button>
              </p>

              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-[#737373]">
                <button
                  type="button"
                  onClick={() => { setLegalTab('terms'); setLegalModalOpen(true); }}
                  className="hover:text-[#0A0A0A] underline underline-offset-2 transition-colors"
                >
                  Terms of Service
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => { setLegalTab('privacy'); setLegalModalOpen(true); }}
                  className="hover:text-[#0A0A0A] underline underline-offset-2 transition-colors"
                >
                  Privacy Policy
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      <LegalModal
        isOpen={legalModalOpen}
        onClose={() => setLegalModalOpen(false)}
        initialTab={legalTab}
      />
    </main>
  );
}



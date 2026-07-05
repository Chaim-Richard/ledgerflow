import * as React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ProtocolGuard extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ProtocolGuard caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 md:p-8 overflow-hidden relative">
          <div className="paper-texture opacity-20" />
          <div className="absolute inset-0 technical-grid opacity-[0.05]" />
          
          <div className="max-w-2xl w-full bg-white rounded-[32px] shadow-2xl p-16 text-center relative z-10 border border-white/10">
            <div className="w-24 h-24 bg-rose-500 rounded-[32px] flex items-center justify-center text-white mx-auto mb-10 shadow-[0_0_40px_rgba(244,63,94,0.3)]">
              <AlertCircle size={48} />
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-black text-slate-900 tracking-tighter mb-6 leading-none">System Exception</h2>
            <p className="text-slate-500 font-bold mb-12 text-lg leading-relaxed opacity-60">
              The neural integrity layer encountered an unrecoverable sequence.
            </p>
            
            <div className="p-4 md:p-8 bg-zinc-900 rounded-[32px] text-left mb-12 overflow-auto max-h-60 border border-white/5 shadow-inner">
              <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest truncate mb-4">Error Stack Telemetry</h3>
              <pre className="text-[11px] font-mono text-zinc-400 whitespace-pre-wrap break-all leading-relaxed">
                {this.state.error?.stack || this.state.error?.message || String(this.state.error)}
              </pre>
            </div>
            
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => window.location.reload()}
                className="w-full h-16 bg-slate-900 text-white rounded-[32px] font-black text-xs uppercase tracking-widest truncate hover:bg-rose-600 hover:shadow-[0_0_40px_rgba(244,63,94,0.3)] transition-all flex items-center justify-center gap-5 active:scale-[0.98]"
              >
                <RefreshCw size={20} />
                Synchronize & Restart
              </button>
              
              <p className="text-[10px] font-black text-slate-500/40 uppercase tracking-[0.5em] mt-4">
                Reference: {Date.now().toString(36).toUpperCase()}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

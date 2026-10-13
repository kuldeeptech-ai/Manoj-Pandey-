import React, { ErrorInfo, ReactNode } from 'react';
import { RotateCw, AlertTriangle, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public override state: State;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Application ErrorBoundary Caught]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    try {
      // Clear potentially corrupt session keys if needed
      window.location.reload();
    } catch {
      window.location.href = '/';
    }
  };

  private handleResetCache = () => {
    try {
      ['school_settings_cache', 'school_settings_cache_v2', 'hp_cached_last_result', 'hp_recent_searches'].forEach((k) => {
        localStorage.removeItem(k);
      });
      window.location.href = '/';
    } catch {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/40">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black uppercase tracking-tight text-white mb-2">
              पेज लोड करने में समस्या आई
            </h2>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed mb-6">
              ब्राउज़र कैश अथवा पुराने डेटा के कारण अस्थायी त्रुटि हुई है। कृपया नीचे दिए गए बटन से पुनः प्रयास करें।
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-5 py-2.5 bg-[#0f2b48] hover:bg-[#1b4975] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <RotateCw className="w-4 h-4" />
                <span>पेज रिफ्रेश करें (Reload)</span>
              </button>
              <button
                type="button"
                onClick={this.handleResetCache}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-amber-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-600"
              >
                <Home className="w-4 h-4" />
                <span>होमपेज पर जाएं (Home)</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


import React, { useState, useEffect } from 'react';
import { acousticEngine } from '../services/audio';
import {
  initOAuthClient,
  requestAccessToken,
  getStoredUser,
  getStoredTokens,
  GoogleUser
} from '../services/auth';

interface AuthProps {
  onAuthorized: (clearance: string) => void;
}

const Auth: React.FC<AuthProps> = ({ onAuthorized }) => {
  const [step, setStep] = useState<'ID' | 'KEY' | 'GRANTED'>('ID');
  const [isScanning, setIsScanning] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [clearance, setClearance] = useState('LEAD_SCIENTIST');
  const [googleUser, setGoogleUser] = useState<GoogleUser | null>(null);

  // Check for existing valid session on mount
  useEffect(() => {
    // initOAuthClient(); // Legacy flow removed

    const storedUser = getStoredUser();
    const tokens = getStoredTokens();

    if (storedUser && tokens && tokens.expiresAt > Date.now()) {
      setGoogleUser(storedUser);
      setStep('GRANTED');
      setTimeout(() => onAuthorized(clearance), 1000);
    }
  }, []);

  // Handle OAuth sign-in
  const handleSignIn = async () => {
    setIsAuthenticating(true);
    setAuthError(null);

    try {
      await requestAccessToken();
      const user = getStoredUser();

      if (user) {
        acousticEngine.playSuccess();
        setGoogleUser(user);
        setStep('GRANTED');
        setTimeout(() => onAuthorized(clearance), 1500);
      } else {
        setAuthError('Failed to get user info');
      }
    } catch (error) {
      setAuthError(String(error));
      console.error('OAuth error:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const startScan = () => {
    setIsScanning(true);
    acousticEngine.playScan();
    setTimeout(() => {
      setIsScanning(false);
      setStep('KEY'); // Go directly to Google Sign-In
      acousticEngine.playTick();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex items-center justify-center font-mono overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_70%)]" />

      {/* Auth Card */}
      <div className="w-[520px] relative">
        {/* CRT Scanline Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%] z-20" />

        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-10 backdrop-blur-xl shadow-2xl relative z-10 overflow-hidden">

          {/* Step 1: ID SCAN */}
          {step === 'ID' && (
            <div className="space-y-8 animate-in fade-in zoom-in duration-500">
              <div className="text-center">
                <div className="w-16 h-1 bg-indigo-500 mx-auto mb-6 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)]" />
                <h1 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-2">Google Anti-Gravity</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Neural Uplink Interface v4.2</p>
              </div>

              <div className="relative group cursor-pointer" onClick={!isScanning ? startScan : undefined}>
                <div className={`aspect-square w-48 mx-auto rounded-full border-2 border-slate-800 flex items-center justify-center relative overflow-hidden transition-all duration-500 ${isScanning ? 'border-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.2)]' : 'hover:border-slate-700'}`}>
                  <svg viewBox="0 0 100 100" className={`w-32 h-32 transition-colors ${isScanning ? 'text-indigo-400' : 'text-slate-600'}`}>
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" />
                    <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="2" />
                    <circle cx="50" cy="50" r="5" fill="currentColor" className={isScanning ? 'animate-pulse' : ''} />
                  </svg>
                  {isScanning && (
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent h-1 w-full animate-[scan_2s_ease-in-out_infinite]" />
                  )}
                </div>
                {!isScanning && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] font-black text-white bg-indigo-600 px-4 py-2 rounded-full shadow-xl">INITIATE BIOMETRIC SCAN</span>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="text-[10px] text-slate-500 flex justify-between px-1">
                  <span>CLEARANCE_LEVEL</span>
                  <span className="text-indigo-400">{clearance}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {['LEAD_SCIENTIST', 'ARCHITECT'].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => {
                        acousticEngine.playTick();
                        setClearance(lvl);
                      }}
                      className={`py-2 text-[9px] font-bold rounded-lg border transition-all ${clearance === lvl ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-500'}`}
                    >
                      {lvl.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}


          {/* Step 2: GOOGLE SIGN-IN */}
          {step === 'KEY' && (
            <div className="space-y-8 animate-in slide-in-from-right-10 duration-500">
              <div className="text-center">
                <div className="w-16 h-1 bg-emerald-500 mx-auto mb-6 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <h1 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-2">Neural Engine Auth</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Google AntiGravity OAuth Integration</p>
              </div>

              <div className="bg-slate-950/50 border border-slate-800 p-6 rounded-2xl space-y-6">
                <p className="text-xs text-slate-400 leading-relaxed text-center">
                  Sign in with your Google account to access the <span className="text-indigo-400 font-bold">Gemini API</span> and enable multi-model neural processing.
                </p>

                {/* OAuth Sign-In Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleSignIn}
                    disabled={isAuthenticating}
                    className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAuthenticating ? (
                      <>
                        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <span>Authenticating...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        <span>Authenticate with Antigravity</span>
                      </>
                    )}
                  </button>
                </div>

                {authError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
                    <p className="text-[10px] text-rose-400 font-mono text-center">{authError}</p>
                  </div>
                )}

                <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                  <p className="text-[10px] text-slate-500 font-mono text-center">
                    OAuth grants access to Gemini API using your Google account credentials.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: GRANTED */}
          {step === 'GRANTED' && (
            <div className="py-8 space-y-6 text-center animate-in zoom-in duration-700">
              {googleUser?.picture ? (
                <div className="relative mx-auto w-20 h-20">
                  <img
                    src={googleUser.picture}
                    alt={googleUser.name}
                    className="w-20 h-20 rounded-full border-2 border-emerald-500 shadow-[0_0_40px_rgba(16,185,129,0.2)]"
                  />
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  </div>
                </div>
              ) : (
                <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500 mx-auto rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)]">
                  <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
              )}
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em] mb-2">Access Granted</h2>
                {googleUser && (
                  <p className="text-sm text-slate-400 mb-2">{googleUser.name}</p>
                )}
                <div className="flex items-center justify-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Uplink Stable // Operator Identified</p>
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 w-full animate-[progress_1.5s_ease-in-out]" />
              </div>
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-6 flex justify-between px-6 opacity-20 group">
          <span className="text-[9px] text-white tracking-widest uppercase">Propulsion OS v4.2</span>
          <span className="text-[9px] text-white">GENAI_ENGINE: ENABLED</span>
        </div>
      </div>

      <style>{`
        @keyframes scan {
          from { top: 0%; }
          to { top: 100%; }
        }
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
};

export default Auth;

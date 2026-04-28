/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, testConnection } from '@/src/lib/firebase';
import { Role, UserProfile } from '@/src/types';
import Dashboard from './components/Dashboard';
import ImmediateSOSView from './components/ImmediateSOSView';
import ProfileInitialization from './components/ProfileInitialization';
import { LogIn, HeartPulse, ShieldAlert, Zap, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImmediateSOS, setIsImmediateSOS] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [showRegisterOptions, setShowRegisterOptions] = useState(false);
  const [presortedType, setPresortedType] = useState<'citizen' | 'emergency_department' | null>(null);
  const [hasEnteredDashboard, setHasEnteredDashboard] = useState(false);

  useEffect(() => {
    testConnection();
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check if profile exists in Firestore
        const roleSnap = await getDoc(doc(db, 'users', user.uid));
        if (roleSnap.exists()) {
          setUserRole(roleSnap.data().role as Role);
          setNeedsProfileSetup(false);
        } else if (user.isAnonymous) {
          setUserRole(Role.USER);
          setNeedsProfileSetup(false);
        } else {
          setNeedsProfileSetup(true);
        }
      } else {
        setHasEnteredDashboard(false);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleProfileComplete = (profile: UserProfile) => {
    setUserRole(profile.role);
    setNeedsProfileSetup(false);
    setShowRegisterOptions(false);
    setPresortedType(null);
  };

  const handleLogin = async (type?: 'citizen' | 'emergency_department') => {
    if (type) setPresortedType(type);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      // We don't check for existence here, that's handled by the useEffect on load
    } catch (error: any) {
      if (error.code !== 'auth/popup-closed-by-user') {
        console.error("Login failed", error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      setCurrentUser(null);
      setUserRole(null);
      setNeedsProfileSetup(false);
      setShowRegisterOptions(false);
      setPresortedType(null);
      setHasEnteredDashboard(false);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleModeEnter = () => {
    setHasEnteredDashboard(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-ui-bg">
        <motion.div
           animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
           transition={{ duration: 1.5, repeat: Infinity }}
           className="rounded-2xl bg-red-600 p-6 shadow-2xl shadow-red-600/20"
        >
          <HeartPulse className="h-12 w-12 text-white" />
        </motion.div>
      </div>
    );
  }

  // Case: User is logged in and profile is ready, but hasn't entered dashboard View Mode
  if (currentUser && !needsProfileSetup && !hasEnteredDashboard && !isImmediateSOS) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ui-bg px-4 text-ui-text font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#3f3f46_1px,_transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg space-y-12 relative z-10"
        >
          <div className="text-center">
            <h1 className="font-display text-5xl font-black italic tracking-tighter text-ui-text mb-2 underline decoration-red-600 decoration-8 underline-offset-[12px]">SURAKSHA</h1>
            <p className="text-[10px] font-mono font-black text-ui-text-muted uppercase tracking-[0.5em] mt-4">Operational Status: Online</p>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <button
              onClick={handleModeEnter}
              className="group relative flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-ui-border bg-ui-surface/50 p-10 transition-all hover:border-ui-primary hover:bg-ui-surface active:scale-[0.98] shadow-2xl overflow-hidden"
            >
              <div className="w-16 h-16 bg-ui-primary/20 rounded-2xl flex items-center justify-center border border-ui-primary/30 group-hover:scale-110 transition-transform">
                <ShieldAlert size={32} className="text-ui-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-display font-black text-ui-text italic uppercase tracking-tighter">User Mode</h3>
                <p className="text-[10px] text-ui-text-muted font-black uppercase tracking-widest mt-1">Full Tactical Access</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                <ShieldAlert size={120} />
              </div>
            </button>

            <button
              onClick={() => setIsImmediateSOS(true)}
              className="group relative flex w-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-red-900/30 bg-red-950/20 p-10 transition-all hover:border-red-600 hover:bg-red-950/40 active:scale-[0.98] shadow-2xl overflow-hidden"
            >
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] group-hover:scale-110 transition-transform animate-pulse">
                <HeartPulse size={32} className="text-white" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter">Immediate SOS</h3>
                <p className="text-[10px] text-red-500/70 font-black uppercase tracking-widest mt-1">Panic Broadcast Activation</p>
              </div>
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                <AlertCircle size={120} />
              </div>
            </button>
          </div>

          <div className="flex justify-center">
             <button onClick={handleLogout} className="text-[9px] text-zinc-600 hover:text-white transition-colors font-black uppercase tracking-[0.5em] italic">Terminate Session</button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-ui-bg px-4 text-ui-text font-sans">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#3f3f46_1px,_transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center relative z-10"
        >
          <div className="mb-12 flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 blur-3xl bg-red-600 opacity-20"></div>
              <div className="relative rounded-[2.5rem] bg-red-600 p-8 shadow-2xl shadow-red-900/40 border-4 border-red-500">
                <ShieldAlert size={80} className="text-white" />
              </div>
            </div>
            <h1 className="mt-8 font-display text-4xl font-black uppercase tracking-tighter text-ui-text">
              SURAKSHA
            </h1>
          </div>

          <AnimatePresence mode="wait">
            {!showRegisterOptions ? (
              <motion.div 
                key="initial"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl mb-8">
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest text-center">Operational Protocol</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShowRegisterOptions(true)}
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-white p-6 font-black text-zinc-950 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <LogIn size={24} />
                    <span className="uppercase tracking-widest text-[10px]">Register</span>
                  </button>

                  <button
                    onClick={() => handleLogin()}
                    className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-zinc-800 p-6 font-black text-zinc-100 shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <ShieldAlert size={24} />
                    <span className="uppercase tracking-widest text-[10px]">Secure Login</span>
                  </button>
                </div>

                <button
                  onClick={() => setIsImmediateSOS(true)}
                  className="flex w-full items-center justify-center space-x-4 rounded-2xl border border-red-600/30 bg-red-600/10 py-5 font-black text-red-500 transition-all hover:bg-red-600/20 active:scale-[0.98]"
                >
                  <HeartPulse size={24} />
                  <span className="uppercase tracking-[0.2em] text-sm font-display italic">Immediate SOS</span>
                </button>
              </motion.div>
            ) : (
              <motion.div 
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => setShowRegisterOptions(false)}
                  className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-4 hover:text-white transition-colors"
                >
                  ← Back to Selection
                </button>
                
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-white mb-6">Select Your Unit</h3>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    onClick={() => handleLogin('citizen')}
                    className="group relative flex items-center justify-between rounded-2xl bg-zinc-900 p-6 border-2 border-zinc-800 hover:border-indigo-500 transition-all"
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-lg font-black uppercase italic text-white">Citizen</span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Civilian Tactical Asset</span>
                    </div>
                    <LogIn className="text-indigo-500 group-hover:scale-110 transition-transform" />
                  </button>

                  <button
                    onClick={() => handleLogin('emergency_department')}
                    className="group relative flex items-center justify-between rounded-2xl bg-zinc-900 p-6 border-2 border-zinc-800 hover:border-red-600 transition-all"
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="text-lg font-black uppercase italic text-white">Emergency Dept</span>
                      <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Authorized Responder Unit</span>
                    </div>
                    <ShieldAlert className="text-red-600 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isImmediateSOS && <ImmediateSOSView onDismiss={() => setIsImmediateSOS(false)} />}
        </motion.div>
      </div>
    );
  }

  if (needsProfileSetup && currentUser) {
    return (
      <ProfileInitialization 
        user={currentUser} 
        onComplete={handleProfileComplete} 
        initialUserType={presortedType === 'emergency_department' ? 'emergency_department' : 'citizen'} 
      />
    );
  }

  if (!userRole && currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-500 font-mono text-xs animate-pulse tracking-[0.5em]">SYNCHRONIZING TACTICAL PROFILE...</div>
      </div>
    );
  }

  return (
    <>
      {isImmediateSOS && <ImmediateSOSView onDismiss={() => setIsImmediateSOS(false)} />}
      <Dashboard userRole={userRole} onLogout={handleLogout} />
    </>
  );
}

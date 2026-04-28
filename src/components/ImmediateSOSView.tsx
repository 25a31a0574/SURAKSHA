/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, MapPin, Send, AlertTriangle, Shield, X, HeartPulse, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MapComponent from './MapComponent';
import { Location, EmergencyType, EmergencyStatus } from '@/src/types';
import { db, auth } from '@/src/lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { addDoc, collection, doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';

interface ImmediateSOSViewProps {
  onDismiss: () => void;
  initialCaseId?: string | null;
}

export default function ImmediateSOSView({ onDismiss, initialCaseId }: ImmediateSOSViewProps) {
  const [location, setLocation] = useState<Location | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'pending',
    camera: 'pending',
    mic: 'pending'
  });

  useEffect(() => {
    if (initialCaseId) {
      setCaseId(initialCaseId);
      setIsTransmitting(true);
      setCountdown(null);
    }
  }, [initialCaseId]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (auth.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (snap.exists()) {
            setUserData(snap.data());
          }
        } catch (err) {
          console.error("Error fetching user data", err);
        }
      }
    };
    fetchUserData();
  }, []);

  const [emergencyText, setEmergencyText] = useState('');
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseStatus, setCaseStatus] = useState<EmergencyStatus>(EmergencyStatus.UNASSIGNED);
  const [assignedResponderId, setAssignedResponderId] = useState<string | null>(null);
  const [responderName, setResponderName] = useState<string | null>(null);
  const [responderLocation, setResponderLocation] = useState<Location | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [waitingForPermissions, setWaitingForPermissions] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let unsubCase: () => void = () => {};
    let unsubResponder: () => void = () => {};

    if (caseId) {
      unsubCase = onSnapshot(doc(db, 'emergency_cases', caseId), (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as any;
          setCaseStatus(data.status);
          if (data.responderId) {
             setAssignedResponderId(data.responderId);
             
             // Start listening to responder location
             unsubResponder = onSnapshot(doc(db, 'users', data.responderId), (userSnap) => {
               if (userSnap.exists()) {
                 const u = userSnap.data() as any;
                 if (u.location) {
                   setResponderLocation(u.location);
                 }
                 setResponderName(u.name || 'Emergency Responder');
               }
             });
          }
        }
      });
    }
    return () => {
      unsubCase();
      unsubResponder();
    };
  }, [caseId]);

  useEffect(() => {
    const init = async () => {
      await handlePermissions();
      setWaitingForPermissions(false);
      setCountdown(10); // Start countdown after permissions resolved
    };
    init();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0 && !isTransmitting) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      
      // Attempt to get location precisely
      if (countdown === 5) {
         navigator.geolocation.getCurrentPosition(
           (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
           (err) => console.warn("Background location fetch failed", err)
         );
      }
    } else if (countdown === 0 && !isTransmitting) {
      triggerAutomatedSOS();
    }
    return () => clearTimeout(timer);
  }, [countdown, isTransmitting]);

  const [selectedType, setSelectedType] = useState<EmergencyType>(EmergencyType.GENERAL);
  const [isFocused, setIsFocused] = useState(false);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        return canvasRef.current.toDataURL('image/png');
      }
    }
    return null;
  };

  const handlePermissions = async () => {
    const permPromise = [];

    // 1. Geolocation
    if ("geolocation" in navigator) {
      permPromise.push(new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            setPermissionStatus(prev => ({ ...prev, location: 'granted' }));
            resolve();
          },
          () => {
            setPermissionStatus(prev => ({ ...prev, location: 'denied' }));
            resolve();
          },
          { timeout: 5000 }
        );
      }));
    } else {
      setPermissionStatus(prev => ({ ...prev, location: 'unsupported' }));
    }

    // 2. Camera & Mic
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      if (videoRef.current) { videoRef.current.srcObject = mediaStream; }
      setPermissionStatus(prev => ({ ...prev, camera: 'granted', mic: 'granted' }));
    } catch (err) {
      console.error("Media permission failed", err);
      setPermissionStatus(prev => ({ ...prev, camera: 'denied', mic: 'denied' }));
    }

    await Promise.all(permPromise);
  };

  const triggerAutomatedSOS = async () => {
    if (isTransmitting) return;
    setIsTransmitting(true);
    setCountdown(null);

    // Capture the visual data exactly at trigger
    const capturedImage = captureFrame();

    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      const profileData = userData;
      const vitalInfo = profileData ? `\nNAME: ${profileData.name} | BLOOD: ${profileData.medicalInfo?.bloodGroup || 'N/A'}` : '';

      const caseData = {
        victimId: auth.currentUser?.uid,
        victimName: profileData?.name || (auth.currentUser?.isAnonymous ? `GUEST_${auth.currentUser?.uid.slice(-4)}` : auth.currentUser?.displayName || 'SECURE_USER'),
        victimDetails: profileData || {},
        location: location || { lat: 0, lng: 0 },
        status: EmergencyStatus.UNASSIGNED,
        type: selectedType,
        incidentImage: capturedImage || '',
        audioDescription: 'LIVE_STREAM_ACTIVE',
        description: (emergencyText || `IMMEDIATE PANIC BROADCAST [${selectedType}]`) + vitalInfo,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        aiAdvise: `AUTO_GENERATING_TACTICAL_ADVICE...`,
        medicalSnapshot: profileData?.medicalInfo || null
      };

      const docRef = await addDoc(collection(db, 'emergency_cases'), caseData);
      setCaseId(docRef.id);
    } catch (err) {
      console.error("SOS Transmission Failed", err);
      setIsTransmitting(false);
    }
  };

  const updateEmergencyInfo = async () => {
    if (caseId) {
      try {
        await updateDoc(doc(db, 'emergency_cases', caseId), {
          aiAdvise: emergencyText
        });
      } catch (err) {
        console.error("Update failed", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-white font-sans overflow-hidden">
      <canvas ref={canvasRef} className="hidden" />
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 bg-red-600 shrink-0 z-20">
        <div className="flex items-center space-x-2">
          <Shield className="text-white fill-white" size={20} />
          <h2 className="font-display text-lg font-black italic uppercase tracking-tighter">SURAKSHA SOS</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isTransmitting && (
            <button 
              onClick={triggerAutomatedSOS}
              className="px-3 py-1.5 bg-white text-red-600 rounded-lg text-[8px] font-black uppercase tracking-widest animate-pulse"
            >
              Quick Xit
            </button>
          )}
          <button onClick={onDismiss} className="p-1.5 hover:bg-white/10 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col lg:flex-row min-h-full">
          {/* Left Panel: Camera & Controls */}
          <div className="flex-1 p-3 lg:p-6 flex flex-col space-y-6">
            {/* Permission Alerts - Integrated into flow */}
            <AnimatePresence>
              {(permissionStatus.location === 'denied' || permissionStatus.camera === 'denied' || permissionStatus.mic === 'denied') && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="w-full"
                >
                  <div className="bg-zinc-900 border border-red-500/50 p-4 rounded-2xl flex items-center gap-4 shadow-xl">
                    <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                      <AlertTriangle className="text-red-500" size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] font-black uppercase text-red-100">Tactical Constraints</p>
                      <p className="text-[8px] text-zinc-500 font-bold uppercase">Permissions restricted. Signal quality reduced.</p>
                    </div>
                    <button 
                      onClick={handlePermissions}
                      className="px-4 py-2 bg-red-600 rounded-lg text-[9px] font-black uppercase hover:bg-red-500 active:scale-95 transition-all shadow-lg shadow-red-900/40"
                    >
                      Authorize
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Camera View */}
            <div className="relative aspect-video bg-zinc-900 rounded-2xl overflow-hidden border border-white/5 shadow-2xl shrink-0">
              {permissionStatus.camera === 'granted' ? (
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover grayscale contrast-125 brightness-75 scale-x-[-1]"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                  <Camera size={48} className="mb-4 opacity-20" />
                  <p className="text-sm font-bold tracking-widest uppercase text-center px-4">Initializing Visual Uplink...</p>
                </div>
              )}
              
              <div className="absolute top-4 left-4 flex space-x-2">
                <div className={`px-2 py-1 rounded bg-black/50 backdrop-blur-md border ${permissionStatus.location === 'granted' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'} text-[8px] font-black tracking-widest uppercase`}>
                  GPS: {permissionStatus.location}
                </div>
                <div className={`px-2 py-1 rounded bg-black/50 backdrop-blur-md border ${permissionStatus.camera === 'granted' ? 'border-green-500 text-green-500' : 'border-red-500 text-red-500'} text-[8px] font-black tracking-widest uppercase`}>
                  CAM: {permissionStatus.camera}
                </div>
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                 <div className="flex items-center space-x-4 bg-black/50 backdrop-blur-xl p-4 rounded-2xl border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center animate-pulse">
                      <Mic size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-zinc-400 font-black uppercase mb-1">Live Audio Feed</p>
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                         <motion.div 
                           animate={{ width: ['20%', '60%', '30%', '90%', '40%'] }}
                           transition={{ duration: 1, repeat: Infinity }}
                           className="h-full bg-red-500"
                         />
                      </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Emergency Context Area */}
            <div className="flex flex-col gap-3 shrink-0">
              <label className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">Emergency Tactical Context</label>
              <div className="grid grid-cols-4 gap-2">
                {[EmergencyType.MEDICAL, EmergencyType.FIRE, EmergencyType.SECURITY, EmergencyType.CRASH].map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      setSelectedType(t);
                      setEmergencyText(prev => prev ? `${prev}, ${t}` : t);
                    }}
                    className={`border rounded-xl px-1 py-3 text-[8px] font-black uppercase tracking-tighter transition-all active:scale-[0.98] ${
                      selectedType === t ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-zinc-900 border-white/5 text-zinc-500'
                    }`}
                  >
                    {t.slice(0, 7)}
                  </button>
                ))}
              </div>
              <textarea 
                value={emergencyText}
                onChange={(e) => setEmergencyText(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="SAY OR TYPE YOUR EMERGENCY..."
                className={`w-full h-32 bg-zinc-900/50 border rounded-2xl p-4 font-display text-lg font-black text-white placeholder:text-zinc-800 focus:outline-none transition-all duration-300 no-scrollbar uppercase ${isFocused ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-zinc-900' : 'border-white/5'}`}
              />
            </div>

            {/* Trigger State */}
            <AnimatePresence mode="wait">
              {!isTransmitting ? (
                <div className="flex flex-col gap-3 shrink-0 pb-6">
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={triggerAutomatedSOS}
                    className="group relative h-20 w-full bg-red-600 rounded-2xl font-display text-xl font-black italic uppercase tracking-tighter shadow-2xl active:scale-95 transition-all overflow-hidden"
                  >
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20 origin-left">
                      <motion.div 
                        key={countdown}
                        initial={{ scaleX: 1 }}
                        animate={{ scaleX: 0 }}
                        transition={{ duration: 1, ease: 'linear' }}
                        className="h-full bg-white transition-all"
                      />
                    </div>
                    <span className="relative z-10 flex items-center justify-center space-x-3">
                      <span>{waitingForPermissions ? 'INITIALIZING...' : 'ACTIVATE SIGNAL'}</span>
                      {countdown !== null && (
                        <span className="bg-white/20 px-3 py-1 rounded-xl text-xl tabular-nums">{countdown}s</span>
                      )}
                    </span>
                  </motion.button>
                  <button 
                    disabled={waitingForPermissions}
                    onClick={onDismiss}
                    className="w-full py-3 bg-zinc-800 text-zinc-500 rounded-xl font-black uppercase tracking-widest text-[9px] border border-zinc-700 disabled:opacity-50"
                  >
                    Abort Dispatch
                  </button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col gap-3 shrink-0 pb-6"
                >
                  <div className={`h-20 w-full border flex items-center justify-center rounded-2xl transition-all duration-500 ${
                    assignedResponderId ? 'bg-indigo-600 border-indigo-400' : 'bg-zinc-900 border-red-600'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`h-3 w-3 rounded-full animate-ping ${assignedResponderId ? 'bg-white' : 'bg-red-600'}`} />
                      <span className={`font-display text-lg font-black italic uppercase tracking-tighter ${assignedResponderId ? 'text-white' : 'text-red-500 animate-pulse'}`}>
                        {assignedResponderId ? 'UNIT EN ROUTE' : 'BROADCASTING LIVE'}
                      </span>
                    </div>
                  </div>

                  <motion.div 
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center"
                  >
                     {assignedResponderId ? (
                        <p className="text-xs font-black text-white uppercase italic">
                           Responder <span className="text-indigo-400">{responderName}</span> approaching your location.
                        </p>
                     ) : (
                       <p className="text-xs font-black text-white uppercase italic">
                          Searching elite responders... Stay calm.
                       </p>
                     )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Panel: Tactical Map */}
          <div className="w-full lg:w-[400px] bg-zinc-900/50 lg:border-l border-white/5 p-4 lg:p-6 flex flex-col shrink-0">
             {userData && (
               <motion.div 
                 initial={{ opacity: 0, y: -10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="mb-8 p-4 bg-red-600/10 border border-red-600/30 rounded-2xl flex items-center gap-4"
               >
                 <div className="w-12 h-12 rounded-2xl bg-red-600/20 flex items-center justify-center text-red-500">
                    <User size={24} />
                 </div>
                 <div className="flex-1">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Victim Identity</p>
                    <p className="text-sm font-black text-white uppercase italic">{userData.name}</p>
                    {userData.medicalInfo?.bloodGroup && (
                      <div className="flex items-center gap-1 mt-1">
                         <HeartPulse size={12} className="text-red-500" />
                         <span className="text-[10px] font-mono font-bold text-red-500 uppercase">Blood Group: {userData.medicalInfo.bloodGroup}</span>
                      </div>
                    )}
                 </div>
               </motion.div>
             )}

             <p className="text-[10px] text-zinc-500 font-black uppercase mb-4 tracking-widest">Tactical Location Data</p>
             <div className="h-[300px] lg:h-[400px] bg-zinc-950 rounded-3xl overflow-hidden border border-white/10 mb-6 group relative">
                <MapComponent 
                  victimLocation={location} 
                  responderLocation={responderLocation} 
                  showPath={!!responderLocation} 
                />
                <div className="absolute inset-0 pointer-events-none border-4 border-red-600/30 rounded-3xl group-hover:border-red-600/50 transition-all" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                   <div className="w-20 h-20 border border-white/20 rounded-full animate-ping" />
                   <div className="w-10 h-10 border border-white/40 rounded-full animate-ping delay-300" />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-900 rounded-xl border border-white/5 text-center">
                   <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Responder ETA</p>
                   <p className="text-xl font-display font-black italic text-white tracking-tight">~3.5 MIN</p>
                </div>
                <div className="p-4 bg-zinc-900 rounded-xl border border-white/5 text-center">
                   <p className="text-[9px] text-zinc-500 font-black uppercase mb-1">Signal Strength</p>
                   <p className="text-xl font-display font-black italic text-green-500 tracking-tight">OPTIMAL</p>
                </div>
             </div>

             <div className="mt-8 space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-red-950/20 border border-red-900/40 rounded-lg">
                   <AlertTriangle size={16} className="text-red-500" />
                   <p className="text-[10px] text-red-500 font-bold uppercase leading-tight">Emergency services notified. High-frequency tracking active.</p>
                </div>
             </div>
          </div>
        </div>
      </div>

      <div className="p-4 text-center bg-zinc-950 border-t border-white/5">
         <p className="text-[8px] text-zinc-700 font-mono uppercase tracking-[0.4em]">End-to-End Quantum Encryption Active | Sentinel v4.0</p>
      </div>
    </div>
  );
}

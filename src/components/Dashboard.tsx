/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  AlertTriangle, 
  MapPin, 
  Mic, 
  FileText, 
  Trophy, 
  CheckCircle, 
  Clock, 
  ChevronRight,
  Stethoscope,
  HeartPulse,
  Shield,
  User,
  Zap,
  LogOut,
  Camera,
  ShieldCheck,
  Phone,
  MessageSquare,
  ArrowUpRight,
  Filter,
  X,
  Target,
  Droplet,
  Sun,
  Moon,
  Contrast
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  updateDoc, 
  setDoc,
  getDoc,
  orderBy,
  limit,
  Timestamp,
  arrayUnion
} from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '@/src/lib/firebase';
import { 
  Role, 
  EmergencyType, 
  EmergencyStatus, 
  EmergencyCase, 
  OperationType,
  LeaderboardEntry,
  UserProfile,
  Location,
  EmergencyContact
} from '@/src/types';
import SOSButton from './SOSButton';
import MapComponent from './MapComponent';
import ImmediateSOSView from './ImmediateSOSView';
import { getTacticalAdvice, EmergencyTacticalAdvice } from '@/src/services/geminiService';
import ProfileEditor from './ProfileEditor';
import { useTheme } from '../context/ThemeContext';
import { useConnectivity } from '../context/ConnectivityContext';

const ElapsedTimer = ({ createdAt }: { createdAt: number }) => {
  const [elapsed, setElapsed] = useState(Date.now() - createdAt);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - createdAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);

  const isNearingEscalation = elapsed > 30000; // 30 seconds threshold for escalation

  return (
    <span className={`text-[9px] font-mono ${isNearingEscalation ? 'text-red-500 font-black animate-pulse' : 'text-zinc-600'}`}>
      {mins}m {secs.toString().padStart(2, '0')}s
    </span>
  );
};

export default function Dashboard({ userRole, onLogout }: { userRole: Role, onLogout: () => void }) {
  const { theme, setTheme } = useTheme();
  const { setIsSyncing } = useConnectivity();
  const [activeView, setActiveView] = useState<'USER_MODE' | 'RESPONDER_MODE'>('USER_MODE');
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [activeCases, setActiveCases] = useState<EmergencyCase[]>([]);
  const [otherResponders, setOtherResponders] = useState<{ id: string, location: { lat: number, lng: number } }[]>([]);
  const [userData, setUserData] = useState<UserProfile | null>(null);
  const [lastLocation, setLastLocation] = useState<Location | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EmergencyType | 'ALL'>('ALL');
  const [selectedCase, setSelectedCase] = useState<EmergencyCase | null>(null);
  const [showOnlyAvailableCases, setShowOnlyAvailableCases] = useState(false);
  
  // Guided SOS Flow
  const [showGuidedSOS, setShowGuidedSOS] = useState(false);
  const [sosStep, setSosStep] = useState(1);
  const [sosData, setSosData] = useState({
    image: '',
    audio: '',
    description: '',
    location: null as Location | null,
    address: '',
    locationMethod: '' as 'manual' | 'map' | 'device',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  });

  const [isLocating, setIsLocating] = useState(false);
  
  // --- Real-time Listeners ---
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubUser = onSnapshot(doc(db, 'users', auth.currentUser.uid), (snapshot) => {
      if (snapshot.exists()) {
        setUserData(snapshot.data() as UserProfile);
      }
    });

    const qCases = query(
      collection(db, 'emergency_cases'),
      where('status', 'in', [
        EmergencyStatus.ACTIVE, 
        EmergencyStatus.UNASSIGNED, 
        EmergencyStatus.ASSIGNED, 
        EmergencyStatus.IN_PROGRESS
      ]),
      orderBy('createdAt', 'desc')
    );
    const unsubCases = onSnapshot(qCases, (snapshot) => {
      const cases = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as EmergencyCase));
      setActiveCases(cases);
      
      // Auto-Escalation Logic
      cases.forEach(async (c) => {
        if (c.status === EmergencyStatus.UNASSIGNED && (Date.now() - c.createdAt > 45000) && (!c.priorityLevel || c.priorityLevel < 2)) {
           try {
             await updateDoc(doc(db, 'emergency_cases', c.id), {
               priorityLevel: 2,
               updatedAt: Date.now()
             });
           } catch (e) {
             // Silence permission errors for background tasks
           }
        }
      });
    });

      return () => {
        unsubUser();
        unsubCases();
      };
    }, []);

    // Listen for other responders
    useEffect(() => {
      const qResponders = query(
        collection(db, 'users'),
        where('role', '==', Role.RESPONDER),
        where('isAvailable', '==', true)
      );

      return onSnapshot(qResponders, (snapshot) => {
        const responders = snapshot.docs
          .filter(d => d.id !== auth.currentUser?.uid)
          .map(d => ({
            id: d.id,
            location: d.data().location
          }))
          .filter(r => r.location);
        setOtherResponders(responders as { id: string, location: { lat: number, lng: number } }[]);
      });
    }, []);

  // --- Geolocation ---
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLastLocation(loc);
        if (auth.currentUser) {
          updateDoc(doc(db, 'users', auth.currentUser.uid), { location: loc, lastActive: Date.now() })
            .catch(e => {
              // Gracefully handle permission issues during background updates
              if (!e.message.includes('permissions')) {
                console.error("Location update failed", e);
              }
            });
        }
      },
      (err) => console.error(err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleAcceptCase = async (caseId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'emergency_cases', caseId), {
        status: EmergencyStatus.ASSIGNED,
        responderId: auth.currentUser.uid,
        updatedAt: Date.now()
      });
      // In a real app, this would trigger a notification to the victim
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `emergency_cases/${caseId}`);
    }
  };

  const handleSkipCase = async (caseId: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'emergency_cases', caseId), {
        skipList: arrayUnion(auth.currentUser.uid)
      });
      setSelectedCase(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `emergency_cases/${caseId}`);
    }
  };

  const handleStatusUpdate = async (caseId: string, status: EmergencyStatus) => {
    setIsSyncing(true);
    try {
      await updateDoc(doc(db, 'emergency_cases', caseId), {
        status: status,
        updatedAt: Date.now()
      });
    } catch (error) {
       handleFirestoreError(error, OperationType.UPDATE, `emergency_cases/${caseId}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleAvailability = async () => {
    if (!auth.currentUser || !userData) return;
    const newStatus = userData.isAvailable === false ? true : false;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        isAvailable: newStatus,
        lastActive: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  // --- Tactical Utilities ---
  const getDistance = (l1: Location, l2: Location) => {
    // Basic Haversine or simple Euclidean for demo (km)
    const R = 6371;
    const dLat = (l2.lat - l1.lat) * Math.PI / 180;
    const dLon = (l2.lng - l1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(l1.lat * Math.PI / 180) * Math.cos(l2.lat * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const getTrafficMultiplier = (location: Location) => {
    // Simulate real-time traffic based on time of day and random "pockets"
    // In a real app, this would use Google Distance Matrix API with trafficModel: 'best_guess'
    const hour = new Date().getHours();
    const rushHour = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);
    
    // Pseudo-random congestion factor based on lat/lng last digits (stable for coordinates)
    const congestion = (Math.abs(Math.floor(location.lat * 100)) % 5) * 0.2; 
    return rushHour ? 1.5 + congestion : 1.0 + congestion;
  };

  const getDispatchScore = (emergency: EmergencyCase, responderLoc: Location | null) => {
    if (!responderLoc || !userData) return 0;
    
    // Workload calculation
    const assignedCases = activeCases.filter(c => c.responderId === auth.currentUser?.uid && [EmergencyStatus.ASSIGNED, EmergencyStatus.IN_PROGRESS].includes(c.status));
    const workload = assignedCases.length;
    const workloadFactor = 1 / (1 + workload);

    const dist = getDistance(responderLoc, emergency.location);
    const traffic = getTrafficMultiplier(emergency.location);
    const effectiveDist = dist * traffic;
    
    // Severity weight (Critical = 10, High = 5, etc)
    const severityWeight = 
      emergency.severity === 'critical' ? 100 :
      emergency.severity === 'high' ? 50 :
      emergency.severity === 'medium' ? 20 : 10;
    
    // Expertise factor
    let expertiseBonus = 1.0;
    if (userData.occupation || userData.department || userData.certifications) {
      const expertProfile = (userData.occupation + ' ' + (userData.department || '') + ' ' + (userData.certifications || []).join(' ')).toLowerCase();
      if (emergency.type === EmergencyType.MEDICAL && (expertProfile.includes('medic') || expertProfile.includes('doctor') || expertProfile.includes('nurse') || expertProfile.includes('cpr') || expertProfile.includes('emt'))) expertiseBonus = 1.5;
      if (emergency.type === EmergencyType.FIRE && (expertProfile.includes('fire') || expertProfile.includes('hazard') || expertProfile.includes('rescue'))) expertiseBonus = 1.5;
      if (emergency.type === EmergencyType.SECURITY && (expertProfile.includes('police') || expertProfile.includes('security') || expertProfile.includes('guard'))) expertiseBonus = 1.5;
    }

    // Priority level bonus (set by system auto-escalation)
    const priorityBonus = (emergency.priorityLevel || 0) * 15;

    // Score: High is better (inverse of distance + weight)
    // Formula: ((SeverityWeight + PriorityBonus) / EffectiveDistance) * ExpertiseBonus * WorkloadFactor
    // We cap effectiveDist at a minimum to avoid division by zero or extreme proximity skew
    return (((severityWeight + priorityBonus) / Math.max(effectiveDist, 0.5)) * expertiseBonus) * workloadFactor;
  };

  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (isVoiceListening && !isSOSActive) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = 'en-US';

        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0])
            .map((result: any) => result.transcript)
            .join('')
            .toLowerCase();
          
          setVoiceTranscript(transcript);

          // Tactical Trigger Phrases
          if (transcript.includes('tactical sos') || transcript.includes('emergency emergency')) {
            triggerGuidedSOS();
            setIsVoiceListening(false);
            if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
          }
        };

        recognitionRef.current.onend = () => {
          if (isVoiceListening) recognitionRef.current.start();
        };

        recognitionRef.current.start();
      }
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, [isVoiceListening, isSOSActive]);

  const toggleVoiceActivation = () => {
    setIsVoiceListening(!isVoiceListening);
    if (!isVoiceListening) setVoiceTranscript('Initializing Tactical Voice Recognition...');
  };

  const getSeverityWeight = (severity: string | undefined): number => {
    switch (severity) {
      case 'critical': return 3;
      case 'high': return 2;
      case 'medium': return 1;
      case 'low': return 0;
      default: return 0;
    }
  };

  const sortedCases = activeCases
    .filter(c => {
      if (userRole === Role.RESPONDER) {
        if (userData?.isAvailable === false) return false;
        if (c.skipList?.includes(auth.currentUser?.uid || '')) return false;
        if (showOnlyAvailableCases && c.status !== EmergencyStatus.UNASSIGNED) return false;
      }
      if (selectedCategory !== 'ALL' && c.type !== selectedCategory) return false;
      return true;
    })
    .sort((a, b) => {
      // Primary: Severity
      const sevA = getSeverityWeight(a.severity);
      const sevB = getSeverityWeight(b.severity);
      if (sevB !== sevA) return sevB - sevA;

      // Secondary: Responder Score or Time
      if (userRole === Role.RESPONDER && lastLocation) {
        return getDispatchScore(b, lastLocation) - getDispatchScore(a, lastLocation);
      }
      return b.createdAt - a.createdAt;
    });

  const handleUseCurrentLocation = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setSosData(prev => ({ ...prev, location: loc, locationMethod: 'device' }));
          setIsLocating(false);
        },
        (err) => {
          console.error("Location fetch failed", err);
          setIsLocating(false);
          alert("Could not retrieve precise location. Please ensure GPS is enabled.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setIsLocating(false);
      alert("Geolocation is not supported by this browser.");
    }
  };

  const sendEmergencyNotification = async (contacts: EmergencyContact[], location: Location, victimName: string) => {
    try {
      await addDoc(collection(db, 'emergency_notifications'), {
        type: 'EMERGENCY_ALERT',
        contacts,
        location,
        victimName,
        message: `EMERGENCY ALERT: ${victimName} has triggered an SOS signal. Location: ${location.lat}, ${location.lng}. Please check the tactical uplink for more details.`,
        createdAt: Date.now()
      });
      console.log("Emergency notifications queued for:", contacts);
    } catch (e) {
      console.error("Failed to queue notifications", e);
    }
  };

  const triggerGuidedSOS = async () => {
    if (!auth.currentUser) return;
    try {
      const type = selectedCategory === 'ALL' ? EmergencyType.GENERAL : (selectedCategory as EmergencyType);
      const severity = sosData.severity;

      const location = sosData.location || lastLocation || { lat: 0, lng: 0 };
      
      const caseData = {
        victimId: auth.currentUser.uid,
        victimName: userData?.name || 'Authorized User',
        victimDetails: userData || {},
        location: location,
        status: EmergencyStatus.UNASSIGNED,
        type: type,
        severity: severity,
        incidentImage: sosData.image,
        audioDescription: sosData.audio,
        description: (sosData.description || `IMMEDIATE PANIC BROADCAST`) + 
                    (sosData.address ? `\nLOCATION: ${sosData.address}` : '') +
                    (`\nSOURCE: ${sosData.locationMethod.toUpperCase() || 'AUTO'}`),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        medicalSnapshot: userData?.medicalInfo || null
      };
      
      const docRef = await addDoc(collection(db, 'emergency_cases'), caseData);
      
      // Notify emergency contacts
      if (userData?.emergencyContacts && userData.emergencyContacts.length > 0) {
        await sendEmergencyNotification(userData.emergencyContacts, location, userData.name || 'User');
      }

      setActiveCaseId(docRef.id);
      setIsSOSActive(true);
      setShowGuidedSOS(false);
      setSosStep(1);
      // Reset SOS data for next time
      setSosData({
        image: '',
        audio: '',
        description: '',
        location: null,
        address: '',
        locationMethod: 'manual',
        severity: 'medium'
      });
    } catch (err) {
      console.error("SOS Trigger failed", err);
    }
  };

  const renderResponderDashboard = () => (
    <div className="flex-1 flex flex-col pt-4 overflow-hidden">
      {/* Availability Status Header */}
      <div className="sticky top-0 z-20 mx-6 mb-4 p-4 bg-zinc-900/90 backdrop-blur-md border border-zinc-700 rounded-2xl flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className={`w-3 h-3 rounded-full ${userData?.isAvailable ? 'bg-green-500' : 'bg-red-500'} ${userData?.isAvailable ? 'animate-pulse' : ''}`} />
            {userData?.isAvailable && <div className="absolute inset-0 w-3 h-3 bg-green-500 rounded-full animate-ping" />}
          </div>
          <div>
            <p className="text-[10px] font-black text-white uppercase tracking-widest leading-none mb-1">
              Status: {userData?.isAvailable ? 'Online / Available' : 'Offline / Unavailable'}
            </p>
            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
              {userData?.isAvailable ? 'Ready for Dispatches' : 'Offline - Awaiting Activation'}
            </p>
          </div>
        </div>
        <button 
          onClick={toggleAvailability}
          className={`px-8 py-3 ${userData?.isAvailable ? 'bg-red-900/20 text-red-500 border border-red-900/50' : 'bg-green-600 text-white'} rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all`}
        >
          {userData?.isAvailable ? 'Go Offline' : 'Go Online Now'}
        </button>
      </div>

      {/* Category Tabs */}
      <div className="px-6 mb-4 overflow-x-auto flex gap-2 no-scrollbar">
        {[
          { id: 'ALL', label: 'All Cases', icon: Shield },
          { id: EmergencyType.GENERAL, label: 'General', icon: AlertTriangle },
          { id: EmergencyType.MEDICAL, label: 'Medical', icon: HeartPulse },
          { id: EmergencyType.FIRE, label: 'Fire', icon: Zap },
          { id: EmergencyType.SECURITY, label: 'Security', icon: ShieldCheck },
        ].map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id as any)}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all flex items-center gap-2 ${
              selectedCategory === cat.id 
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'
            }`}
          >
            <cat.icon size={12} />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 px-6 pb-6 overflow-hidden">
        {/* Case List */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-y-auto pr-2 custom-scrollbar">
          <div className="flex items-center justify-between sticky top-0 bg-zinc-950 z-10 pb-2">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
              <Target size={14} className="text-indigo-500" /> INTELLIGENT_DISPATCH ({sortedCases.length})
            </h3>
            <button 
              onClick={() => setShowOnlyAvailableCases(!showOnlyAvailableCases)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[10px] font-black uppercase ${showOnlyAvailableCases ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}
            >
              <Filter size={14} />
              {showOnlyAvailableCases ? 'Unassigned Only' : 'All Cases'}
            </button>
          </div>
          
          <AnimatePresence mode="popLayout">
            {sortedCases.map((c, index) => {
              const distance = lastLocation ? getDistance(lastLocation, c.location) : 0;
              const trafficMul = getTrafficMultiplier(c.location);
              const isRecommended = index === 0 && userRole === Role.RESPONDER && sortedCases.length > 0 && c.status === EmergencyStatus.UNASSIGNED;

              return (
                <motion.div
                  layout
                  key={c.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => setSelectedCase(c)}
                  className={`bg-zinc-900 border p-5 rounded-3xl cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden ${
                    selectedCase?.id === c.id ? 'border-indigo-500 ring-1 ring-indigo-500/50' : 
                    c.severity === 'critical' ? 'border-red-500 animate-pulse' :
                    c.severity === 'high' ? 'border-orange-500/50' :
                    'border-zinc-800 hover:border-zinc-700'
                  } ${isRecommended ? 'shadow-[0_0_20px_rgba(79,70,229,0.15)] ring-1 ring-indigo-500/30' : ''} ${c.severity === 'critical' ? 'shadow-[0_0_20px_rgba(239,68,68,0.4)]' : ''}`}
                >
                  {selectedCase?.id === c.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        document.getElementById('tactical-center')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="mt-4 w-full bg-indigo-600 text-white text-[8px] font-black uppercase tracking-widest py-3 rounded-xl hover:bg-indigo-700 transition"
                    >
                      View Full Details
                    </button>
                  )}
                  {isRecommended && (
                    <div className="absolute top-0 right-0">
                      <div className="bg-indigo-600 text-white text-[7px] font-black uppercase px-2 py-1 rounded-bl-xl tracking-widest shadow-lg">
                        OPTIMAL_ROUTE
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex gap-2">
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        c.type === EmergencyType.MEDICAL ? 'bg-red-500/20 text-red-400' :
                        c.type === EmergencyType.FIRE ? 'bg-orange-500/20 text-orange-400' :
                        'bg-indigo-500/20 text-indigo-400'
                      }`}>
                        {c.type}
                      </span>
                      {c.priorityLevel && c.priorityLevel > 1 && (
                        <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[8px] font-black uppercase animate-pulse">
                          Escalated
                        </span>
                      )}
                      {c.severity && ['critical', 'high'].includes(c.severity) && (
                        <span className={`px-2 py-0.5 rounded ${c.severity === 'critical' ? 'bg-red-700 animate-pulse' : 'bg-orange-600'} text-white text-[8px] font-black uppercase flex items-center gap-1`}>
                           {c.severity === 'critical' && <AlertTriangle size={8} />}
                           {c.severity}
                        </span>
                      )}
                    </div>
                    {c.responderId === auth.currentUser?.uid && [EmergencyStatus.ASSIGNED, EmergencyStatus.IN_PROGRESS].includes(c.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusUpdate(c.id, EmergencyStatus.SOLVED);
                        }}
                        className="bg-green-600 text-white p-1 rounded-md hover:bg-green-700 transition flex items-center gap-1 text-[8px] font-black uppercase"
                      >
                        <CheckCircle size={10} /> Solved
                      </button>
                    )}
                    <ElapsedTimer createdAt={c.createdAt} />
                  </div>

                  <h4 className="text-white font-black uppercase italic tracking-tighter text-lg mb-2">{c.victimName}</h4>
                  
                  <div className="flex flex-wrap gap-x-4 gap-y-2 mt-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={10} className="text-zinc-600" />
                      <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase">{distance.toFixed(1)} KM</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap size={10} className={trafficMul > 1.3 ? "text-orange-500" : "text-green-500"} />
                      <span className={`text-[8px] font-mono font-bold uppercase ${trafficMul > 1.3 ? "text-orange-500" : "text-green-500"}`}>
                        {trafficMul > 1.5 ? 'Heavy Traffic' : trafficMul > 1.2 ? 'Moderate' : 'Fluid'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Shield size={10} className="text-zinc-600" />
                      <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase">{c.severity || 'Normal'}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Tactical Center */}
        <div id="tactical-center" className="lg:col-span-8 bg-zinc-900/50 border border-zinc-800 rounded-[2.5rem] overflow-hidden flex flex-col relative shadow-2xl">
          <AnimatePresence mode="wait">
            {selectedCase ? (
              <motion.div
                key={selectedCase.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 flex flex-col"
              >
                {/* Case Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black italic shadow-lg">
                      {selectedCase.victimName.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter">
                        {selectedCase.victimName}
                      </h2>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">{selectedCase.id.slice(0, 8)}</span>
                        <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest underline decoration-2">{selectedCase.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <a 
                      href={`tel:${selectedCase.victimDetails?.phoneNumber}`}
                      className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <Phone size={18} />
                    </a>
                    <a 
                      href={`sms:${selectedCase.victimDetails?.phoneNumber}`}
                      className="w-10 h-10 rounded-full border border-zinc-700 bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                    >
                      <MessageSquare size={18} />
                    </a>
                    <button onClick={() => setSelectedCase(null)} className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600 hover:text-white transition-colors">
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
                  {/* Map Toggle Area */}
                  <div className="h-[300px] w-full bg-zinc-950 rounded-3xl border border-zinc-800 overflow-hidden relative group">
                    <MapComponent 
                      victimLocation={selectedCase.location} 
                      responderLocation={lastLocation} 
                      otherResponders={otherResponders}
                      showPath={true}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                       <span className="bg-indigo-600 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-2xl">Enter Tactical Map</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Victim Intel */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Victim Payload</h4>
                      <div className="bg-zinc-950 p-6 rounded-3xl border border-zinc-800 space-y-4">
                        <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
                          <span className="text-[9px] font-black text-zinc-700 uppercase">Med Profile</span>
                          <span className="text-xs font-black text-red-500 uppercase">{selectedCase.medicalSnapshot?.bloodGroup || "O+"}</span>
                        </div>
                        <div>
                          <p className="text-[9px] font-black text-zinc-700 uppercase mb-2">Detailed Intel</p>
                          <p className="text-xs text-zinc-400 leading-relaxed italic">
                            "{selectedCase.description || "No manual description provided. Voice logs active."}"
                          </p>
                        </div>
                        {selectedCase.incidentImage && (
                          <div className="mt-4 rounded-xl overflow-hidden border border-zinc-800 aspect-video bg-zinc-900">
                            <img src={selectedCase.incidentImage} className="w-full h-full object-cover" alt="Incident" />
                          </div>
                        )}
                        {selectedCase.audioDescription && (
                          <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-zinc-900">
                            <h5 className="text-[9px] font-black text-zinc-600 uppercase mb-2">Voice Evidence</h5>
                            <audio controls src={selectedCase.audioDescription} className="w-full" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Tactical Advice */}
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Tactical Routing (Gemini AI)</h4>
                       <div className="bg-indigo-600/5 p-6 rounded-3xl border border-indigo-500/20 space-y-4">
                          <div className="flex items-center gap-3">
                            <Zap size={20} className="text-indigo-400" />
                            <p className="text-[10px] text-indigo-300 font-bold uppercase leading-tight tracking-wider">
                              {getTrafficMultiplier(selectedCase.location) > 1.4 
                                ? "Heavy traffic detected on primary route. System suggesting alternative back-alleys/tactical lanes."
                                : "Traffic fluid. Primary route clear. Responder proximity is optimal."}
                            </p>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                               <p className="text-[7px] font-black text-zinc-600 uppercase mb-1">Route Safety</p>
                               <p className="text-[10px] font-black text-green-500 italic uppercase">Secure</p>
                            </div>
                            <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800">
                               <p className="text-[7px] font-black text-zinc-600 uppercase mb-1">Congestion Info</p>
                               <p className={`text-[10px] font-black italic uppercase ${getTrafficMultiplier(selectedCase.location) > 1.4 ? 'text-red-500' : 'text-green-500'}`}>
                                 {Math.round((getTrafficMultiplier(selectedCase.location) - 1) * 100)}% Delay
                               </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                             <div className="flex justify-between items-center text-[10px]">
                                <span className="text-zinc-500 uppercase">Estimated Interception</span>
                                <span className="text-white font-black italic">
                                  {lastLocation 
                                    ? Math.round(getDistance(lastLocation, selectedCase.location) * 2 * getTrafficMultiplier(selectedCase.location)) 
                                    : '--'} min
                                </span>
                             </div>
                             <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: '40%' }}
                                  className="h-full bg-indigo-500" 
                                />
                             </div>
                          </div>
                       </div>
                    </div>
                  </div>

                {/* Actions Bar */}
                <div className="mt-auto pt-8 border-t border-zinc-800 flex gap-4">
                  {selectedCase.status === EmergencyStatus.UNASSIGNED || selectedCase.status === EmergencyStatus.ACTIVE ? (
                    <button 
                      onClick={() => handleAcceptCase(selectedCase.id)}
                      className="flex-1 bg-white text-black py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-white/5"
                    >
                      Accept Case
                    </button>
                  ) : selectedCase.responderId === auth.currentUser?.uid ? (
                    <div className="flex-1 flex gap-4">
                      {selectedCase.status === EmergencyStatus.ASSIGNED && (
                        <button 
                          onClick={() => handleStatusUpdate(selectedCase.id, EmergencyStatus.IN_PROGRESS)}
                          className="flex-1 bg-indigo-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs"
                        >
                          Mark Reach / In Progress
                        </button>
                      )}
                      {selectedCase.status === EmergencyStatus.IN_PROGRESS && (
                        <button 
                          onClick={() => handleStatusUpdate(selectedCase.id, EmergencyStatus.SOLVED)}
                          className="flex-1 bg-green-600 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs"
                        >
                          Mark Completed
                        </button>
                      )}
                    </div>
                  ) : (
                    <button disabled className="flex-1 bg-zinc-800 text-zinc-500 py-5 rounded-2xl font-black uppercase tracking-widest text-xs">Case Taken by Another Unit</button>
                  )}
                  <button onClick={() => handleSkipCase(selectedCase.id)} className="px-8 border border-zinc-800 text-zinc-600 py-5 rounded-2xl font-black uppercase tracking-widest text-[10px]">Ignore / Skip</button>
                </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-10 opacity-30">
                <Target size={120} className="mb-8 text-zinc-600" />
                <h3 className="text-2xl font-display font-black text-white italic uppercase tracking-tighter mb-2">No Case Selected</h3>
                <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Select a channel from the left uplink to begin tactical coordination</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  const renderCitizenDashboard = () => (
    <div className="flex-1 flex flex-col p-6 lg:p-10 max-w-7xl mx-auto w-full space-y-8 overflow-y-auto">
      {/* Modes Toggle */}
      <div className="flex bg-zinc-900 border border-zinc-800 p-1.5 rounded-2xl self-center shadow-xl">
        <button 
          onClick={() => setActiveView('USER_MODE')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeView === 'USER_MODE' ? 'bg-indigo-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          SOS Interface
        </button>
        <button 
          onClick={() => setActiveView('RESPONDER_MODE')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeView === 'RESPONDER_MODE' ? 'bg-red-600 text-white shadow-lg' : 'text-zinc-500 hover:text-white'}`}
        >
          Responder Core
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeView === 'USER_MODE' ? (
          <motion.div 
            key="user"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex flex-col gap-8 relative"
          >
            {/* Voice Recognition Active Feedback */}
            <AnimatePresence>
              {isVoiceListening && !isSOSActive && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-zinc-950/90 border border-blue-500/30 p-4 rounded-3xl flex flex-col gap-2 backdrop-blur-xl shadow-2xl mb-4"
                >
                  <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                            {[1, 2, 3].map(i => (
                              <motion.div 
                                key={i}
                                animate={{ height: [4, 12, 4] }}
                                transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.1 }}
                                className="w-1 bg-blue-500 rounded-full"
                              />
                            ))}
                        </div>
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Tactical Listening Active</span>
                      </div>
                      <button onClick={() => setIsVoiceListening(false)} className="text-zinc-600 hover:text-white transition-colors">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Disable</span>
                      </button>
                  </div>
                  <p className="text-[9px] font-mono text-zinc-400 italic">Hands-free trigger phrase: "TACTICAL SOS" or "EMERGENCY EMERGENCY"</p>
                  <div className="h-px bg-zinc-800 my-1" />
                  <p className="text-[10px] font-mono text-white/50 truncate">
                      {voiceTranscript ? `> ${voiceTranscript}` : '> AWAITING TACTICAL COMMAND...'}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="text-center space-y-2">
              <h2 className="text-5xl font-display font-black text-white italic uppercase tracking-tighter">USER MODE</h2>
              <p className="text-[10px] font-mono font-black text-zinc-500 uppercase tracking-[0.5em]">Command Hub Active</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
              <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-8 flex flex-col items-center justify-center shadow-2xl relative overflow-hidden min-h-[400px]">
                <div className="absolute top-0 left-0 p-8 opacity-5">
                   <Shield size={200} />
                </div>
                <div className="text-center mb-8 relative z-10">
                  <h3 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-2">Instant Emergency Uplink</h3>
                  <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest leading-none">Tap for Active SOS</p>
                </div>
                
                <SOSButton 
                  isTriggered={isSOSActive} 
                  onTrigger={(type) => {
                    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
                    triggerGuidedSOS();
                  }} 
                  type={EmergencyType.MANUAL}
                />
                
                <button 
                  onClick={() => setShowGuidedSOS(true)}
                  className="mt-8 px-8 py-3 bg-red-600/10 border border-red-500/30 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-xl"
                >
                  Structured Report (Guided)
                </button>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <ShieldCheck size={200} />
                </div>
                <div className="relative z-10">
                  <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-8">Tactical Profile</h3>
                  <div className="space-y-6">
                     <div className="flex items-center gap-6">
                       <div className="w-16 h-16 bg-indigo-600/10 rounded-2xl flex items-center justify-center text-indigo-500 border border-indigo-500/20">
                          <User size={32} />
                       </div>
                       <div>
                          <p className="text-xl font-black text-white uppercase italic tracking-tight">{userData?.name}</p>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Operator Identity</p>
                       </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
                          <p className="text-[9px] font-black text-zinc-700 uppercase mb-2">Blood Type</p>
                          <p className="text-2xl font-black text-red-500 italic">{userData?.medicalInfo?.bloodGroup || 'O+'}</p>
                        </div>
                        <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800">
                          <p className="text-[9px] font-black text-zinc-700 uppercase mb-2">Signal Status</p>
                          <p className="text-sm font-black text-green-500 uppercase">Secured</p>
                        </div>
                     </div>
                  </div>
                </div>
                <button 
                  onClick={() => setShowProfileEditor(true)}
                  className="w-full mt-10 py-5 bg-ui-surface-hover rounded-2xl text-[10px] font-black text-ui-text-muted uppercase tracking-widest hover:text-white transition-all shadow-lg"
                >
                  Edit Tactical Profile
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="responder"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex-1 flex flex-col min-h-[600px]"
          >
            {renderResponderDashboard()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Guided SOS Section */}
      <AnimatePresence>
        {showGuidedSOS && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full bg-zinc-900 border border-zinc-800 rounded-[3rem] p-6 lg:p-10 shadow-2xl relative overflow-hidden mb-8"
          >
             <button onClick={() => setShowGuidedSOS(false)} className="absolute top-6 right-6 text-zinc-600 hover:text-white z-20">
               <X />
             </button>
             <div className="mb-10 text-center">
               <h2 className="text-3xl font-display font-black text-white italic uppercase tracking-tighter">STRUCTURED SOS REPORT</h2>
               <p className="text-[9px] font-mono text-zinc-500 uppercase tracking-widest mt-2">Active Strategic Documentation</p>
               <div className="flex gap-2 justify-center mt-6">
                 {[1, 2, 3].map(i => (
                   <div key={i} className={`h-1 w-12 rounded-full transition-all duration-500 ${i <= sosStep ? 'bg-red-500' : 'bg-zinc-800'}`} />
                 ))}
               </div>
             </div>

             <AnimatePresence mode="wait">
               {sosStep === 1 && (
                 <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                    <div 
                      onClick={() => {
                        setSosData(prev => ({ ...prev, image: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?q=80&w=800' }));
                      }}
                      className={`aspect-video rounded-3xl border-2 flex flex-col items-center justify-center gap-4 group cursor-pointer transition-all ${
                         sosData.image ? 'bg-indigo-600/10 border-indigo-500' : 'bg-zinc-950 border-zinc-800 hover:border-red-500'
                      }`}
                    >
                       {sosData.image ? (
                         <img src={sosData.image} className="w-full h-full object-cover rounded-3xl opacity-50" alt="Captured" />
                       ) : (
                         <>
                           <Camera className="text-zinc-600 group-hover:text-red-500 transition-colors" size={48} />
                           <p className="text-xs font-black text-zinc-500 uppercase tracking-widest text-center px-4">Tap to Capture Tactical Documentation</p>
                         </>
                       )}
                    </div>
                    <button onClick={() => setSosStep(2)} className="w-full bg-red-600 py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-red-900/20 active:scale-95 transition-all">
                      {sosData.image ? 'Next: Voice Update' : 'Skip Documentation'}
                    </button>
                 </motion.div>
               )}
               {sosStep === 2 && (
                 <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-8">
                    <div 
                      onClick={() => {
                        setSosData(prev => ({ ...prev, audio: 'VOICE_LINK_ESTABLISHED' }));
                      }}
                      className={`p-10 rounded-3xl border-2 flex flex-col items-center justify-center gap-4 group cursor-pointer transition-all ${
                         sosData.audio ? 'bg-indigo-600/10 border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]' : 'bg-zinc-950 border-zinc-800 hover:border-indigo-500'
                      }`}
                    >
                       <Mic className={`${sosData.audio ? 'text-indigo-500 animate-pulse' : 'text-zinc-600 group-hover:text-indigo-500'} transition-colors`} size={48} />
                       <p className="text-xs font-black text-zinc-500 uppercase tracking-widest text-center">{sosData.audio ? 'Voice Stream Active' : 'Tap for Voice Incident Log'}</p>
                    </div>
                    <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl">
                       <textarea 
                         value={sosData.description}
                         onChange={(e) => setSosData(prev => ({ ...prev, description: e.target.value }))}
                         placeholder="Additional context (optional)..."
                         className="w-full bg-transparent border-none text-xs text-white placeholder:text-zinc-700 focus:ring-0 min-h-[80px] uppercase font-black"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                     <button onClick={() => setSosStep(1)} className="py-5 bg-zinc-800 rounded-2xl font-black uppercase text-[10px] text-zinc-400 active:scale-95 transition-all">Back</button>
                     <button onClick={() => setSosStep(3)} className="bg-red-600 py-5 rounded-2xl font-black uppercase text-xs tracking-widest active:scale-95 transition-all">Verify Position</button>
                    </div>
                 </motion.div>
               )}
               {sosStep === 3 && (
                 <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-center">Tactical Location Verification</p>
                    
                    <div className="space-y-2">
                      <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Select Incident Severity</p>
                      <div className="grid grid-cols-4 gap-2">
                        {['low', 'medium', 'high', 'critical'].map(sev => (
                          <button
                            key={sev}
                            onClick={() => setSosData(prev => ({ ...prev, severity: sev as any }))}
                            className={`py-3 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all ${
                              sosData.severity === sev ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                            }`}
                          >
                            {sev}
                          </button>
                        ))}
                      </div>
                    </div>

                    {sosData.location && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-green-600/10 p-4 rounded-2xl border border-green-500/30 flex items-center gap-3">
                         <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center text-green-500">
                            <CheckCircle size={16} />
                         </div>
                         <div className="flex-1">
                            <p className="text-[8px] font-black text-green-500 uppercase">GPS Lock Confirmed ({sosData.locationMethod})</p>
                            <p className="text-[10px] font-mono text-white tabular-nums">{sosData.location.lat.toFixed(5)}, {sosData.location.lng.toFixed(5)}</p>
                         </div>
                      </motion.div>
                    )}

                    <div className="grid grid-cols-1 gap-3">
                       <button 
                         onClick={handleUseCurrentLocation} 
                         disabled={isLocating}
                         className={`w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                           isLocating ? 'bg-zinc-800 text-zinc-500 animate-pulse' : 
                           sosData.locationMethod === 'device' ? 'bg-indigo-600 text-white' :
                           'bg-zinc-800 text-zinc-400 hover:text-white'
                         }`}
                       >
                         <Target size={16} className={isLocating ? 'animate-spin' : ''} /> 
                         {isLocating ? 'Locating...' : 'Refresh Device GPS'}
                       </button>
                    </div>

                    <div className="pt-6 border-t border-zinc-800 flex flex-col gap-3">
                     <button 
                       onClick={triggerGuidedSOS}
                       className="w-full bg-red-600 py-6 rounded-3xl font-black uppercase text-sm tracking-widest shadow-2xl shadow-red-900/40 hover:bg-red-500 transition-all active:scale-[0.98]"
                     >
                       Broadcast Signal Now
                     </button>
                     <button onClick={() => setSosStep(2)} className="w-full py-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">
                       Back to Details
                     </button>
                    </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-ui-bg text-ui-text font-sans flex flex-col overflow-hidden selection:bg-ui-primary selection:text-white">
      {/* Header */}
      <nav className="h-20 border-b border-ui-border flex items-center justify-between px-8 bg-ui-bg/80 backdrop-blur-xl sticky top-0 z-[60]">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-ui-primary rounded-xl flex items-center justify-center shadow-xl shadow-ui-primary/40">
             <ShieldCheck className="text-white" size={24} />
           </div>
           <div>
             <h1 className="text-2xl font-display font-black tracking-tighter uppercase italic text-ui-text flex items-center gap-1">
               SURAKSHA <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
             </h1>
             <p className="text-[8px] font-mono font-black text-ui-text-muted uppercase tracking-[0.4em] mt-0.5 leading-none">Global Defense Uplink</p>
           </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Voice Command Toggle */}
          <button 
            onClick={toggleVoiceActivation}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
              isVoiceListening
                ? 'bg-blue-500/10 border-blue-500/50 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                : 'bg-zinc-800 border-zinc-700 text-zinc-500'
            }`}
          >
            <div className="relative">
              <Mic size={14} className={isVoiceListening ? 'animate-pulse' : ''} />
              {isVoiceListening && (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.5, opacity: 0 }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 bg-blue-500 rounded-full"
                />
              )}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">
              {isVoiceListening ? 'Voice Active' : 'Voice Off'}
            </span>
          </button>

          {/* Availability Toggle for Responders */}
          {userRole === Role.RESPONDER && (
            <button 
              onClick={toggleAvailability}
              className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${
                userData?.isAvailable !== false 
                  ? 'bg-green-500/10 border-green-500/50 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]' 
                  : 'bg-zinc-800 border-zinc-700 text-zinc-500'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${userData?.isAvailable !== false ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}`} />
              <span className="text-[10px] font-black uppercase tracking-widest">
                {userData?.isAvailable !== false ? 'Available' : 'Unavailable'}
              </span>
            </button>
          )}

          {/* Theme Switcher */}
          <div className="flex bg-ui-surface border border-ui-border p-1 rounded-xl shadow-inner">
            <button 
              onClick={() => setTheme('light')}
              className={`p-2 rounded-lg transition-all ${theme === 'light' ? 'bg-ui-text text-ui-bg shadow-md' : 'text-ui-text-muted hover:text-ui-text'}`}
              title="Light Mode"
            >
              <Sun size={14} />
            </button>
            <button 
              onClick={() => setTheme('dark')}
              className={`p-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-ui-surface-hover text-ui-text shadow-md' : 'text-ui-text-muted hover:text-ui-text'}`}
              title="Dark Mode"
            >
              <Moon size={14} />
            </button>
            <button 
              onClick={() => setTheme('high-contrast')}
              className={`p-2 rounded-lg transition-all ${theme === 'high-contrast' ? 'bg-ui-primary text-ui-bg shadow-md' : 'text-ui-text-muted hover:text-ui-text'}`}
              title="High Contrast"
            >
              <Contrast size={14} />
            </button>
          </div>

          <div className="hidden md:flex flex-col items-end mr-4">
            <p className="text-[8px] font-mono font-black text-ui-text-muted uppercase tracking-widest leading-none mb-1">Authenticated As</p>
            <p className="text-[10px] font-black text-ui-text uppercase italic tracking-widest">{userRole}</p>
          </div>
          <button onClick={onLogout} className="w-12 h-12 bg-ui-surface border border-ui-border rounded-2xl flex items-center justify-center transition-all hover:bg-ui-surface-hover text-ui-text-muted hover:text-red-500 active:scale-95 group shadow-xl">
             <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-hidden">
        {userRole === Role.RESPONDER ? renderResponderDashboard() : renderCitizenDashboard()}
      </main>

      <AnimatePresence>
        {isSOSActive && (
          <ImmediateSOSView 
            onDismiss={() => {
              setIsSOSActive(false);
              setActiveCaseId(null);
            }} 
            initialCaseId={activeCaseId}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfileEditor && userData && (
          <ProfileEditor 
            user={userData} 
            onClose={() => setShowProfileEditor(false)}
            onUpdate={(updated) => setUserData(updated)}
            onLogout={onLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


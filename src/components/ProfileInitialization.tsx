import React, { useState, useEffect, useRef } from 'react';
import { Camera, Droplet, AlertCircle, Phone, User, ShieldCheck, FileText, Briefcase, Mail, Calendar, Hash, Upload, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Role, MedicalInfo, UserType } from '@/src/types';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/src/lib/firebase';

interface ProfileInitializationProps {
  user: any;
  onComplete: (profile: UserProfile) => void;
  initialUserType: 'citizen' | 'emergency_department';
}

export default function ProfileInitialization({ user, onComplete, initialUserType }: ProfileInitializationProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: user.displayName || '',
    email: user.email || '',
    phone: '',
    gender: '',
    age: '',
    bloodGroup: '',
    medicalConditions: '',
    department: '',
    occupation: '',
    idNumber: '',
    proofOfIdentity: null as string | null,
    serviceId: null as string | null,
    photoPath: null as string | null,
  });

  const [activeCameraField, setActiveCameraField] = useState<'photoPath' | 'proofOfIdentity' | 'serviceId' | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const steps = initialUserType === 'citizen' 
    ? ['Bio', 'Medical', 'Document', 'Confirm']
    : ['Bio', 'Professional', 'Medical', 'Document', 'Confirm'];

  const totalSteps = steps.length;

  const startCamera = async (field: 'photoPath' | 'proofOfIdentity' | 'serviceId') => {
    setActiveCameraField(field);
    setIsCapturing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access failed", err);
      setIsCapturing(false);
      setActiveCameraField(null);
    }
  };

  const capturePhoto = () => {
    if (activeCameraField && videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setFormData(prev => ({ ...prev, [activeCameraField]: dataUrl }));
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) stream.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
        setActiveCameraField(null);
      }
    }
  };

  const handleFinalize = async () => {
    setIsVerifying(true);
    
    const medicalInfo: MedicalInfo = {
      bloodGroup: formData.bloodGroup,
      conditions: formData.medicalConditions,
      allergies: 'None',
      complications: 'None'
    };

    const role = initialUserType === 'emergency_department' ? Role.RESPONDER : Role.USER;
    const userType = initialUserType === 'emergency_department' ? UserType.EMERGENCY_DEPARTMENT : UserType.CITIZEN;

    const profile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      name: formData.name,
      gender: formData.gender,
      age: parseInt(formData.age),
      phoneNumber: formData.phone,
      role: role,
      userType: userType,
      department: formData.department,
      occupation: formData.occupation,
      proofOfIdentity: formData.proofOfIdentity || '',
      serviceId: formData.serviceId || '',
      photo: formData.photoPath || '',
      medicalInfo,
      lastActive: Date.now()
    };

    try {
      await setDoc(doc(db, 'users', user.uid), profile);
      setTimeout(() => {
        setIsVerifying(false);
        onComplete(profile);
      }, 2000);
    } catch (err) {
      console.error("Save failed", err);
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ui-bg p-4 font-sans text-ui-text overflow-y-auto">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#3f3f46_1px,_transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none"></div>
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-lg bg-ui-surface border border-ui-border rounded-[2.5rem] p-8 shadow-2xl overflow-hidden my-auto"
      >
        <canvas ref={canvasRef} className="hidden" />

        {/* Progress bar */}
        <div className="flex gap-1 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i + 1 <= step ? 'bg-ui-primary' : 'bg-ui-border'}`}></div>
          ))}
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-display font-black uppercase italic tracking-tighter text-ui-text">
            {steps[step - 1]}
          </h2>
          <p className="text-[10px] text-ui-text-muted font-mono uppercase tracking-[0.3em] font-bold mt-1">Suraksha Tactical Registration</p>
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: BIO (CITIZEN & RESPONDER) */}
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    placeholder="FULL NAME"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                    <input 
                      type="number"
                      placeholder="AGE"
                      value={formData.age}
                      onChange={e => setFormData({...formData, age: e.target.value})}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:border-indigo-500 outline-none transition-colors"
                    />
                  </div>
                  <select 
                    value={formData.gender}
                    onChange={e => setFormData({...formData, gender: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 px-4 text-white font-bold focus:border-indigo-500 outline-none"
                  >
                    <option value="">GENDER</option>
                    <option value="male">MALE</option>
                    <option value="female">FEMALE</option>
                    <option value="other">OTHER</option>
                  </select>
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    placeholder="PHONE NUMBER"
                    value={formData.phone}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:border-indigo-500 outline-none transition-colors"
                  />
                </div>
              </div>
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20"
              >
                Continue
              </button>
            </motion.div>
          )}

          {/* STEP 2: PROFESSIONAL (RESPONDER ONLY) */}
          {step === 2 && initialUserType === 'emergency_department' && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    placeholder="DEPARTMENT (E.G. POLICE, FIRE, HOSPITAL)"
                    value={formData.department}
                    onChange={e => setFormData({...formData, department: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:border-indigo-500 outline-none transition-colors uppercase"
                  />
                </div>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <input 
                    placeholder="ID NUMBER (EMPLOYEE ID / BADGE)"
                    value={formData.idNumber}
                    onChange={e => setFormData({...formData, idNumber: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:border-indigo-500 outline-none transition-colors uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setStep(1)} className="py-4 rounded-xl border border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">Back</button>
                <button onClick={() => setStep(3)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20">Next</button>
              </div>
            </motion.div>
          )}

          {/* STEP 3 (or 2 for Citizen): MEDICAL */}
          {((step === 3 && initialUserType === 'emergency_department') || (step === 2 && initialUserType === 'citizen')) && (
            <motion.div 
              key="step-medical"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-3">
                <div className="relative">
                  <Droplet className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={16} />
                  <select 
                    value={formData.bloodGroup}
                    onChange={e => setFormData({...formData, bloodGroup: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold appearance-none focus:border-indigo-500 outline-none"
                  >
                    <option value="">BLOOD GROUP</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <AlertCircle className="absolute left-4 top-4 text-zinc-600" size={16} />
                  <textarea 
                    placeholder="MEDICAL CONDITIONS / ALLERGIES"
                    value={formData.medicalConditions}
                    onChange={e => setFormData({...formData, medicalConditions: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 min-h-[120px] focus:border-indigo-500 outline-none resize-none uppercase"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setStep(step - 1)} className="py-4 rounded-xl border border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">Back</button>
                <button onClick={() => setStep(step + 1)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20">Next</button>
              </div>
            </motion.div>
          )}

          {/* STEP: DOCUMENTATION */}
          {((step === 4 && initialUserType === 'emergency_department') || (step === 3 && initialUserType === 'citizen')) && (
            <motion.div 
              key="step-docs"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="space-y-4">
                {/* Proof of Identity */}
                <div className="space-y-2">
                  <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Proof of Identity (Aadhar/PAN)</label>
                  <div className="flex gap-2">
                    <button onClick={() => startCamera('proofOfIdentity')} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                      <Camera className="text-zinc-400" />
                      <span className="text-[8px] font-bold text-zinc-500 uppercase">Capture Document</span>
                    </button>
                    {formData.proofOfIdentity && <div className="w-16 h-16 bg-green-500/20 border border-green-500 rounded-xl flex items-center justify-center"><Check className="text-green-500" /></div>}
                  </div>
                </div>

                {initialUserType === 'emergency_department' && (
                  <>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Service / Department ID</label>
                      <div className="flex gap-2">
                        <button onClick={() => startCamera('serviceId')} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                          <Upload size={16} className="text-zinc-400" />
                          <span className="text-[8px] font-bold text-zinc-500 uppercase">Upload ID Proof</span>
                        </button>
                        {formData.serviceId && <div className="w-16 h-16 bg-green-500/20 border border-green-500 rounded-xl flex items-center justify-center"><Check className="text-green-500" /></div>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Official Photo</label>
                      <div className="flex gap-2">
                        <button onClick={() => startCamera('photoPath')} className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-zinc-700 transition-all">
                          <Camera size={16} className="text-zinc-400" />
                          <span className="text-[8px] font-bold text-zinc-500 uppercase">Take Photo</span>
                        </button>
                        {formData.photoPath && <div className="w-16 h-16 bg-green-500/20 border border-green-500 rounded-xl flex items-center justify-center"><Check className="text-green-500" /></div>}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {isCapturing && (
                <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-6">
                  <div className="relative w-full max-w-sm aspect-square bg-zinc-900 rounded-3xl overflow-hidden border-2 border-white/10">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                  </div>
                  <div className="mt-8 flex gap-4">
                    <button onClick={() => setIsCapturing(false)} className="px-6 py-3 bg-zinc-900 text-white rounded-xl font-bold">Cancel</button>
                    <button 
                      onClick={capturePhoto}
                      className="px-10 py-3 bg-white text-black rounded-xl font-black uppercase tracking-widest text-xs"
                    >
                      Capture Frame
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 mt-8">
                <button onClick={() => setStep(step - 1)} className="py-4 rounded-xl border border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">Back</button>
                <button onClick={() => setStep(step + 1)} className="bg-indigo-600 text-white py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20">Review</button>
              </div>
            </motion.div>
          )}

          {/* STEP: CONFIRMATION */}
          {step === totalSteps && (
            <motion.div 
              key="step-confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="space-y-6"
            >
              <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-3xl space-y-3">
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-[9px] font-black text-zinc-600 uppercase">Uplink Role</span>
                  <span className="text-xs font-black text-white uppercase italic">{initialUserType}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-[9px] font-black text-zinc-600 uppercase">Operational ID</span>
                  <span className="text-xs font-bold text-white uppercase">{formData.name}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-800 pb-2">
                  <span className="text-[9px] font-black text-zinc-600 uppercase">Contact Link</span>
                  <span className="text-xs font-bold text-white tracking-widest">{formData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[9px] font-black text-zinc-600 uppercase">Vitals</span>
                  <span className="text-xs font-bold text-red-500 uppercase">{formData.bloodGroup}</span>
                </div>
              </div>

              <div className="bg-indigo-500/5 p-4 rounded-2xl border border-indigo-500/20 flex gap-4 items-start">
                <ShieldCheck className="text-indigo-400 shrink-0" size={24} />
                <p className="text-[9px] text-indigo-300 font-medium leading-relaxed uppercase">
                  Uplink finalized. Operational parameters are within secure limits. Your credentials have been broadcast to the global relay.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setStep(step - 1)} className="py-4 rounded-xl border border-zinc-800 text-zinc-500 font-bold uppercase text-[10px]">Back</button>
                <button 
                  onClick={handleFinalize}
                  disabled={isVerifying}
                  className="bg-white text-black py-4 rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] transition-all shadow-xl shadow-white/5 disabled:opacity-50"
                >
                  {isVerifying ? 'Synchronizing...' : 'Confirm Identity'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

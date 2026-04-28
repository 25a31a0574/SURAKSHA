import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Phone, 
  Droplet, 
  FileText, 
  Save, 
  X, 
  Camera, 
  Upload, 
  Check,
  Building,
  Briefcase,
  AlertCircle,
  LogOut
} from 'lucide-react';
import { UserProfile, Role, UserType } from '../types';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError } from '@/src/lib/firebase';
import { OperationType } from '../types';

interface ProfileEditorProps {
  user: UserProfile;
  onClose: () => void;
  onUpdate: (updated: UserProfile) => void;
  onLogout: () => void;
}

export default function ProfileEditor({ user, onClose, onUpdate, onLogout }: ProfileEditorProps) {
  const [formData, setFormData] = useState<UserProfile>(user);
  const [step, setStep] = useState<'EDIT' | 'CONFIRM'>('EDIT');
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [verifyingIndex, setVerifyingIndex] = useState<number | null>(null);
  const [otpValue, setOtpValue] = useState<string>('');
  const [activeCameraField, setActiveCameraField] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async (field: string) => {
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
        
        const stream = videoRef.current.srcObject as MediaStream;
        if (stream) stream.getTracks().forEach(track => track.stop());
        setIsCapturing(false);
        setActiveCameraField(null);
      }
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        ...formData,
        lastActive: Date.now()
      });
      onUpdate(formData);
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] bg-ui-bg/95 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl bg-ui-surface border border-ui-border rounded-[3rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="p-8 border-b border-ui-border flex justify-between items-center bg-ui-bg/50">
          <div>
            <h2 className="text-2xl font-display font-black text-ui-text italic uppercase tracking-tighter">Edit Tactical Profile</h2>
            <p className="text-[10px] font-mono font-black text-ui-text-muted uppercase tracking-[0.3em]">ID: {user.uid.slice(0, 10).toUpperCase()}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onLogout} title="Log Out" className="w-10 h-10 rounded-full bg-ui-border flex items-center justify-center text-red-500 hover:text-red-600 transition-colors">
              <LogOut size={20} />
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full bg-ui-border flex items-center justify-center text-ui-text-muted hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 no-scrollbar">
          {step === 'EDIT' ? (
            <div className="space-y-10">
              {/* Emergency Contacts */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <Phone size={16} className="text-ui-primary" />
                  <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Emergency Contacts</h3>
                </div>
                <div className="space-y-4">
                  {(formData.emergencyContacts || []).map((contact, index) => (
                    <div key={index} className="flex gap-2">
                       <div className="flex-1 bg-ui-bg p-4 rounded-2xl border border-ui-border space-y-3">
                         <div className="grid grid-cols-2 gap-2">
                           <input 
                             placeholder="Contact Name" 
                             value={contact.name} 
                             onChange={e => {
                               const newContacts = [...(formData.emergencyContacts || [])];
                               newContacts[index].name = e.target.value;
                               setFormData({...formData, emergencyContacts: newContacts});
                             }}
                             className="bg-ui-surface p-3 rounded-lg text-xs w-full"
                           />
                           <input 
                             placeholder="Relationship (e.g. Spouse)" 
                             value={contact.relationship} 
                             onChange={e => {
                               const newContacts = [...(formData.emergencyContacts || [])];
                               newContacts[index].relationship = e.target.value;
                               setFormData({...formData, emergencyContacts: newContacts});
                             }}
                             className="bg-ui-surface p-3 rounded-lg text-xs w-full"
                           />
                          </div>
                          <div className="flex gap-2">
                             <input 
                                placeholder="Phone Number (e.g. +1...)" 
                                value={contact.phoneNumber} 
                                onChange={e => {
                                  const newContacts = [...(formData.emergencyContacts || [])];
                                  newContacts[index].phoneNumber = e.target.value;
                                  setFormData({...formData, emergencyContacts: newContacts});
                                }}
                                className="flex-1 bg-ui-surface p-3 rounded-lg text-xs w-full"
                             />
                             {contact.isVerified ? (
                               <div className="flex items-center gap-1 text-[10px] text-green-500 font-bold px-3">
                                 <Check size={12} /> Verified
                               </div>
                             ) : verifyingIndex === index ? (
                               <div className="flex items-center gap-2">
                                  <input 
                                     placeholder="OTP"
                                     value={otpValue}
                                     onChange={e => setOtpValue(e.target.value)}
                                     className="w-16 bg-ui-surface p-3 rounded-lg text-xs"
                                  />
                                  <button onClick={() => {
                                     // Simulation: assume OTP 1234 is correct
                                     if (otpValue === '1234') { 
                                       const newContacts = [...(formData.emergencyContacts || [])];
                                       newContacts[index].isVerified = true;
                                       setFormData({...formData, emergencyContacts: newContacts});
                                       setVerifyingIndex(null);
                                       setOtpValue('');
                                     } else {
                                        alert("Invalid OTP");
                                     }
                                  }} className="bg-ui-primary text-white p-3 rounded-lg text-xs font-bold">Verify</button>
                               </div>
                             ) : (
                               <button 
                                 onClick={() => setVerifyingIndex(index)}
                                 className="bg-ui-border hover:bg-ui-border-hover text-[10px] px-3 rounded-lg font-bold"
                               >
                                 Verify
                               </button>
                             )}
                          </div>
                       </div>
                       <button 
                         onClick={() => {
                           const newContacts = [...(formData.emergencyContacts || [])];
                           newContacts.splice(index, 1);
                           setFormData({...formData, emergencyContacts: newContacts});
                         }}
                         className="p-4 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-900/40"
                       >
                         <X size={16} />
                       </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => setFormData({...formData, emergencyContacts: [...(formData.emergencyContacts || []), { name: '', phoneNumber: '', relationship: '' }]})}
                    className="w-full py-4 border-2 border-dashed border-ui-border rounded-xl text-[10px] font-black uppercase text-ui-text-muted hover:border-ui-primary hover:text-ui-primary transition-all flex items-center justify-center gap-2"
                  >
                    + Link Emergency Contact
                  </button>
                </div>
              </section>

              {/* Biological Data */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <User size={16} className="text-ui-primary" />
                  <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Personal Identity</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Operator Name</label>
                    <input 
                      value={formData.name || ''} 
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 text-ui-text font-bold focus:border-ui-primary outline-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Phone Uplink</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-ui-text-muted" size={16} />
                      <input 
                        value={formData.phoneNumber || ''} 
                        onChange={e => setFormData({...formData, phoneNumber: e.target.value})}
                        className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 pl-12 text-ui-text font-bold focus:border-ui-primary outline-none"
                        placeholder="Uplink Number"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Medical Data */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <Droplet size={16} className="text-red-500" />
                  <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Vitals & Medical</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Blood Group</label>
                    <select 
                      value={formData.medicalInfo?.bloodGroup || ''}
                      onChange={e => setFormData({...formData, medicalInfo: { ...formData.medicalInfo, bloodGroup: e.target.value }})}
                      className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 text-ui-text font-bold focus:border-ui-primary outline-none"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Health Conditions / Allergies</label>
                  <textarea 
                    value={formData.medicalInfo?.conditions || ''}
                    onChange={e => setFormData({...formData, medicalInfo: { ...formData.medicalInfo, conditions: e.target.value }})}
                    className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 text-ui-text font-bold focus:border-ui-primary outline-none h-32 resize-none"
                    placeholder="List all chronic conditions or severe allergies..."
                  />
                </div>
              </section>

              {/* Pro Data (if applicable) */}
              {formData.userType === UserType.EMERGENCY_DEPARTMENT && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Building size={16} className="text-blue-500" />
                    <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Professional Service</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Department</label>
                      <input 
                        value={formData.department || ''} 
                        onChange={e => setFormData({...formData, department: e.target.value})}
                        className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 text-ui-text font-bold focus:border-ui-primary outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-ui-text-muted uppercase px-2">Service ID</label>
                      <input 
                        value={formData.idNumber || ''} 
                        onChange={e => setFormData({...formData, idNumber: e.target.value})}
                        className="w-full bg-ui-bg border border-ui-border rounded-2xl p-4 text-ui-text font-bold focus:border-ui-primary outline-none"
                      />
                    </div>
                  </div>
                </section>
              )}

              {/* Certifications (if responder) */}
              {formData.role === Role.RESPONDER && (
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <Briefcase size={16} className="text-ui-primary" />
                    <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Certifications & Specialized Skills</h3>
                  </div>
                  <div className="space-y-4">
                    {(formData.certifications || []).map((cert, index) => (
                      <div key={index} className="flex gap-2">
                        <span className="flex-1 bg-ui-bg border border-ui-border rounded-2xl p-4 text-xs font-bold text-ui-text">{cert}</span>
                        <button 
                          onClick={() => {
                            const newCerts = [...(formData.certifications || [])];
                            newCerts.splice(index, 1);
                            setFormData({...formData, certifications: newCerts});
                          }}
                          className="p-4 bg-red-900/20 text-red-500 rounded-2xl hover:bg-red-900/40"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <input 
                        id="new-cert-input"
                        placeholder="Add new certification..."
                        className="flex-1 bg-ui-bg border border-ui-border rounded-2xl p-4 text-xs text-ui-text focus:border-ui-primary outline-none"
                      />
                      <button 
                        onClick={() => {
                          const input = document.getElementById('new-cert-input') as HTMLInputElement;
                          if (input && input.value) {
                            setFormData({...formData, certifications: [...(formData.certifications || []), input.value]});
                            input.value = '';
                          }
                        }}
                        className="px-6 bg-ui-primary text-white rounded-2xl font-black uppercase text-[10px] hover:bg-ui-primary-hover transition-colors"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Documents & Photo */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <FileText size={16} className="text-ui-primary" />
                  <h3 className="text-[10px] font-black text-ui-text uppercase tracking-[0.2em]">Documentation</h3>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-ui-text-muted uppercase">Proof of Identity</p>
                    <div className="aspect-video bg-ui-bg border border-ui-border rounded-2xl overflow-hidden relative group">
                      {formData.proofOfIdentity ? (
                        <img src={formData.proofOfIdentity} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <AlertCircle size={20} className="text-ui-text-muted" />
                          <span className="text-[8px] font-black text-ui-text-muted uppercase">Document Missing</span>
                        </div>
                      )}
                      <button 
                        onClick={() => startCamera('proofOfIdentity')}
                        className="absolute inset-0 bg-ui-bg/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <Camera size={24} className="text-white" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-ui-text-muted uppercase">Official Photo</p>
                    <div className="aspect-square w-32 bg-ui-bg border border-ui-border rounded-2xl overflow-hidden relative group">
                      {formData.photo ? (
                        <img src={formData.photo} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                          <Camera size={20} className="text-ui-text-muted" />
                        </div>
                      )}
                      <button 
                        onClick={() => startCamera('photo')}
                        className="absolute inset-0 bg-ui-bg/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                         <Camera size={24} className="text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-8">
              <div className="w-24 h-24 bg-ui-primary/10 rounded-full flex items-center justify-center text-ui-primary">
                <AlertCircle size={48} />
              </div>
              <div className="space-y-2">
                <h3 className="text-3xl font-display font-black text-ui-text uppercase italic">Confirm Changes?</h3>
                <p className="text-sm text-ui-text-muted max-w-sm">You are about to update your tactical profile. This will be visible to emergency responders during SOS events.</p>
              </div>
              <div className="w-full grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setStep('EDIT')}
                  className="py-5 bg-ui-surface border border-ui-border rounded-2xl text-[10px] font-black uppercase text-ui-text hover:bg-ui-surface-hover transition-colors"
                >
                  Review Again
                </button>
                <button 
                  onClick={handleSave}
                  disabled={isSaving}
                  className="py-5 bg-ui-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-ui-primary/30 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSaving ? 'Synching...' : <><Save size={14} /> Commit Changes</>}
                </button>
              </div>
            </div>
          )}
        </div>

        {step === 'EDIT' && (
          <div className="p-8 border-t border-ui-border bg-ui-bg/80 backdrop-blur-md">
            <button 
              onClick={() => setStep('CONFIRM')}
              className="w-full bg-ui-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-ui-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
            >
              <Check size={18} /> Update Tactical Record
            </button>
          </div>
        )}
      </motion.div>

      {/* Camera Capture Modal */}
      <AnimatePresence>
        {isCapturing && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center p-6"
          >
            <div className="w-full max-w-2xl aspect-video bg-zinc-900 rounded-[3rem] overflow-hidden border-2 border-zinc-800 relative shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                 <div className="w-full h-full border border-white/20 rounded-2xl" />
              </div>
            </div>
            
            <div className="mt-12 flex gap-6">
               <button 
                 onClick={() => {
                   const stream = videoRef.current?.srcObject as MediaStream;
                   if (stream) stream.getTracks().forEach(track => track.stop());
                   setIsCapturing(false);
                 }}
                 className="px-10 py-4 bg-zinc-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs"
               >
                 Abort
               </button>
               <button 
                 onClick={capturePhoto}
                 className="px-16 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
               >
                 Capture Frame
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

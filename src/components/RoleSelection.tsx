/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Shield, User, HeartPulse, Zap } from 'lucide-react';
import { Role } from '@/src/types';

interface RoleSelectionProps {
  onSelect: (role: Role) => void;
}

export default function RoleSelection({ onSelect }: RoleSelectionProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#3f3f46_1px,_transparent_1px)] [background-size:40px_40px] opacity-10 pointer-events-none"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center relative z-10"
      >
        <div className="mb-10 flex flex-col items-center">
          <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 shadow-xl">
            <HeartPulse className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="mt-6 font-display text-3xl font-black tracking-tight text-white uppercase italic">
            Identify Role
          </h1>
          <p className="mt-2 text-xs text-zinc-500 uppercase tracking-widest font-mono">Establish Identity for Dispatch</p>
        </div>

        <div className="space-y-4">
          <button
            id="role-user-btn"
            onClick={() => onSelect(Role.USER)}
            className="group relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-left transition-all hover:border-red-600/50 hover:bg-zinc-900"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <User size={64} />
            </div>
            <div className="relative z-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600/10 text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors mb-4">
                <User size={20} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Active Victim</h3>
              <p className="text-xs text-zinc-500 mt-1 uppercase font-semibold">Automatic Crash & Voice SOS Protection</p>
            </div>
          </button>

          <button
            id="role-responder-btn"
            onClick={() => onSelect(Role.RESPONDER)}
            className="group relative w-full overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-left transition-all hover:border-blue-600/50 hover:bg-zinc-900"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Shield size={64} />
            </div>
            <div className="relative z-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors mb-4">
                <Shield size={20} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Tactical Responder</h3>
              <p className="text-xs text-zinc-500 mt-1 uppercase font-semibold">Real-time Dispatch & Leaderboard Access</p>
            </div>
          </button>
        </div>
        
        <p className="mt-12 text-[10px] text-zinc-600 uppercase font-bold tracking-widest font-mono">
          Secured by SURAKSHA Protocols
        </p>
      </motion.div>
    </div>
  );
}

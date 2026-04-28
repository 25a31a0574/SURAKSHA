/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { EmergencyType } from '@/src/types';

interface SOSButtonProps {
  onTrigger: (type: EmergencyType) => void;
  isTriggered: boolean;
  type?: EmergencyType;
}

export default function SOSButton({ onTrigger, isTriggered, type = EmergencyType.MANUAL }: SOSButtonProps) {
  return (
    <div className="relative flex items-center justify-center">
      {/* Ripple Animation */}
      {!isTriggered && (
        <>
          <motion.div
            className="absolute h-64 w-64 rounded-full bg-red-600 opacity-20"
            animate={{ scale: [1, 1.5, 1], opacity: [0.1, 0.3, 0.1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className="absolute h-48 w-48 rounded-full bg-red-500 opacity-30"
            animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          />
        </>
      )}

      <motion.button
        id={`sos-trigger-${type}`}
        onClick={() => onTrigger(type)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative z-10 flex h-48 w-48 flex-col items-center justify-center rounded-full shadow-[0_0_60px_rgba(220,38,38,0.4)] border-[8px] transition-all duration-500 ${
          isTriggered 
            ? 'bg-red-950 border-red-900 scale-95 opacity-80' 
            : 'bg-red-600 border-red-500'
        }`}
      >
        <span className="font-display text-5xl font-black text-white italic tracking-tighter uppercase leading-none">
          {isTriggered ? 'SENT' : 'SOS'}
        </span>
        {!isTriggered && (
          <span className="text-[10px] text-white/60 font-black tracking-[0.2em] mt-1">{type}</span>
        )}
      </motion.button>
    </div>
  );
}


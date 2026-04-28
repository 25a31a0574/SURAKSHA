/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface EmergencyTacticalAdvice {
  hospitalName: string;
  easiestPath: string;
  emergencyPriority: string;
  firstAidSteps: string[];
}

export async function getTacticalAdvice(
  location: { lat: number; lng: number },
  nearbyHospitals: any[], // Mock list or real if we had it
  trafficCondition: string = "High Traffic"
): Promise<EmergencyTacticalAdvice> {
  const prompt = `
    Emergency Coordination for "Suraksha" App.
    Current Victim Location: Lat ${location.lat}, Lng ${location.lng}.
    Traffic Condition: ${trafficCondition}.
    Available Nearby Hospitals: ${JSON.stringify(nearbyHospitals)}.

    Based on real-time traffic and hospital data, suggest the:
    1. Best Hospital to take the patient to (considering availability and proximity).
    2. Easiest path to avoid traffic congestion.
    3. Emergency priority level.
    4. Immediate first aid steps.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            hospitalName: { type: Type.STRING },
            easiestPath: { type: Type.STRING },
            emergencyPriority: { type: Type.STRING },
            firstAidSteps: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["hospitalName", "easiestPath", "emergencyPriority", "firstAidSteps"]
        }
      }
    });

    return JSON.parse(response.text) as EmergencyTacticalAdvice;
  } catch (error) {
    console.error("Gemini AI failed:", error);
    return {
      hospitalName: "Nearest General Hospital",
      easiestPath: "Direct main road route.",
      emergencyPriority: "High",
      firstAidSteps: ["Keep patient stable", "Check vitals"]
    };
  }
}

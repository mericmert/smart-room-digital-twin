'use client';

import { useState } from 'react';
import TimeScrubberControls from '@/components/TimeScrubberControls';
import OfficeRoom3D from '@/components/OfficeRoom3D';
import SensorMetrics from '@/components/SensorMetrics';
import { SensorDataPoint } from '@/utils/dataParser';

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<SensorDataPoint | null>(null);
  const [prediction, setPrediction] = useState<{ occupancy: number; probability: number } | null>(null);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Row - Time Scrubber Controls */}
      <div className="w-full">
        <TimeScrubberControls 
          onDataSelect={(data) => {
            console.log('Data selected:', data);
            setCurrentData(data);
          }}
          onPrediction={(pred) => {
            console.log('Prediction received:', pred);
            setPrediction(pred);
          }}
        />
      </div>
      
      {/* Middle Row - 3D Office Room and Sensor Metrics */}
      <div className="w-full">
        <div className="rounded-xl p-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 3D Office Room */}
            <div className="flex-1 lg:flex-[2]">
              <OfficeRoom3D 
                data={currentData}
              />
            </div>
            
            {/* Sensor Metrics */}
            <div className="flex-1 lg:flex-[1]">
              <SensorMetrics 
                currentData={currentData}
                prediction={prediction}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

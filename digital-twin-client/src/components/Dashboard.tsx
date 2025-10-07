'use client';

import { useState } from 'react';
import TimeScrubberControls from '@/components/TimeScrubberControls';
import OfficeRoom3D from '@/components/OfficeRoom3D';
import SensorMetrics from '@/components/SensorMetrics';
import KafkaWebSocketClient from '@/components/KafkaWebSocketClient';
import LiveSensorCharts from '@/components/LiveSensorCharts';
import { SensorDataPoint } from '@/utils/dataParser';

export default function Dashboard() {
  const [currentData, setCurrentData] = useState<SensorDataPoint | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string>('');

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Row - Time Scrubber Controls */}
      <div className="w-full">
        <TimeScrubberControls 
          onDataSelect={(data) => {
            console.info('Data selected:', data);
            setCurrentData(data);
          }}
          onFileChange={(filename) => setSelectedFilename(filename)}
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
              
            {/* Sensor Metrics, Live Charts and Kafka Results */}
            <div className="flex-1 lg:flex-[1] space-y-4">
                <SensorMetrics 
                  currentData={currentData}
                />
              </div>
          </div>
        </div>
        <LiveSensorCharts key={selectedFilename} />
        <KafkaWebSocketClient />
      </div>
    </div>
  );
}

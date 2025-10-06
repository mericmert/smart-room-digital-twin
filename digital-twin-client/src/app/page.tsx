'use client';

import TimeScrubber from '@/components/TimeScrubber';


export default function Home() {


  return (
    <div className="font-sans min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">    
        <TimeScrubber 
          onDataSelect={(data) => {
            console.log('Data selected:', data);
          }}
          onPrediction={(prediction) => {
            console.log('Prediction received:', prediction);
          }}
        />
      </div>
    </div>
  );
}

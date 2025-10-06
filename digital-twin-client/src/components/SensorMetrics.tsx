'use client';

import { 
  Activity, 
  Thermometer, 
  Droplets, 
  Sun, 
  Wind, 
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { SensorDataPoint } from '@/utils/dataParser';

interface SensorMetricsProps {
  currentData: SensorDataPoint | null;
  prediction?: { occupancy: number; probability: number } | null;
}

export default function SensorMetrics({ currentData, prediction }: SensorMetricsProps) {
  return (
    <div className="space-y-4">
      {/* Prediction Display */}
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-info" />
          <h3 className="text-lg font-semibold">ML Prediction</h3>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {prediction ? (
            <>
              <div className={`p-3 rounded-lg border-2 ${
                  prediction.occupancy === 1 
                    ? 'bg-occupied-light border-occupied' 
                    : 'bg-vacant-light border-vacant'
                }`}>
                <div className="flex items-center gap-2">
                  {prediction.occupancy === 1 ? (
                    <AlertCircle className="h-6 w-6 text-occupied" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-vacant" />
                  )}
                  <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                    <div className={`text-xs font-medium ${
                      prediction.occupancy === 1 ? 'text-occupied' : 'text-vacant'
                    }`}>
                      Predicted Occupancy
                    </div>
                    <div className={`text-lg font-bold ${
                      prediction.occupancy === 1 ? 'text-occupied' : 'text-vacant'
                    }`}>
                      {prediction.occupancy === 1 ? 'Occupied' : 'Vacant'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-info-light p-3 rounded-lg border border-info">
                <div className="flex items-center gap-2">
                  <Activity className="h-6 w-6 text-info" />
                  <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                    <div className="text-xs text-info font-medium">Confidence</div>
                    <div className="text-lg font-bold text-info">
                      {(prediction.probability * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="mt-1 w-full bg-info-light rounded-full h-1.5">
                  <div 
                    className="bg-info h-1.5 rounded-full"
                    style={{ width: `${prediction.probability * 100}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Activity className="h-6 w-6 text-gray-400" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-gray-500 font-medium">No Prediction Available</div>
                  <div className="text-sm text-gray-400">Select data to see ML prediction</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Data Display */}
      {currentData && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">Current Sensor Data</h3>
            </div>
            <div className="text-xs text-secondary">
              {new Date(currentData.date).toLocaleString()}
            </div>
          </div>

          {/* Sensor Data Grid */}
          <div className="grid grid-cols-1 gap-2 mb-3">
          <div className={`p-3 rounded-lg border-2 ${
                currentData.Occupancy === 1 
                  ? 'bg-occupied-light border-occupied' 
                  : 'bg-vacant-light border-vacant'
              }`}>
              <div className="flex items-center gap-2">
                {currentData.Occupancy === 1 ? (
                  <AlertCircle className="h-6 w-6 text-occupied" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-vacant" />
                )}
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className={`text-xs font-medium ${
                    currentData.Occupancy === 1 ? 'text-occupied' : 'text-vacant'
                  }`}>
                    Actual Occupancy
                  </div>
                  <div className={`text-lg font-bold ${
                    currentData.Occupancy === 1 ? 'text-occupied' : 'text-vacant'
                  }`}>
                    {currentData.Occupancy === 1 ? 'Occupied' : 'Vacant'}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-temperature-light p-3 rounded-lg border border-temperature">
              <div className="flex items-center gap-2">
                <Thermometer className="h-6 w-6 text-temperature" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-temperature font-medium">Temperature</div>
                  <div className="text-lg font-bold text-temperature">{currentData.Temperature.toFixed(1)}°C</div>
                </div>
              </div>
            </div>

            <div className="bg-humidity-light p-3 rounded-lg border border-humidity">
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-humidity" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-humidity font-medium">Humidity</div>
                  <div className="text-lg font-bold text-humidity">{currentData.Humidity.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <div className="bg-light-light p-3 rounded-lg border border-light">
              <div className="flex items-center gap-2">
                <Sun className="h-6 w-6 text-light" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-light font-medium">Light</div>
                  <div className="text-lg font-bold text-light">{currentData.Light.toFixed(0)} lux</div>
                </div>
              </div>
            </div>

            <div className="bg-co2-light p-3 rounded-lg border border-co2">
              <div className="flex items-center gap-2">
                <Wind className="h-6 w-6 text-co2" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-co2 font-medium">CO2</div>
                  <div className="text-lg font-bold text-co2">{currentData.CO2.toFixed(0)} ppm</div>
                </div>
              </div>
            </div>

            <div className="bg-info-light p-3 rounded-lg border border-info">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-info" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-info font-medium">Humidity Ratio</div>
                  <div className="text-lg font-bold text-info">{currentData.HumidityRatio.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

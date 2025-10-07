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
import { useState, useEffect } from 'react';

interface SensorMetricsProps {
  currentData: SensorDataPoint | null;
}

interface PredictionResult {
  features: {
    timestamp: string;
    Temperature: number;
    Humidity: number;
    Light: number;
    CO2: number;
    HumidityRatio: number;
  };
  prob: number;
  occupancy: number;
  actual_occupancy?: number;
  is_anomaly: boolean;
  timestamp: string;
  status: string;
  model_version?: string;
  metadata?: any;
}

export default function SensorMetrics({ currentData }: SensorMetricsProps) {
  const [predictionResult, setPredictionResult] = useState<PredictionResult | null>(null);

  // Listen for prediction results from WebSocket
  useEffect(() => {
    const handlePredictionResult = (event: CustomEvent<PredictionResult>) => {
      setPredictionResult(event.detail);
    };

    window.addEventListener('predictionResult', handlePredictionResult as EventListener);
    
    return () => {
      window.removeEventListener('predictionResult', handlePredictionResult as EventListener);
    };
  }, []);

  // Use prediction result data if available, otherwise fall back to currentData
  const displayData = predictionResult?.features ? {
    ...currentData,
    Temperature: predictionResult.features.Temperature,
    Humidity: predictionResult.features.Humidity,
    Light: predictionResult.features.Light,
    CO2: predictionResult.features.CO2,
    HumidityRatio: predictionResult.features.HumidityRatio,
    Occupancy: predictionResult.actual_occupancy !== undefined ? predictionResult.actual_occupancy : predictionResult.occupancy, // Use actual occupancy if available, otherwise predicted
    date: predictionResult.features.timestamp || currentData?.date
  } : currentData;

  return (
    <div className="space-y-4">
      {/* Prediction Display */}
      <div className="card-elevated p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-5 w-5 text-info" />
          <h3 className="text-lg font-semibold">ML Prediction</h3>
          {predictionResult?.is_anomaly && (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              <AlertCircle className="h-3 w-3" />
              Anomaly Detected
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-3">
          {predictionResult ? (
            <>
              {/* Predicted Occupancy */}
              <div className={`p-3 rounded-lg border-2 ${
                  predictionResult.occupancy === 1 
                    ? 'bg-occupied-light border-occupied' 
                    : 'bg-vacant-light border-vacant'
                }`}>
                <div className="flex items-center gap-2">
                  {predictionResult.occupancy === 1 ? (
                    <AlertCircle className="h-6 w-6 text-occupied" />
                  ) : (
                    <CheckCircle className="h-6 w-6 text-vacant" />
                  )}
                  <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                    <div className={`text-xs font-medium ${
                      predictionResult.occupancy === 1 ? 'text-occupied' : 'text-vacant'
                    }`}>
                      Predicted Occupancy
                    </div>
                    <div className={`text-lg font-bold ${
                      predictionResult.occupancy === 1 ? 'text-occupied' : 'text-vacant'
                    }`}>
                      {predictionResult.occupancy === 1 ? 'Occupied' : 'Vacant'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actual Occupancy (if available) */}
              {predictionResult?.actual_occupancy !== undefined && (
                <div className={`p-3 rounded-lg border-2 ${
                    predictionResult.actual_occupancy === 1 
                      ? 'bg-blue-100 border-blue-500' 
                      : 'bg-gray-100 border-gray-500'
                  }`}>
                  <div className="flex items-center gap-2">
                    {predictionResult.actual_occupancy === 1 ? (
                      <AlertCircle className="h-6 w-6 text-blue-600" />
                    ) : (
                      <CheckCircle className="h-6 w-6 text-gray-600" />
                    )}
                    <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                      <div className={`text-xs font-medium ${
                        predictionResult.actual_occupancy === 1 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        Actual Occupancy
                      </div>
                      <div className={`text-lg font-bold ${
                        predictionResult.actual_occupancy === 1 ? 'text-blue-600' : 'text-gray-600'
                      }`}>
                        {predictionResult.actual_occupancy === 1 ? 'Occupied' : 'Vacant'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-info-light p-3 rounded-lg border border-info">
                <div className="flex items-center gap-2">
                  <Activity className="h-6 w-6 text-info" />
                  <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                    <div className="text-xs text-info font-medium">Probability</div>
                    <div className="text-lg font-bold text-info">
                      {(predictionResult.prob * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
                <div className="mt-1 w-full bg-info-light rounded-full h-1.5">
                  <div 
                    className="bg-info h-1.5 rounded-full"
                    style={{ width: `${predictionResult.prob * 100}%` }}
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
                  <div className="text-sm text-gray-400">Playback to see ML prediction</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Data Display */}
      {displayData && (
        <div className="card-elevated p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              <h3 className="text-lg font-semibold">
                {predictionResult?.features ? 'Processed Sensor Data' : 'Current Sensor Data'}
              </h3>
            </div>
            <div className="text-xs text-secondary">
              {displayData.date ? new Date(displayData.date).toLocaleString() : 'No timestamp'}
            </div>
          </div>

          {/* Sensor Data Grid */}
          <div className="grid grid-cols-1 gap-2 mb-3">
            <div className="bg-temperature-light p-3 rounded-lg border border-temperature">
              <div className="flex items-center gap-2">
                <Thermometer className="h-6 w-6 text-temperature" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-temperature font-medium">Temperature</div>
                  <div className="text-lg font-bold text-temperature">{displayData.Temperature.toFixed(1)}°C</div>
                </div>
              </div>
            </div>

            <div className="bg-humidity-light p-3 rounded-lg border border-humidity">
              <div className="flex items-center gap-2">
                <Droplets className="h-6 w-6 text-humidity" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-humidity font-medium">Humidity</div>
                  <div className="text-lg font-bold text-humidity">{displayData.Humidity.toFixed(1)}%</div>
                </div>
              </div>
            </div>

            <div className="bg-light-light p-3 rounded-lg border border-light">
              <div className="flex items-center gap-2">
                <Sun className="h-6 w-6 text-light" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-light font-medium">Light</div>
                  <div className="text-lg font-bold text-light">{displayData.Light.toFixed(0)} lux</div>
                </div>
              </div>
            </div>

            <div className="bg-co2-light p-3 rounded-lg border border-co2">
              <div className="flex items-center gap-2">
                <Wind className="h-6 w-6 text-co2" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-co2 font-medium">CO2</div>
                  <div className="text-lg font-bold text-co2">{displayData.CO2.toFixed(0)} ppm</div>
                </div>
              </div>
            </div>

            <div className="bg-info-light p-3 rounded-lg border border-info">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-info" />
                <div className="flex-1 min-h-[40px] flex flex-col justify-center">
                  <div className="text-xs text-info font-medium">Humidity Ratio</div>
                  <div className="text-lg font-bold text-info">{displayData.HumidityRatio.toFixed(4)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

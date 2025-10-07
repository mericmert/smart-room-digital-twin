'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  FileText, 
  Clock, 
  Thermometer, 
  Droplets, 
  Sun, 
  Wind, 
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { SensorDataPoint } from '@/utils/dataParser';
import { useDataFiles, useDataAtTime, useAllDataForFile, usePrediction } from '@/hooks/useApi';

interface TimeScrubberProps {
  onDataSelect?: (data: SensorDataPoint) => void;
  onPrediction?: (prediction: { 
    occupancy: number; 
    probability: number; 
    is_anomaly?: boolean;
    features?: any;
    status?: string;
    model_version?: string;
  }) => void;
}

export default function TimeScrubber({ onDataSelect, onPrediction }: TimeScrubberProps) {
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [prediction, setPrediction] = useState<{ 
    occupancy: number; 
    probability: number; 
    is_anomaly?: boolean;
    features?: any;
    status?: string;
    model_version?: string;
  } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef<number>(0);

  const { data: dataFiles = [], isLoading: isLoadingFiles, error: filesError } = useDataFiles();
  
  const effectiveSelectedFile = selectedFile || (dataFiles.length > 0 ? dataFiles[0].filename : '');
  
  const { data: dataAtTime, isLoading: isLoadingDataAtTime, error: dataAtTimeError } = useDataAtTime(
    effectiveSelectedFile, 
    currentTime, 
    !!effectiveSelectedFile && !!currentTime && !isPlaying
  );
  const { data: allDataForFile = [], isLoading: isLoadingAllData } = useAllDataForFile(
    effectiveSelectedFile, 
    !!effectiveSelectedFile && isPlaying
  );
  const predictionMutation = usePrediction();

  // Derive currentData from dataAtTime instead of storing in state
  const currentData = dataAtTime && dataAtTime.length > 0 ? dataAtTime[0] : null;

  // Compute message during render instead of using useEffect
  const message = (() => {
    if (isLoadingFiles) return 'Loading data files...';
    if (filesError) return `Error loading data files: ${filesError.message}`;
    if (isLoadingDataAtTime) return 'Loading data at selected time...';
    if (dataAtTimeError) return `Error loading data: ${dataAtTimeError.message}`;
    if (dataAtTime && dataAtTime.length > 0) {
      return `Loaded synchronized data from ${effectiveSelectedFile} at ${new Date(currentTime).toLocaleString()}`;
    }
    if (dataFiles.length > 0) return `Loaded ${dataFiles.length} data files`;
    return '';
  })();

  // Trigger prediction function - called by user actions
  const triggerPrediction = useCallback((sensorData: SensorDataPoint) => {
    predictionMutation.mutate(sensorData, {
      onSuccess: (predictionResult) => {
        setPrediction(predictionResult);
        onPrediction?.(predictionResult);
      },
      onError: (error) => {
        console.error('Prediction error:', error);
      }
    });
  }, [predictionMutation, onPrediction]);

  // Handle data at time changes - notify parent and trigger prediction for manual selection
  useEffect(() => {
    if (currentData) {
      onDataSelect?.(currentData);
      
      // Trigger prediction for manual time selection (not during playback)
      if (!isPlaying) {
        triggerPrediction(currentData);
      }
    }
  }, [currentData, isPlaying, onDataSelect, triggerPrediction]);

  const startPlayback = async () => {
    if (!effectiveSelectedFile || allDataForFile.length === 0) {
      return;
    }

    setIsPlaying(true);

    // Start from current time or beginning
    let startIndex = currentIndexRef.current;
    if (currentTime) {
      const targetTime = new Date(currentTime);
      startIndex = allDataForFile.findIndex(point => 
        new Date(point.date) >= targetTime
      );
      if (startIndex === -1) startIndex = 0;
    }

    currentIndexRef.current = startIndex;

    intervalRef.current = setInterval(async () => {
      if (currentIndexRef.current >= allDataForFile.length) {
        stopPlayback();
        return;
      }

      const dataPoint = allDataForFile[currentIndexRef.current];
      
      try {
        // Update time for UI
        setCurrentTime(dataPoint.date);
        
        // Load ML prediction during playback (user action)
        triggerPrediction(dataPoint);
      } catch (error) {
        console.error('Error during playback:', error);
        // Still update time even if prediction fails
        setCurrentTime(dataPoint.date);
      }

      currentIndexRef.current++;
    }, 1000 / playbackSpeed); // Update every second
  };

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleTimeChange = (time: string) => {
    // Validate time is within the selected file's time range
    if (time && timeRange) {
      const selectedTime = new Date(time);
      const startTime = new Date(timeRange.start);
      const endTime = new Date(timeRange.end);
      
      if (selectedTime < startTime || selectedTime > endTime) {
        // Don't update the time if it's outside the range
        console.warn('Selected time is outside the file time range');
        return;
      }
    }
    
    setCurrentTime(time);
    // React Query will automatically fetch data when currentTime changes
    // Prediction will be triggered when dataAtTime updates (if not playing)
  };

  const handleFileChange = async (filename: string) => {
    setSelectedFile(filename);
    setCurrentTime('');
    setPrediction(null);
    stopPlayback();
    currentIndexRef.current = 0;
  };


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const selectedFileData = dataFiles.find(f => f.filename === effectiveSelectedFile);
  const timeRange = selectedFileData?.timeRange;

  return (
    <div className="bg-gray-50 min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* File Selection Card */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Data Source</h3>
              </div>
              
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Data File
                </label>
                <select
                  value={effectiveSelectedFile}
                  onChange={(e) => handleFileChange(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                  disabled={isLoadingFiles}
                >
                  <option value="">
                    {isLoadingFiles ? 'Loading files...' : 'Choose a file...'}
                  </option>
                  {dataFiles.map((file) => (
                    <option key={file.filename} value={file.filename}>
                      {file.filename} ({file.totalRecords} records)
                    </option>
                  ))}
                </select>
                
                {selectedFileData && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-blue-800">
                      <div className="font-medium">Time Range:</div>
                      <div className="text-xs mt-1">
                        {new Date(timeRange?.start || '').toLocaleString()} - {new Date(timeRange?.end || '').toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Time Controls Card */}
            {effectiveSelectedFile && timeRange && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Time Navigation</h3>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Time
                    </label>
                    <input
                      type="datetime-local"
                      value={currentTime ? new Date(currentTime).toISOString().slice(0, 16) : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          // Convert datetime-local format (YYYY-MM-DDTHH:MM) to ISO string
                          const localDateTime = new Date(e.target.value);
                          handleTimeChange(localDateTime.toISOString());
                        } else {
                          handleTimeChange('');
                        }
                      }}
                      min={timeRange.start ? new Date(timeRange.start).toISOString().slice(0, 16) : ''}
                      max={timeRange.end ? new Date(timeRange.end).toISOString().slice(0, 16) : ''}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                      disabled={isLoadingDataAtTime}
                      title={`Select a time between ${timeRange.start ? new Date(timeRange.start).toLocaleString() : 'start'} and ${timeRange.end ? new Date(timeRange.end).toLocaleString() : 'end'}`}
                    />
                    {isLoadingDataAtTime && (
                      <div className="flex items-center gap-2 text-sm text-blue-600 mt-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading data...
                      </div>
                    )}
                    
                    {/* Time Range Info */}
                    <div className="text-xs text-gray-500 mt-1">
                      Valid range: {timeRange.start ? new Date(timeRange.start).toLocaleString() : 'N/A'} - {timeRange.end ? new Date(timeRange.end).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const startTime = new Date(timeRange.start);
                        setCurrentTime(startTime.toISOString());
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <SkipBack className="h-4 w-4" />
                      Start
                    </button>
                    <button
                      onClick={() => {
                        const endTime = new Date(timeRange.end);
                        setCurrentTime(endTime.toISOString());
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <SkipForward className="h-4 w-4" />
                      End
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Playback Controls Card */}
            {effectiveSelectedFile && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex items-center gap-2 mb-4">
                  <Play className="h-5 w-5 text-purple-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Playback Controls</h3>
                </div>
                
                <div className="space-y-4">
                  {/* Main Play/Pause Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={isPlaying ? stopPlayback : startPlayback}
                      disabled={isLoadingAllData}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-colors ${
                        isPlaying 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : isLoadingAllData
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {isLoadingAllData ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading Data...
                        </>
                      ) : isPlaying ? (
                        <>
                          <Pause className="h-5 w-5" />
                          Stop Playback
                        </>
                      ) : (
                        <>
                          <Play className="h-5 w-5" />
                          Start Playback
                        </>
                      )}
                    </button>
                  </div>

                  {/* Speed Controls */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Playback Speed
                    </label>
                    <select
                      value={playbackSpeed}
                      onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isPlaying}
                    >
                      <option value={0.5}>0.5x</option>
                      <option value={1}>1x</option>
                      <option value={2}>2x</option>
                      <option value={5}>5x</option>
                      <option value={10}>10x</option>
                    </select>
                  </div>

                  {/* Progress Indicator */}
                  {isPlaying && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{currentIndexRef.current + 1} / {allDataForFile.length}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${((currentIndexRef.current + 1) / allDataForFile.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Right Panel - Data Display */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Data Display */}
            {currentData && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      <Activity className="h-6 w-6 text-blue-600" />
                      <h3 className="text-xl font-semibold text-gray-900">Current Sensor Data</h3>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(currentData.date).toLocaleString()}
                    </div>
                  </div>

                  {/* Sensor Data Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <div className="flex items-center gap-3">
                        <Thermometer className="h-8 w-8 text-orange-600" />
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className="text-sm text-orange-700 font-medium">Temperature</div>
                          <div className="text-2xl font-bold text-orange-900">{currentData.Temperature.toFixed(3)}°C</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="flex items-center gap-3">
                        <Droplets className="h-8 w-8 text-blue-600" />
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className="text-sm text-blue-700 font-medium">Humidity</div>
                          <div className="text-2xl font-bold text-blue-900">{currentData.Humidity.toFixed(3)}%</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                      <div className="flex items-center gap-3">
                        <Sun className="h-8 w-8 text-yellow-600" />
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className="text-sm text-yellow-700 font-medium">Light</div>
                          <div className="text-2xl font-bold text-yellow-900">{currentData.Light.toFixed(3)} lux</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="flex items-center gap-3">
                        <Wind className="h-8 w-8 text-green-600" />
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className="text-sm text-green-700 font-medium">CO2</div>
                          <div className="text-2xl font-bold text-green-900">{currentData.CO2.toFixed(3)} ppm</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-8 w-8 text-purple-600" />
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className="text-sm text-purple-700 font-medium">Humidity Ratio</div>
                          <div className="text-2xl font-bold text-purple-900">{currentData.HumidityRatio.toFixed(3)}</div>
                        </div>
                      </div>
                    </div>

                    <div className={`p-4 rounded-lg border-2 ${
                        currentData.Occupancy === 1 
                          ? 'bg-red-50 border-red-300' 
                          : 'bg-emerald-50 border-emerald-300'
                      }`}>
                      <div className="flex items-center gap-3">
                        {currentData.Occupancy === 1 ? (
                          <AlertCircle className="h-8 w-8 text-red-600" />
                        ) : (
                          <CheckCircle className="h-8 w-8 text-emerald-600" />
                        )}
                        <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                          <div className={`text-sm font-medium ${
                            currentData.Occupancy === 1 ? 'text-red-700' : 'text-emerald-700'
                          }`}>
                            Actual Occupancy
                          </div>
                          <div className={`text-2xl font-bold ${
                            currentData.Occupancy === 1 ? 'text-red-900' : 'text-emerald-900'
                          }`}>
                            {currentData.Occupancy === 1 ? 'Occupied' : 'Vacant'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            {/* Prediction Display */}
            {(prediction || predictionMutation.isPending) && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                    <h3 className="text-xl font-semibold text-gray-900">ML Prediction</h3>
                    {predictionMutation.isPending && (
                      <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                    )}
                  </div>
                  
                  {predictionMutation.isPending ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-3 text-purple-600">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="text-lg font-medium">Generating prediction...</span>
                      </div>
                    </div>
                  ) : prediction ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className={`p-4 rounded-lg border-2 ${
                          prediction.occupancy === 1 
                            ? 'bg-red-50 border-red-300' 
                            : 'bg-emerald-50 border-emerald-300'
                        }`}>
                        <div className="flex items-center gap-3">
                          {prediction.occupancy === 1 ? (
                            <AlertCircle className="h-8 w-8 text-red-600" />
                          ) : (
                            <CheckCircle className="h-8 w-8 text-emerald-600" />
                          )}
                          <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                            <div className={`text-sm font-medium ${
                              prediction.occupancy === 1 ? 'text-red-700' : 'text-emerald-700'
                            }`}>
                              Predicted Occupancy
                              {prediction.is_anomaly && (
                                <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full">
                                  Anomaly
                                </span>
                              )}
                            </div>
                            <div className={`text-2xl font-bold ${
                              prediction.occupancy === 1 ? 'text-red-900' : 'text-emerald-900'
                            }`}>
                              {prediction.occupancy === 1 ? 'Occupied' : 'Vacant'}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <Activity className="h-8 w-8 text-purple-600" />
                          <div className="flex-1 min-h-[60px] flex flex-col justify-center">
                            <div className="text-sm text-purple-700 font-medium">Confidence</div>
                            <div className="text-2xl font-bold text-purple-900">
                              {(prediction.probability * 100).toFixed(3)}%
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 w-full bg-purple-200 rounded-full h-2">
                          <div 
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${prediction.probability * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

            {/* Status Message */}
            {message && (
              <div className={`p-4 rounded-lg border-2 bg-green-50 text-green-700 border-green-200`}>
                  <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium">
                        {message}
                    </span>
                  </div>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
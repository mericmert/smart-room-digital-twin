'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw, 
  FileText, 
  Clock, 
  Thermometer, 
  Droplets, 
  Sun, 
  Wind, 
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { DataParser, SensorDataPoint, ParsedDataFile } from '@/utils/dataParser';

interface TimeScrubberProps {
  onDataSelect?: (data: SensorDataPoint) => void;
  onPrediction?: (prediction: { occupancy: number; probability: number }) => void;
}

interface DataFile {
  filename: string;
  totalRecords: number;
  timeRange: {
    start: string;
    end: string;
  };
}

export default function TimeScrubber({ onDataSelect, onPrediction }: TimeScrubberProps) {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentData, setCurrentData] = useState<SensorDataPoint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [windowMinutes, setWindowMinutes] = useState(5);
  const [message, setMessage] = useState('');
  const [prediction, setPrediction] = useState<{ occupancy: number; probability: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const allDataRef = useRef<SensorDataPoint[]>([]);
  const currentIndexRef = useRef<number>(0);

  // Load available data files
  useEffect(() => {
    loadDataFiles();
  }, []);

  // Retry loading data files if none are loaded
  useEffect(() => {
    if (dataFiles.length === 0) {
      const timer = setTimeout(() => {
        console.log('Retrying to load data files...');
        loadDataFiles();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [dataFiles.length]);



  const loadDataFiles = async () => {
    try {
      console.log('Loading data files...');
      const response = await fetch('/api/replay?action=list-files');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Data files response:', data);
      
      if (data.success) {
        setDataFiles(data.files);
        if (data.files.length > 0) {
          setSelectedFile(data.files[0].filename);
        }
        setMessage(`Loaded ${data.files.length} data files`);
      } else {
        setMessage(`Error: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error loading data files:', error);
      setMessage(`Error loading data files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const loadAllDataForFile = async (filename: string) => {
    try {
      console.log(`Loading all data for ${filename}...`);
      const response = await fetch(`/api/replay?action=get-data&filename=${filename}`);
      const data = await response.json();
      
      if (data.success && data.data.data) {
        allDataRef.current = data.data.data;
        currentIndexRef.current = 0;
        console.log(`Loaded ${allDataRef.current.length} data points for playback`);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading all data:', error);
      return false;
    }
  };

  const loadDataAtTime = async (time: string) => {
    if (!selectedFile || !time) return;

    
    try {
      // Load sensor data
      const response = await fetch(
        `/api/replay?action=get-data&filename=${selectedFile}&time=${time}&windowMinutes=${windowMinutes}`
      );
      const data = await response.json();
      
      if (data.success && data.data.data.length > 0) {
        const sensorData = data.data.data[0]; // Get the closest data point
        
        // Load ML prediction in parallel
        const predictionPromise = predictOccupancy(sensorData);
        
        // Wait for both to complete
        await Promise.all([Promise.resolve(), predictionPromise]);
        
        // Update UI with both sensor data and prediction simultaneously
        setCurrentData(sensorData);
        onDataSelect?.(sensorData);
        setMessage(`Loaded synchronized data from ${selectedFile} at ${new Date(time).toLocaleString()}`);
      } else {
        setMessage('No data found at selected time');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage('Error loading data');
    }
  };


  const predictOccupancy = async (dataPoint: SensorDataPoint) => {
    if (!dataPoint) return;

    try {
      // Prepare the request data for ML API (excluding the actual occupancy value)
      const requestData = {
        date: dataPoint.date,
        Temperature: dataPoint.Temperature,
        Humidity: dataPoint.Humidity,
        Light: dataPoint.Light,
        CO2: dataPoint.CO2,
        HumidityRatio: dataPoint.HumidityRatio
      };

      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const predictionResult = await response.json();
      
      if (predictionResult.occupancy !== undefined && predictionResult.probability !== undefined) {
        const prediction = {
          occupancy: predictionResult.occupancy,
          probability: predictionResult.probability
        };
        setPrediction(prediction);
        onPrediction?.(prediction);
        return prediction; // Return prediction for synchronization
      } else {
        throw new Error('Invalid prediction response from ML API');
      }
    } catch (error) {
      console.error('Error predicting occupancy:', error);
      throw error; // Re-throw for proper error handling in calling function
    }
  };

  const startPlayback = async () => {
    if (!selectedFile) return;

    // Load all data for the selected file if not already loaded
    if (allDataRef.current.length === 0) {
      const loaded = await loadAllDataForFile(selectedFile);
      if (!loaded) {
        setMessage('Failed to load data for playback');
        return;
      }
    }

    if (allDataRef.current.length === 0) {
      setMessage('No data available for playback');
      return;
    }

    setIsPlaying(true);
    setMessage(`Starting playback at ${playbackSpeed}x speed`);

    // Start from current time or beginning
    let startIndex = currentIndexRef.current;
    if (currentTime) {
      const targetTime = new Date(currentTime);
      startIndex = allDataRef.current.findIndex(point => 
        new Date(point.date) >= targetTime
      );
      if (startIndex === -1) startIndex = 0;
    }

    currentIndexRef.current = startIndex;

    intervalRef.current = setInterval(async () => {
      if (currentIndexRef.current >= allDataRef.current.length) {
        stopPlayback();
        setMessage('Playback completed');
        return;
      }

      const dataPoint = allDataRef.current[currentIndexRef.current];
      
      
      try {
        // Load ML prediction
        await predictOccupancy(dataPoint);
        
        // Update UI with both sensor data and prediction simultaneously
        setCurrentData(dataPoint);
        setCurrentTime(dataPoint.date);
        onDataSelect?.(dataPoint);
      } catch (error) {
        console.error('Error during playback:', error);
        // Still show sensor data even if prediction fails
        setCurrentData(dataPoint);
        setCurrentTime(dataPoint.date);
        onDataSelect?.(dataPoint);
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
    setMessage('Playback stopped');
  };

  const handleTimeChange = (time: string) => {
    setCurrentTime(time);
    loadDataAtTime(time);
  };

  const handleFileChange = async (filename: string) => {
    setSelectedFile(filename);
    setCurrentTime('');
    setCurrentData(null);
    stopPlayback();
    
    // Clear cached data when switching files
    allDataRef.current = [];
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

  const selectedFileData = dataFiles.find(f => f.filename === selectedFile);
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
                  value={selectedFile}
                  onChange={(e) => handleFileChange(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                >
                  <option value="">Choose a file...</option>
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
            {selectedFile && timeRange && (
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
                      onChange={(e) => handleTimeChange(e.target.value ? new Date(e.target.value).toISOString() : '')}
                      min={timeRange.start ? new Date(timeRange.start).toISOString().slice(0, 16) : ''}
                      max={timeRange.end ? new Date(timeRange.end).toISOString().slice(0, 16) : ''}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const startTime = new Date(timeRange.start);
                        setCurrentTime(startTime.toISOString());
                        loadDataAtTime(startTime.toISOString());
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
                        loadDataAtTime(endTime.toISOString());
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
            {selectedFile && (
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
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white transition-colors ${
                        isPlaying 
                          ? 'bg-red-500 hover:bg-red-600' 
                          : 'bg-green-500 hover:bg-green-600'
                      }`}
                    >
                      {isPlaying ? (
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

                  {/* Speed and Window Controls */}
                  <div className="grid grid-cols-2 gap-4">
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

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time Window
                      </label>
                      <select
                        value={windowMinutes}
                        onChange={(e) => setWindowMinutes(Number(e.target.value))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isPlaying}
                      >
                        <option value={1}>1 min</option>
                        <option value={5}>5 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>1 hour</option>
                      </select>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  {isPlaying && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Progress</span>
                        <span>{currentIndexRef.current + 1} / {allDataRef.current.length}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${((currentIndexRef.current + 1) / allDataRef.current.length) * 100}%` }}
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
            {prediction && (
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-6 w-6 text-purple-600" />
                    <h3 className="text-xl font-semibold text-gray-900">ML Prediction</h3>
                  </div>
                  
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
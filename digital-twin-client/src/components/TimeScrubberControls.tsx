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
  CheckCircle
} from 'lucide-react';
import { DataParser, SensorDataPoint, ParsedDataFile } from '@/utils/dataParser';

interface TimeScrubberControlsProps {
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

export default function TimeScrubberControls({ onDataSelect, onPrediction }: TimeScrubberControlsProps) {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentData, setCurrentData] = useState<SensorDataPoint | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info' | 'stopped'>('info');
  const [prediction, setPrediction] = useState<{ occupancy: number; probability: number } | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const allDataRef = useRef<SensorDataPoint[]>([]);
  const currentIndexRef = useRef<number>(0);

  // Helper function to convert time to datetime-local format
  const toDateTimeLocal = (timeString: string): string => {
    if (!timeString) return '';
    try {
      const date = new Date(timeString);
      // Get the local timezone offset and adjust
      const offset = date.getTimezoneOffset() * 60000;
      const localDate = new Date(date.getTime() - offset);
      return localDate.toISOString().slice(0, 16);
    } catch (error) {
      console.error('Error converting time to datetime-local:', error);
      return '';
    }
  };

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
        setMessageType('success');
      } else {
        setMessage(`Error: ${data.error || 'Unknown error'}`);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error loading data files:', error);
      setMessage(`Error loading data files: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    }
  };

  const loadAllDataForFile = async (filename: string) => {
    try {
      console.log(`Loading all data for ${filename}...`);
      const response = await fetch(`/api/replay?action=get-data&filename=${filename}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Data response:', data);
      
      if (data.success && data.data.data) {
        allDataRef.current = data.data.data;
        currentIndexRef.current = 0;
        
        if (allDataRef.current.length > 0) {
          const firstData = allDataRef.current[0];
          setCurrentData(firstData);
          setCurrentTime(firstData.date);
          onDataSelect?.(firstData);
        }
        
        setMessage(`Loaded ${allDataRef.current.length} data points from ${filename}`);
        setMessageType('success');
      } else {
        setMessage(`Error: ${data.error || 'Failed to load data'}`);
        setMessageType('error');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setMessageType('error');
    }
  };

  const startPlayback = () => {
    if (allDataRef.current.length === 0) {
      setMessage('No data loaded. Please select a file first.');
      return;
    }

    // If there's a current time selected, find the closest data point to start from
    if (currentTime) {
      try {
        const targetTime = new Date(currentTime);
        const data = DataParser.getDataAtTime(allDataRef.current, targetTime);
        if (data) {
          const index = allDataRef.current.findIndex(d => d.date === data.date);
          if (index !== -1) {
            currentIndexRef.current = index;
          }
        }
      } catch (error) {
        console.error('Error finding start time for playback:', error);
        // If there's an error, start from current index
      }
    }

    // Immediately show the data for the start time
    const startData = allDataRef.current[currentIndexRef.current];
    setCurrentData(startData);
    setCurrentTime(startData.date);
    onDataSelect?.(startData);
    getPrediction(startData);

    setIsPlaying(true);
    setMessage(`Playback started from ${new Date(allDataRef.current[currentIndexRef.current].date).toLocaleString()}`);
    setMessageType('info');

    const interval = setInterval(() => {
      if (currentIndexRef.current < allDataRef.current.length - 1) {
        currentIndexRef.current += 1;
        const data = allDataRef.current[currentIndexRef.current];
        setCurrentData(data);
        setCurrentTime(data.date);
        onDataSelect?.(data);
        
        // Get prediction for current data
        getPrediction(data);
      } else {
        stopPlayback();
      }
    }, 1000 / playbackSpeed);

    intervalRef.current = interval;
  };

  const stopPlayback = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
    setMessage('Playback stopped');
    setMessageType('stopped');
  };

  const stopPlaybackSilently = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const getPrediction = async (data: SensorDataPoint) => {
    try {
      const response = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: data.date,
          Temperature: data.Temperature,
          Humidity: data.Humidity,
          Light: data.Light,
          CO2: data.CO2,
          HumidityRatio: data.HumidityRatio
        }),
      });

      if (response.ok) {
        const result = await response.json();
        // The ML API returns the prediction directly with occupancy and probability fields
        if (result.occupancy !== undefined && result.probability !== undefined) {
          const prediction = {
            occupancy: result.occupancy,
            probability: result.probability
          };
          setPrediction(prediction);
          onPrediction?.(prediction);
        } else {
          console.error('Invalid prediction response:', result);
        }
      } else {
        console.error('Prediction API error:', response.status, await response.text());
      }
    } catch (error) {
      console.error('Error getting prediction:', error);
    }
  };

  const handleFileChange = (filename: string) => {
    setSelectedFile(filename);
    loadAllDataForFile(filename);
    stopPlaybackSilently();
  };

  const handleTimeChange = (time: string) => {
    setCurrentTime(time);
    if (time && allDataRef.current.length > 0) {
      try {
        // Convert the datetime-local input to a proper Date object
        const targetTime = new Date(time);
        
        // Validate the date
        if (isNaN(targetTime.getTime())) {
          setMessage('Invalid time format. Please select a valid date and time.');
          setMessageType('error');
          return;
        }
        
        // Use the DataParser method to find the closest data point
        const data = DataParser.getDataAtTime(allDataRef.current, targetTime);
        if (data) {
          setCurrentData(data);
          onDataSelect?.(data);
          getPrediction(data);
          // Update the current index to match the found data
          const index = allDataRef.current.findIndex(d => d.date === data.date);
          if (index !== -1) {
            currentIndexRef.current = index;
          }
          setMessage(`Time updated to ${new Date(data.date).toLocaleString()}`);
          setMessageType('info');
        } else {
          setMessage('No data found for the selected time. Please try a different time.');
          setMessageType('error');
        }
      } catch (error) {
        console.error('Error handling time change:', error);
        setMessage('Error processing time selection. Please try again.');
        setMessageType('error');
      }
    }
  };

  const skipToStart = () => {
    if (allDataRef.current.length > 0) {
      currentIndexRef.current = 0;
      const data = allDataRef.current[0];
      setCurrentData(data);
      setCurrentTime(data.date);
      onDataSelect?.(data);
      getPrediction(data);
    }
  };

  const skipToEnd = () => {
    if (allDataRef.current.length > 0) {
      currentIndexRef.current = allDataRef.current.length - 1;
      const data = allDataRef.current[currentIndexRef.current];
      setCurrentData(data);
      setCurrentTime(data.date);
      onDataSelect?.(data);
      getPrediction(data);
    }
  };

  const stepBackward = () => {
    if (currentIndexRef.current > 0) {
      currentIndexRef.current -= 1;
      const data = allDataRef.current[currentIndexRef.current];
      setCurrentData(data);
      setCurrentTime(data.date);
      onDataSelect?.(data);
      getPrediction(data);
    }
  };

  const stepForward = () => {
    if (currentIndexRef.current < allDataRef.current.length - 1) {
      currentIndexRef.current += 1;
      const data = allDataRef.current[currentIndexRef.current];
      setCurrentData(data);
      setCurrentTime(data.date);
      onDataSelect?.(data);
      getPrediction(data);
    }
  };

  const adjustTime = (milliseconds: number) => {
    if (currentTime && allDataRef.current.length > 0) {
      try {
        const currentDate = new Date(currentTime);
        const newTime = new Date(currentDate.getTime() + milliseconds);
        handleTimeChange(newTime.toISOString());
      } catch (error) {
        console.error('Error adjusting time:', error);
        setMessage('Error adjusting time. Please try again.');
        setMessageType('error');
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-blue-600" />
        <h2 className="heading-3">Timeline</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* File Selection */}
        <div>
          <label className="label block mb-1">
            Data File
          </label>
          <select
            value={selectedFile}
            onChange={(e) => handleFileChange(e.target.value)}
            className="input w-full"
          >
            <option value="">Select file...</option>
            {dataFiles.map((file) => (
              <option key={file.filename} value={file.filename}>
                {file.filename} ({file.totalRecords})
              </option>
            ))}
          </select>
        </div>

        {/* Time Selection */}
        {allDataRef.current.length > 0 && (
          <div>
            <label className="label block mb-1">
              Time Point
            </label>
            <div className="space-y-2">
              <input
                type="datetime-local"
                value={toDateTimeLocal(currentTime)}
                onChange={(e) => {
                  if (e.target.value) {
                    // Convert datetime-local format (YYYY-MM-DDTHH:MM) to ISO string
                    const localDateTime = new Date(e.target.value);
                    handleTimeChange(localDateTime.toISOString());
                  } else {
                    handleTimeChange('');
                  }
                }}
                className="input w-full"
              />
              
              {/* Quick Time Adjustment Buttons */}
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => adjustTime(-60 * 60 * 1000)} // -1 hour
                  className="button button-secondary text-xs py-1"
                  disabled={isPlaying}
                  title="Go back 1 hour"
                >
                  -1h
                </button>
                <button
                  onClick={() => adjustTime(-15 * 60 * 1000)} // -15 minutes
                  className="button button-secondary text-xs py-1"
                  disabled={isPlaying}
                  title="Go back 15 minutes"
                >
                  -15m
                </button>
                <button
                  onClick={() => adjustTime(15 * 60 * 1000)} // +15 minutes
                  className="button button-secondary text-xs py-1"
                  disabled={isPlaying}
                  title="Go forward 15 minutes"
                >
                  +15m
                </button>
                <button
                  onClick={() => adjustTime(60 * 60 * 1000)} // +1 hour
                  className="button button-secondary text-xs py-1"
                  disabled={isPlaying}
                  title="Go forward 1 hour"
                >
                  +1h
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Speed Controls */}
        {allDataRef.current.length > 0 && (
          <div>
            <label className="label block mb-1">
              Speed
            </label>
            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="input w-full"
              disabled={isPlaying}
            >
              <option value={0.5}>0.5x</option>
              <option value={1}>1x</option>
              <option value={2}>2x</option>
              <option value={5}>5x</option>
              <option value={10}>10x</option>
            </select>
          </div>
        )}
      </div>

      {/* Playback Controls */}
      {allDataRef.current.length > 0 && (
        <div className="mt-4 space-y-3">
          {/* Control Buttons */}
          <div className="flex justify-center gap-2">
            <button
              onClick={skipToStart}
              className="button button-secondary p-2"
              disabled={isPlaying}
              title="Skip to start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            
            <button
              onClick={stepBackward}
              className="button button-secondary p-2"
              disabled={isPlaying}
              title="Step backward"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={isPlaying ? stopPlayback : startPlayback}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                isPlaying 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                  <span className="text-sm">Stop</span>
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span className="text-sm">Play</span>
                </>
              )}
            </button>

            <button
              onClick={stepForward}
              className="button button-secondary p-2"
              disabled={isPlaying}
              title="Step forward"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            
            <button
              onClick={skipToEnd}
              className="button button-secondary p-2"
              disabled={isPlaying}
              title="Skip to end"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          {/* Progress Indicator */}
          {isPlaying && (
            <div className="bg-secondary p-2 rounded-md">
              <div className="flex justify-between text-xs text-secondary mb-1">
                <span>Progress</span>
                <span>{currentIndexRef.current + 1} / {allDataRef.current.length}</span>
              </div>
              <div className="w-full bg-tertiary rounded-full h-1.5">
                <div 
                  className="bg-primary h-1.5 rounded-full"
                  style={{ width: `${((currentIndexRef.current + 1) / allDataRef.current.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`mt-3 p-2 rounded-md border ${
          messageType === 'error' 
            ? 'text-error border-error'
            : messageType === 'stopped'
            ? 'text-warning border-warning'
            : messageType === 'success'
            ? 'text-success border-success'
            : 'text-info border-info'
        }`}>
          <div className="flex items-center gap-1">
            <CheckCircle className={`h-4 w-4 ${
              messageType === 'error' 
                ? 'text-error' 
                : messageType === 'stopped'
                ? 'text-warning'
                : messageType === 'success'
                ? 'text-success'
                : 'text-info'
            }`} />
            <span className="text-sm font-medium">{message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  RotateCcw, 
  RotateCw, 
  Clock, 
  CheckCircle
} from 'lucide-react';
import { DataParser, SensorDataPoint } from '@/utils/dataParser';

interface TimeScrubberControlsProps {
  onDataSelect?: (data: SensorDataPoint) => void;
}

interface DataFile {
  filename: string;
  totalRecords: number;
  timeRange: {
    start: string;
    end: string;
  };
}

interface PlaybackState {
  isPlaying: boolean;
  speed: number;
  currentIndex: number;
  totalRecords: number;
}

interface MessageState {
  text: string;
  type: 'success' | 'error' | 'info' | 'stopped';
}

export default function TimeScrubberControls({ onDataSelect }: TimeScrubberControlsProps) {
  const [dataFiles, setDataFiles] = useState<DataFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<string>('');
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    speed: 1,
    currentIndex: 0,
    totalRecords: 0
  });
  const [message, setMessage] = useState<MessageState>({ text: '', type: 'info' });
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const allDataRef = useRef<SensorDataPoint[]>([]);
  const playbackStateRef = useRef<PlaybackState>(playbackState);

  const toDateTimeLocal = useCallback((timeString: string): string => {
    return DataParser.toDateTimeLocal(timeString);
  }, []);

  const updateMessage = useCallback((text: string, type: MessageState['type'] = 'info') => {
    setMessage({ text, type });
  }, []);

  const updatePlaybackState = useCallback((updates: Partial<PlaybackState>) => {
    setPlaybackState(prev => {
      const newState = { ...prev, ...updates };
      playbackStateRef.current = newState;
      return newState;
    });
  }, []);

  const loadDataFiles = useCallback(async () => {
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
        updateMessage(`Loaded ${data.files.length} data files`, 'success');
      } else {
        updateMessage(`Error: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error loading data files:', error);
      updateMessage(`Error loading data files: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [updateMessage]);

  // Load data files on mount and retry if needed
  useEffect(() => {
    loadDataFiles();
    
    // Set up retry mechanism if no files are loaded
    const retryTimer = setTimeout(() => {
      if (dataFiles.length === 0) {
        console.log('Retrying to load data files...');
        loadDataFiles();
      }
    }, 2000);

    return () => clearTimeout(retryTimer);
  }, [loadDataFiles, dataFiles.length]);


  const loadAllDataForFile = useCallback(async (filename: string) => {
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
        updatePlaybackState({ 
          currentIndex: 0, 
          totalRecords: data.data.data.length 
        });
        
        if (allDataRef.current.length > 0) {
          const firstData = allDataRef.current[0];
          setCurrentTime(firstData.date);
          onDataSelect?.(firstData);
        }
        
        updateMessage(`Loaded ${allDataRef.current.length} data points from ${filename}`, 'success');
      } else {
        updateMessage(`Error: ${data.error || 'Failed to load data'}`, 'error');
      }
    } catch (error) {
      console.error('Error loading data:', error);
      updateMessage(`Error loading data: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }, [updateMessage, updatePlaybackState, onDataSelect]);

  const startPlayback = useCallback(() => {
    if (allDataRef.current.length === 0) {
      updateMessage('No data loaded. Please select a file first.', 'error');
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
            updatePlaybackState({ currentIndex: index });
          }
        }
      } catch (error) {
        console.error('Error finding start time for playback:', error);
        // If there's an error, start from current index
      }
    }

    const startData = allDataRef.current[playbackState.currentIndex];
    const endData = allDataRef.current[allDataRef.current.length - 1];

    try {
      const startMs = new Date(startData.date).getTime();
      const endMs = new Date(endData.date).getTime();
      window.dispatchEvent(
        new CustomEvent('playbackStart', {
          detail: { start: startMs, end: endMs }
        })
      );
    } catch (e) {
      // ignore
    }
    setCurrentTime(startData.date);
    onDataSelect?.(startData);
    sendToKafka(startData);

    updatePlaybackState({ isPlaying: true });
    updateMessage(`Playback started from ${new Date(startData.date).toLocaleString()}`, 'info');

    const interval = setInterval(() => {
      const currentState = playbackStateRef.current;
      if (currentState.currentIndex < allDataRef.current.length - 1) {
        const newIndex = currentState.currentIndex + 1;
        updatePlaybackState({ currentIndex: newIndex });
        const data = allDataRef.current[newIndex];
        setCurrentTime(data.date);
        onDataSelect?.(data);
        
        // Send data to Kafka for processing
        sendToKafka(data);
      } else {
        stopPlayback();
      }
    }, 1000 / playbackStateRef.current.speed);

    intervalRef.current = interval;
  }, [currentTime, playbackState.currentIndex, playbackState.speed, updateMessage, updatePlaybackState, onDataSelect]);

  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    updatePlaybackState({ isPlaying: false });
    updateMessage('Playback stopped', 'stopped');
  }, [updateMessage, updatePlaybackState]);

  const stopPlaybackSilently = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    updatePlaybackState({ isPlaying: false });
  }, [updatePlaybackState]);

  const sendToKafka = useCallback(async (data: SensorDataPoint) => {
    try {
      // Send data to Kafka for processing instead of HTTP prediction
      const response = await fetch('/api/replay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send-kafka-message',
          filename: selectedFile,
          time: data.date
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Data sent to Kafka:', result);
        updateMessage(`Data sent to Kafka for processing`, 'success');
      } else {
        console.error('Failed to send data to Kafka:', response.status);
        updateMessage('Failed to send data to Kafka', 'error');
      }
    } catch (error) {
      console.error('Error sending data to Kafka:', error);
      updateMessage('Error sending data to Kafka', 'error');
    }
  }, [selectedFile, updateMessage]);

  const handleFileChange = useCallback((filename: string) => {
    setSelectedFile(filename);
    loadAllDataForFile(filename);
    stopPlaybackSilently();
  }, [loadAllDataForFile, stopPlaybackSilently]);

  const handleTimeChange = useCallback((time: string) => {
    setCurrentTime(time);
    if (time && allDataRef.current.length > 0) {
      try {
        // Parse the datetime-local input using our robust date parser
        const targetTime = DataParser.parseDate(time);
        
        // Validate the date
        if (!targetTime) {
          updateMessage('Invalid time format. Please select a valid date and time.', 'error');
          return;
        }
        
        // Check if the selected time is within the data range
        const firstData = allDataRef.current[0];
        const lastData = allDataRef.current[allDataRef.current.length - 1];
        const startTime = DataParser.parseDate(firstData.date);
        const endTime = DataParser.parseDate(lastData.date);
        
        if (startTime && endTime && (targetTime < startTime || targetTime > endTime)) {
          updateMessage('Selected time is outside the data range. Please select a time within the file range.', 'error');
          return;
        }
        
        // Use the DataParser method to find the closest data point
        const data = DataParser.getDataAtTime(allDataRef.current, targetTime);
        if (data) {
          onDataSelect?.(data);
          sendToKafka(data);
          // Update the current index to match the found data
          const index = allDataRef.current.findIndex(d => d.date === data.date);
          if (index !== -1) {
            updatePlaybackState({ currentIndex: index });
          }
          updateMessage(`Time updated to ${targetTime.toLocaleString()}`, 'info');
        } else {
          updateMessage('No data found for the selected time. Please try a different time.', 'error');
        }
      } catch (error) {
        console.error('Error handling time change:', error);
        updateMessage('Error processing time selection. Please try again.', 'error');
      }
    }
  }, [updateMessage, updatePlaybackState, onDataSelect, sendToKafka]);

  const skipToStart = useCallback(() => {
    if (allDataRef.current.length > 0) {
      updatePlaybackState({ currentIndex: 0 });
      const data = allDataRef.current[0];
      setCurrentTime(data.date);
      onDataSelect?.(data);
      sendToKafka(data);
    }
  }, [updatePlaybackState, onDataSelect, sendToKafka]);

  const skipToEnd = useCallback(() => {
    if (allDataRef.current.length > 0) {
      const lastIndex = allDataRef.current.length - 1;
      updatePlaybackState({ currentIndex: lastIndex });
      const data = allDataRef.current[lastIndex];
      setCurrentTime(data.date);
      onDataSelect?.(data);
      sendToKafka(data);
    }
  }, [updatePlaybackState, onDataSelect, sendToKafka]);

  const stepBackward = useCallback(() => {
    if (playbackState.currentIndex > 0) {
      const newIndex = playbackState.currentIndex - 1;
      updatePlaybackState({ currentIndex: newIndex });
      const data = allDataRef.current[newIndex];
      setCurrentTime(data.date);
      onDataSelect?.(data);
      sendToKafka(data);
    }
  }, [playbackState.currentIndex, updatePlaybackState, onDataSelect, sendToKafka]);

  const stepForward = useCallback(() => {
    if (playbackState.currentIndex < allDataRef.current.length - 1) {
      const newIndex = playbackState.currentIndex + 1;
      updatePlaybackState({ currentIndex: newIndex });
      const data = allDataRef.current[newIndex];
      setCurrentTime(data.date);
      onDataSelect?.(data);
      sendToKafka(data);
    }
  }, [playbackState.currentIndex, updatePlaybackState, onDataSelect, sendToKafka]);

  const adjustTime = useCallback((milliseconds: number) => {
    if (currentTime && allDataRef.current.length > 0) {
      try {
        const currentDate = new Date(currentTime);
        const newTime = new Date(currentDate.getTime() + milliseconds);
        handleTimeChange(newTime.toISOString());
      } catch (error) {
        console.error('Error adjusting time:', error);
        updateMessage('Error adjusting time. Please try again.', 'error');
      }
    }
  }, [currentTime, handleTimeChange, updateMessage]);

  // Keep ref in sync with state
  useEffect(() => {
    playbackStateRef.current = playbackState;
  }, [playbackState]);

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
        <h2 className="heading-3">Digital Twin - Smart Office Room</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* File Selection */}
        <div>
          <label className="label block mb-1">
            Data File
          </label>
          <select
            value={selectedFile || ''}
            onChange={(e) => handleFileChange(e.target.value)}
            className="input w-full"
            disabled={dataFiles.length === 0}
          >
            {!selectedFile && (
              <option value="" disabled>
                {dataFiles.length === 0 ? 'Loading files...' : 'Select file...'}
              </option>
            )}
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
                    // Convert datetime-local format (YYYY-MM-DDTHH:MM:SS) to ISO string
                    const localDateTime = new Date(e.target.value);
                    handleTimeChange(localDateTime.toISOString());
                  } else {
                    handleTimeChange('');
                  }
                }}
                min={allDataRef.current.length > 0 ? toDateTimeLocal(allDataRef.current[0].date) : ''}
                max={allDataRef.current.length > 0 ? toDateTimeLocal(allDataRef.current[allDataRef.current.length - 1].date) : ''}
                className="input w-full"
                title={allDataRef.current.length > 0 ? `Select a time between ${new Date(allDataRef.current[0].date).toLocaleString()} and ${new Date(allDataRef.current[allDataRef.current.length - 1].date).toLocaleString()}` : 'Select a time'}
              />
              
              {/* Time Range Info */}
              {allDataRef.current.length > 0 && (
                <div className="text-xs text-gray-500">
                  Valid range: {new Date(allDataRef.current[0].date).toLocaleString()} - {new Date(allDataRef.current[allDataRef.current.length - 1].date).toLocaleString()}
                </div>
              )}
              
              {/* Quick Time Adjustment Buttons */}
              <div className="grid grid-cols-4 gap-1">
                <button
                  onClick={() => adjustTime(-60 * 60 * 1000)} // -1 hour
                  className="button button-secondary text-xs py-1"
                  disabled={playbackState.isPlaying}
                  title="Go back 1 hour"
                >
                  -1h
                </button>
                <button
                  onClick={() => adjustTime(-15 * 60 * 1000)} // -15 minutes
                  className="button button-secondary text-xs py-1"
                  disabled={playbackState.isPlaying}
                  title="Go back 15 minutes"
                >
                  -15m
                </button>
                <button
                  onClick={() => adjustTime(15 * 60 * 1000)} // +15 minutes
                  className="button button-secondary text-xs py-1"
                  disabled={playbackState.isPlaying}
                  title="Go forward 15 minutes"
                >
                  +15m
                </button>
                <button
                  onClick={() => adjustTime(60 * 60 * 1000)} // +1 hour
                  className="button button-secondary text-xs py-1"
                  disabled={playbackState.isPlaying}
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
              value={playbackState.speed}
              onChange={(e) => updatePlaybackState({ speed: Number(e.target.value) })}
              className="input w-full"
              disabled={playbackState.isPlaying}
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
              disabled={playbackState.isPlaying}
              title="Skip to start"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            
            <button
              onClick={stepBackward}
              className="button button-secondary p-2"
              disabled={playbackState.isPlaying}
              title="Step backward"
            >
              <SkipBack className="h-4 w-4" />
            </button>

            <button
              onClick={playbackState.isPlaying ? stopPlayback : startPlayback}
              className={`flex items-center gap-1 px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                playbackState.isPlaying 
                  ? 'bg-error hover:bg-error-light' 
                  : 'bg-success hover:bg-success-light'
              }`}
            >
              {playbackState.isPlaying ? (
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
              disabled={playbackState.isPlaying}
              title="Step forward"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            
            <button
              onClick={skipToEnd}
              className="button button-secondary p-2"
              disabled={playbackState.isPlaying}
              title="Skip to end"
            >
              <RotateCw className="h-4 w-4" />
            </button>
          </div>

          {/* Progress Indicator */}
          {playbackState.isPlaying && (
            <div className="bg-secondary p-3 rounded-md">
              <div className="flex justify-between text-sm text-secondary mb-2">
                <span>Progress</span>
                <span>{playbackState.currentIndex + 1} / {playbackState.totalRecords}</span>
              </div>
              <div className="w-full bg-tertiary rounded-full h-3">
                <div 
                  className="bg-success h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${((playbackState.currentIndex + 1) / playbackState.totalRecords) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Status Message */}
      {message.text && (
        <div className={`mt-3 p-2 rounded-md border ${
          message.type === 'error' 
            ? 'text-error border-error'
            : message.type === 'stopped'
            ? 'text-warning border-warning'
            : message.type === 'success'
            ? 'text-success border-success'
            : 'text-info border-info'
        }`}>
          <div className="flex items-center gap-1">
            <CheckCircle className={`h-4 w-4 ${
              message.type === 'error' 
                ? 'text-error' 
                : message.type === 'stopped'
                ? 'text-warning'
                : message.type === 'success'
                ? 'text-success'
                : 'text-info'
            }`} />
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}
    </div>
  );
}

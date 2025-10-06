'use client';

import { useState, useEffect, useRef } from 'react';

interface SensorData {
  timestamp: string;
  Temperature: number;
  Humidity: number;
  Light: number;
  CO2: number;
  HumidityRatio: number;
}

interface PredictionResult {
  timestamp: string;
  occupancy: number;
  probability: number;
  sensor_data: SensorData;
  status: string;
  error?: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  const requestInProgressRef = useRef<number>(0);

  useEffect(() => {
    // Connect to WebSocket with improved error handling
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_ML_API_WS_URL || 'ws://localhost:8000/ws';
      console.log('Attempting to connect to WebSocket:', wsUrl);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected successfully to:', wsUrl);
        setIsConnected(true);
        setMessage('Connected to ML prediction service');
      };
      
      ws.onmessage = (event) => {
        try {
          const prediction: PredictionResult = JSON.parse(event.data);
          setPredictions(prev => [prediction, ...prev.slice(0, 9)]); // Keep last 10 predictions
          console.log('Received prediction:', prediction);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setMessage(`Disconnected from ML prediction service (${event.code})`);
        
        // Only attempt to reconnect if it wasn't a manual close
        if (event.code !== 1000) {
          console.log('Attempting to reconnect in 3 seconds...');
          setReconnectAttempts(prev => prev + 1);
          setTimeout(connectWebSocket, 3000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.error('WebSocket URL:', wsUrl);
        console.error('WebSocket readyState:', ws.readyState);
        setIsConnected(false);
        setMessage(`WebSocket connection error - check if ML service is running at ${wsUrl}`);
      };
      
      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
      }
    };
  }, []);

  const sendKafkaMessage = async () => {
    // Increment request counter - this allows concurrent requests
    requestInProgressRef.current += 1;
    const requestId = requestInProgressRef.current;
    const activeCount = requestInProgressRef.current;
    setRequestCount(prev => prev + 1);
    
    // Only set loading for the first request
    if (activeCount === 1) {
      setIsLoading(true);
    }
    
    console.log(`[Request ${requestId}] Starting... (${activeCount} active)`);
    
    try {
      const response = await fetch('/api/kafka', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      
      if (data.success) {
        const msg = `[#${requestId}] Sent: Temp=${data.sensorData.Temperature}°C, Humidity=${data.sensorData.Humidity}%, Light=${data.sensorData.Light}lux`;
        setMessage(msg);
        console.log(msg);
      } else {
        const msg = `[#${requestId}] Error: ${data.error}`;
        setMessage(msg);
        console.error('API Error:', data);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const msg = `[#${requestId}] Network Error: ${errorMessage}`;
      setMessage(msg);
      console.error(`[Request ${requestId}] Network Error:`, error);
    } finally {
      // Decrement active count
      requestInProgressRef.current -= 1;
      
      // Only clear loading when all requests are done
      if (requestInProgressRef.current === 0) {
        setIsLoading(false);
      }
      
      console.log(`[Request ${requestId}] Completed (${requestInProgressRef.current} remaining)`);
    }
  };

  const manualReconnect = () => {
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual reconnect');
    }
    setReconnectAttempts(0);
    setMessage('Manually reconnecting...');
    // The useEffect will handle the reconnection
    setTimeout(() => {
      const wsUrl = process.env.NEXT_PUBLIC_ML_API_WS_URL || 'ws://localhost:8000/ws';
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('Manual reconnect successful');
        setIsConnected(true);
        setMessage('Reconnected to ML prediction service');
        setReconnectAttempts(0);
      };
      
      ws.onclose = (event) => {
        console.log('Manual reconnect failed:', event.code, event.reason);
        setIsConnected(false);
        setMessage(`Reconnection failed (${event.code})`);
      };
      
      ws.onerror = (error) => {
        console.error('Manual reconnect error:', error);
        setIsConnected(false);
        setMessage('Reconnection error - check if ML service is running');
      };
      
      wsRef.current = ws;
    }, 1000);
  };

  const testMLAPI = async () => {
    try {
      const mlApiUrl = process.env.NEXT_PUBLIC_ML_API_URL || 'http://localhost:8000';
      console.log('Testing ML API at:', mlApiUrl);
      
      const response = await fetch(`${mlApiUrl}/health`);
      const data = await response.json();
      
      console.log('ML API Health Response:', data);
      setMessage(`ML API Health: ${data.status} - Kafka: ${data.kafka_consumer}`);
    } catch (error) {
      console.error('ML API Health Check Failed:', error);
      setMessage(`ML API Health Check Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getOccupancyStatus = (occupancy: number) => {
    return occupancy === 1 ? 'Occupied' : occupancy === 0 ? 'Vacant' : 'Error';
  };

  const getOccupancyColor = (occupancy: number) => {
    if (occupancy === 1) return 'text-red-600';
    if (occupancy === 0) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className="font-sans min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">
          Digital Twin - Occupancy Prediction
        </h1>
        
        {/* Connection Status */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className={`w-3 h-3 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-medium">
                {isConnected ? 'Connected to ML Service' : 'Disconnected from ML Service'}
              </span>
              {!isConnected && reconnectAttempts > 0 && (
                <span className="text-xs text-gray-500 ml-2">
                  (Attempt {reconnectAttempts})
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={sendKafkaMessage}
                className="px-4 py-2 rounded-md font-medium transition-colors bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white"
              >
                {isLoading ? `Sending... (${requestCount})` : 'Send Sensor Data'}
              </button>
              {!isConnected && (
                <button
                  onClick={manualReconnect}
                  className="px-3 py-2 rounded-md font-medium bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white text-sm"
                >
                  Reconnect
                </button>
              )}
              <button
                onClick={testMLAPI}
                className="px-3 py-2 rounded-md font-medium bg-green-600 hover:bg-green-700 active:bg-green-800 text-white text-sm"
              >
                Test ML API
              </button>
            </div>
          </div>
          
          {message && (
            <div className={`mt-3 p-3 rounded-md ${
              message.includes('Error') 
                ? 'bg-red-100 text-red-700 border border-red-200' 
                : 'bg-green-100 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        {/* Predictions Display */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Predictions */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Predictions</h2>
            {predictions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No predictions yet. Send sensor data to see results.</p>
            ) : (
              <div className="space-y-3">
                {predictions.map((prediction, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-600">{formatTimestamp(prediction.timestamp)}</span>
                      <span className={`text-sm font-medium ${getOccupancyColor(prediction.occupancy)}`}>
                        {getOccupancyStatus(prediction.occupancy)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      <div>Probability: {(prediction.probability * 100).toFixed(1)}%</div>
                      {prediction.status === 'error' && (
                        <div className="text-red-600 mt-1">Error: {prediction.error}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sensor Data Display */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Latest Sensor Data</h2>
            {predictions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sensor data received yet.</p>
            ) : (
              <div className="space-y-3">
                {predictions.slice(0, 1).map((prediction, index) => (
                  <div key={index} className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Temperature:</span>
                        <span className="ml-2 font-medium">{prediction.sensor_data.Temperature}°C</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Humidity:</span>
                        <span className="ml-2 font-medium">{prediction.sensor_data.Humidity}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Light:</span>
                        <span className="ml-2 font-medium">{prediction.sensor_data.Light} lux</span>
                      </div>
                      <div>
                        <span className="text-gray-600">CO2:</span>
                        <span className="ml-2 font-medium">{prediction.sensor_data.CO2} ppm</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Humidity Ratio:</span>
                        <span className="ml-2 font-medium">{prediction.sensor_data.HumidityRatio}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

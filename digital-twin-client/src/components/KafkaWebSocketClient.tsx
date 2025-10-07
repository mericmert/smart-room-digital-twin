import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

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

interface KafkaWebSocketClientProps {
  onConnectionChange?: (connected: boolean) => void;
}

export default function KafkaWebSocketClient({ 
  onConnectionChange 
}: KafkaWebSocketClientProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastResult, setLastResult] = useState<PredictionResult | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setConnectionStatus('connecting');
    
    try {
      // Connect to the ML API WebSocket endpoint
      const wsUrl = `${process.env.NEXT_PUBLIC_ML_API_URL || 'ws://localhost:8000'}/ws/prediction-results`;
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected to prediction results');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttempts.current = 0;
        onConnectionChange?.(true);
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'prediction_result') {
            const result: PredictionResult = message.data;
            setLastResult(result);
            
            // Dispatch custom event for other components to listen to
            const customEvent = new CustomEvent('predictionResult', { detail: result });
            window.dispatchEvent(customEvent);
            
            console.log('Received prediction result:', result);
          } else if (message.type === 'pong') {
            // Keep-alive response
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onConnectionChange?.(false);
        
        // Attempt to reconnect if not a manual close
        if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts.current})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      setConnectionStatus('error');
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
    onConnectionChange?.(false);
  };

  const sendPing = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  };

  useEffect(() => {
    connect();

    // Send ping every 30 seconds to keep connection alive
    const pingInterval = setInterval(sendPing, 30000);

    return () => {
      clearInterval(pingInterval);
      disconnect();
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'text-success';
      case 'connecting': return 'text-warning';
      case 'disconnected': return 'text-secondary';
      case 'error': return 'text-error';
      default: return 'text-secondary';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected': return <Wifi className="h-4 w-4" />;
      case 'connecting': return <Wifi className="h-4 w-4 animate-pulse" />;
      case 'disconnected': return <WifiOff className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <WifiOff className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center gap-2 p-3 bg-secondary rounded-lg">
        {getStatusIcon()}
        <span className={`text-sm font-medium ${getStatusColor()}`}>
          WebSocket: {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
        </span>
        {reconnectAttempts.current > 0 && (
          <span className="text-xs text-muted">
            (Reconnect attempt {reconnectAttempts.current}/{maxReconnectAttempts})
          </span>
        )}
      </div>
      {/* Controls */}
      <div className="flex gap-2">
        <button
          onClick={connect}
          disabled={isConnected}
          className="px-3 py-1 text-xs bg-brand text-inverse rounded disabled:bg-tertiary disabled:text-muted"
        >
          Connect
        </button>
        <button
          onClick={disconnect}
          disabled={!isConnected}
          className="px-3 py-1 text-xs bg-error text-inverse rounded disabled:bg-tertiary disabled:text-muted"
        >
          Disconnect
        </button>
        <button
          onClick={sendPing}
          disabled={!isConnected}
          className="px-3 py-1 text-xs bg-success text-inverse rounded disabled:bg-tertiary disabled:text-muted"
        >
          Ping
        </button>
      </div>
    </div>
  );
}

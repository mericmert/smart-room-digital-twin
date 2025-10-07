'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

type SensorKey = 'Temperature' | 'Humidity' | 'Light' | 'CO2' | 'HumidityRatio' | 'Occupancy';

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

interface ChartPoint {
  time: number; // epoch ms
  Temperature: number;
  Humidity: number;
  Light: number;
  CO2: number;
  HumidityRatio: number;
  Occupancy: number;
}

interface LiveSensorChartsProps {
  maxPoints?: number;
}

function formatTime(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

export default function LiveSensorCharts({ maxPoints = 120 }: LiveSensorChartsProps) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const dataRef = useRef<ChartPoint[]>([]);

  useEffect(() => {
    const handlePredictionResult = (event: Event) => {
      const custom = event as CustomEvent<PredictionResult>;
      const pr = custom.detail;
      if (!pr || !pr.features) return;

      const time = pr.features.timestamp || pr.timestamp;
      const ts = time ? new Date(time).getTime() : Date.now();
      const point: ChartPoint = {
        time: ts,
        Temperature: pr.features.Temperature,
        Humidity: pr.features.Humidity,
        Light: pr.features.Light,
        CO2: pr.features.CO2,
        HumidityRatio: pr.features.HumidityRatio,
        Occupancy:
          pr.actual_occupancy !== undefined ? pr.actual_occupancy : pr.occupancy
      };

      const existingIndex = dataRef.current.findIndex((p) => p.time === ts);
      const next = existingIndex !== -1
        ? (() => {
            const copy = [...dataRef.current];
            copy[existingIndex] = point;
            return copy;
          })()
        : [...dataRef.current, point];
      const trimmed = next.length > maxPoints ? next.slice(next.length - maxPoints) : next;
      dataRef.current = trimmed;
      setData(trimmed);
    };

    const handlePlaybackStart = (event: Event) => {
      const custom = event as CustomEvent<{ start: number; end: number }>;
      const { start, end } = custom.detail || {} as any;
      if (typeof start !== 'number' || typeof end !== 'number') return;
      // Clear any existing points within the playback range so they will be replaced
      const filtered = dataRef.current.filter((p) => p.time < start || p.time > end);
      dataRef.current = filtered;
      setData(filtered);
    };

    window.addEventListener('predictionResult', handlePredictionResult as EventListener);
    window.addEventListener('playbackStart', handlePlaybackStart as EventListener);
    return () => {
      window.removeEventListener('predictionResult', handlePredictionResult as EventListener);
      window.removeEventListener('playbackStart', handlePlaybackStart as EventListener);
    };
  }, [maxPoints]);

  const charts = useMemo(
    () => [
      {
        key: 'Temperature' as SensorKey,
        title: 'Temperature (°C)',
        color: 'var(--color-temperature)'
      },
      { key: 'Humidity' as SensorKey, title: 'Humidity (%)', color: 'var(--color-humidity)' },
      { key: 'Light' as SensorKey, title: 'Light (lux)', color: 'var(--color-light)' },
      { key: 'CO2' as SensorKey, title: 'CO2 (ppm)', color: 'var(--color-co2)' },
      {
        key: 'HumidityRatio' as SensorKey,
        title: 'Humidity Ratio',
        color: 'var(--color-info)'
      },
      { key: 'Occupancy' as SensorKey, title: 'Occupancy', color: 'var(--color-occupancy-occupied)' }
    ],
    []
  );

  return (
    <div className="card-elevated p-4">
      <div className="mb-3">
        <h3 className="text-lg font-semibold">Live Sensor Charts</h3>
        <div className="text-xs text-secondary">Streaming from WebSocket</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {charts.map(({ key, title, color }) => (
          <div key={key} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="text-sm font-medium mb-2">{title}</div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <LineChart data={data} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    tickFormatter={formatTime}
                    type="number"
                    domain={[
                      (dataMin: number) => (dataMin ? dataMin : Date.now() - 60000),
                      (dataMax: number) => (dataMax ? dataMax : Date.now())
                    ]}
                  />
                  <YAxis domain={['auto', 'auto']} allowDecimals />
                  <Tooltip
                    labelFormatter={(label) => new Date(Number(label)).toLocaleString()}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey={key}
                    stroke={color}
                    dot={false}
                    isAnimationActive={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}



import { useQuery, useMutation } from '@tanstack/react-query';
import { SensorDataPoint } from '@/utils/dataParser';

// Types
interface DataFile {
  filename: string;
  totalRecords: number;
  timeRange: {
    start: string;
    end: string;
  };
}

interface PredictionResult {
  occupancy: number;
  actual_occupancy?: number; // Add actual occupancy field
  probability: number;
  is_anomaly?: boolean;
  features?: any;
  status?: string;
  model_version?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  files?: DataFile[];
}

// API functions
const fetchDataFiles = async (): Promise<DataFile[]> => {
  const response = await fetch('/api/replay?action=list-files');
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data: ApiResponse<never> = await response.json();
  
  if (data.success && data.files) {
    return data.files;
  } else {
    throw new Error(data.error || 'Unknown error');
  }
};

const fetchDataAtTime = async (filename: string, time: string): Promise<SensorDataPoint[]> => {
  const response = await fetch(`/api/replay?action=get-data&filename=${filename}&time=${time}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data: ApiResponse<{ data: SensorDataPoint[] }> = await response.json();
  
  if (data.success && data.data?.data) {
    return data.data.data;
  } else {
    throw new Error(data.error || 'No data found at selected time');
  }
};

const fetchAllDataForFile = async (filename: string): Promise<SensorDataPoint[]> => {
  const response = await fetch(`/api/replay?action=get-data&filename=${filename}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const data: ApiResponse<{ data: SensorDataPoint[] }> = await response.json();
  
  if (data.success && data.data?.data) {
    return data.data.data;
  } else {
    throw new Error(data.error || 'Failed to load data for playback');
  }
};

const predictOccupancy = async (dataPoint: SensorDataPoint): Promise<PredictionResult> => {
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
  
  // Handle both legacy and enhanced response formats
  if (predictionResult.occupancy !== undefined && (predictionResult.probability !== undefined || predictionResult.prob !== undefined)) {
    return {
      occupancy: predictionResult.occupancy,
      probability: predictionResult.probability !== undefined ? predictionResult.probability : predictionResult.prob,
      is_anomaly: predictionResult.is_anomaly,
      features: predictionResult.features,
      status: predictionResult.status,
      model_version: predictionResult.model_version
    };
  } else {
    throw new Error('Invalid prediction response from ML API');
  }
};

// Custom hooks
export const useDataFiles = () => {
  return useQuery({
    queryKey: ['dataFiles'],
    queryFn: fetchDataFiles,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
  });
};

export const useDataAtTime = (filename: string, time: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['dataAtTime', filename, time],
    queryFn: () => fetchDataAtTime(filename, time),
    enabled: enabled && !!filename && !!time,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

export const useAllDataForFile = (filename: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['allDataForFile', filename],
    queryFn: () => fetchAllDataForFile(filename),
    enabled: enabled && !!filename,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
  });
};

export const usePrediction = () => {
  return useMutation({
    mutationFn: predictOccupancy,
    retry: 1,
    retryDelay: 1000,
    // Cache successful predictions for a short time
    onSuccess: (data, variables, context) => {
      // Could implement prediction caching here if needed
    },
  });
};

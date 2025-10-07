# Fixed: Replay Button Now Uses Kafka Instead of HTTP Requests

## Problem Identified

The replay button in `TimeScrubberControls.tsx` was still making HTTP requests to `/api/ml/predict` instead of sending data to Kafka for processing.

## Solution Implemented

### **Updated TimeScrubberControls.tsx**

**Before (HTTP-based):**
```typescript
const getPrediction = useCallback(async (data: SensorDataPoint) => {
  const response = await fetch('/api/ml/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: data.date,
      Temperature: data.Temperature,
      Humidity: data.Humidity,
      Light: data.Light,
      CO2: data.CO2,
      HumidityRatio: data.HumidityRatio
    }),
  });
  // ... handle HTTP response
}, [onPrediction]);
```

**After (Kafka-based):**
```typescript
const sendToKafka = useCallback(async (data: SensorDataPoint) => {
  const response = await fetch('/api/replay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'send-kafka-message',
      filename: selectedFile,
      time: data.date
    }),
  });
  // ... handle Kafka response
}, [selectedFile, updateMessage]);
```

### **Updated All Replay Functions**

Replaced all `getPrediction(data)` calls with `sendToKafka(data)` in:

1. **Playback Start** - When starting playback
2. **Playback Step** - During automatic playback progression
3. **Time Selection** - When manually selecting a time
4. **Skip to Start** - When jumping to beginning
5. **Skip to End** - When jumping to end
6. **Step Backward** - Manual step back
7. **Step Forward** - Manual step forward

## New Flow

### **1. User Interaction**
- User clicks play, steps, or selects time
- Data is sent to Kafka via `/api/replay` with `send-kafka-message` action

### **2. Kafka Processing**
- Replay API sends sensor data to Kafka
- Enhanced Kafka consumer processes the data
- Anomaly detection + ML prediction runs
- Results are broadcast via WebSocket

### **3. Real-time Results**
- WebSocket client receives processed results
- Dashboard updates with `{features, prob, occupancy, is_anomaly}`
- Visual indicators show anomaly status

## Benefits

✅ **No more HTTP prediction calls** - All processing via Kafka
✅ **Real-time results** - WebSocket delivery of processed data
✅ **Proper architecture** - Features delivered via Kafka as requested
✅ **Consistent flow** - All replay interactions use Kafka
✅ **Better performance** - Asynchronous processing pipeline

## Testing

To test the fix:

1. **Start ML API** with `ENABLE_KAFKA=true`
2. **Start Next.js client**
3. **Use replay controls** (play, step, time selection)
4. **Observe** that data is sent to Kafka (check console logs)
5. **Verify** results appear via WebSocket in the Kafka WebSocket client component

The replay button now properly sends data to Kafka instead of making HTTP prediction requests! 🎉

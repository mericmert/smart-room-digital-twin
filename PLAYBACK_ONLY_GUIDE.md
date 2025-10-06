# Playback-Only TimeScrubber Guide

## Overview

The TimeScrubber component has been simplified to focus exclusively on playback functionality. All WebSocket-related code and synchronization mechanisms have been removed.

## What Was Removed

### WebSocket Components
- WebSocket connection management
- Real-time prediction handling
- WebSocket status display
- Connection retry logic

### Synchronization Features
- Three synchronization modes (real-time, playback, hybrid)
- Timestamp-based synchronization
- Pending prediction queue
- WebSocket prediction matching

### UI Elements
- Synchronization mode controls
- WebSocket connection status panel
- Real-time prediction indicators

## What Remains

### Core Playback Features
- **Data File Loading**: Load and parse historical sensor data files
- **Time Navigation**: Manual time selection with datetime picker
- **Playback Controls**: Play, pause, speed control (0.5x to 10x)
- **Progress Tracking**: Visual progress bar during playback
- **Chart Visualization**: Interactive data trends chart

### ML Integration
- **HTTP Predictions**: ML predictions via REST API during playback
- **Prediction Display**: Real-time prediction results with confidence scores
- **Data Processing**: Automatic prediction for each playback data point

### UI Components
- **File Selection**: Choose from available data files
- **Time Controls**: Start/end navigation, manual time selection
- **Sensor Data Display**: Current sensor readings with visual indicators
- **Prediction Results**: ML prediction status and confidence
- **Status Messages**: User feedback and error handling

## Usage

### Basic Playback
1. **Select Data File**: Choose from available historical data files
2. **Set Time Range**: Use datetime picker or start/end buttons
3. **Configure Playback**: Set speed (0.5x to 10x)
4. **Start Playback**: Click play button to begin historical data playback
5. **Monitor Results**: View sensor data and ML predictions in real-time

### Features
- **Speed Control**: Playback at various speeds for analysis
- **Chart Visualization**: View data trends over time
- **ML Predictions**: Automatic occupancy predictions for each data point

## Technical Details

### Data Flow
1. Load historical data from files
2. Parse and validate sensor data
3. Start playback at selected time/speed
4. For each data point:
   - Display sensor readings
   - Send data to ML API
   - Display prediction results
   - Update progress

### API Integration
- **Replay API**: `/api/replay` for data file management
- **ML API**: `/api/ml/predict` for occupancy predictions
- **Error Handling**: Graceful fallback for API failures

### Performance
- **Efficient Playback**: Optimized interval-based updates
- **Memory Management**: Proper cleanup of intervals and refs
- **Error Recovery**: Robust error handling and user feedback

## Benefits of Playback-Only Approach

1. **Simplicity**: Cleaner codebase without WebSocket complexity
2. **Reliability**: No network dependency for real-time connections
3. **Performance**: Faster startup and more predictable behavior
4. **Testing**: Easier to test with historical data
5. **Analysis**: Better suited for historical data analysis

## Future Enhancements

If you need real-time features in the future, consider:
- Separate real-time monitoring component
- WebSocket integration for live data
- Hybrid mode with both playback and real-time capabilities

The current implementation provides a solid foundation for historical data analysis and can be extended as needed.

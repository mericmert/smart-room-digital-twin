# Time Scrubber Feature Guide

## Overview

The Time Scrubber feature allows you to replay historical sensor data from CSV files through the digital twin system. This enables testing and demonstration of the ML prediction pipeline using real sensor data with precise time control.

## Features

### 1. Data File Management
- **Supported Files**: `datatest.txt`, `datatest2.txt`, `datatraining.txt`
- **Automatic Loading**: Files are loaded from the ML API data endpoint
- **File Information**: Shows total records and time range for each file

### 2. Time Navigation
- **Time Picker**: Select any timestamp within the data range
- **Quick Navigation**: Jump to start/end of data
- **Real-time Display**: Shows current selected time and corresponding sensor data

### 3. Playback Controls
- **Play/Stop**: Start and stop time-based playback
- **Speed Control**: Adjust playback speed (0.5x to 10x)
- **Time Window**: Set data window size (1 min to 1 hour)

### 4. Data Integration
- **Kafka Integration**: Send selected data points to Kafka for ML processing
- **WebSocket Updates**: Receive real-time predictions from the ML service
- **Data Formatting**: Properly formats historical data for current system

## Usage

### 1. Access the Time Scrubber
The Time Scrubber is integrated into the main web client interface. It appears as a new section above the predictions display.

### 2. Select Data File
1. Choose from available data files in the dropdown
2. View file information (total records, time range)
3. The time picker will update to show the available time range

### 3. Navigate Through Time
1. Use the datetime picker to select a specific time
2. Click "Start" to jump to the beginning of the data
3. Click "End" to jump to the end of the data
4. The current sensor data will be displayed automatically

### 4. Playback Data
1. Set your desired playback speed (0.5x to 10x)
2. Choose a time window size for data context
3. Click "Play" to start time-based playback
4. Click "Stop" to pause playback

### 5. Send to Kafka
1. Select a data point by navigating to a specific time
2. Click "Send to Kafka" to send the data through the ML pipeline
3. Monitor the predictions display for real-time results

## Technical Details

### Data Format
The time scrubber expects CSV files with the following format:
```csv
"date","Temperature","Humidity","Light","CO2","HumidityRatio","Occupancy"
"1","2015-02-04 17:51:00",23.18,27.272,426,721.25,0.00479298817650529,1
```

### API Endpoints
- `GET /api/replay?action=list-files` - List available data files
- `GET /api/replay?action=get-data&filename=X&time=Y` - Get data at specific time
- `POST /api/replay` - Send data to Kafka

### Data Flow
1. **Data Loading**: CSV files are parsed and cached in memory
2. **Time Selection**: User selects a time point within the data range
3. **Data Retrieval**: System finds the closest data point to the selected time
4. **Kafka Integration**: Data is formatted and sent to Kafka topic
5. **ML Processing**: ML service processes the data and returns predictions
6. **WebSocket Updates**: Results are pushed to the web client in real-time

## Configuration

### Environment Variables
- `NEXT_PUBLIC_ML_API_URL`: ML API base URL (default: http://localhost:8000)
- `KAFKA_BROKER_URL`: Kafka broker URL (default: localhost:9092)
- `KAFKA_TOPIC`: Kafka topic name (default: docker-occupancy-data)

### Data File Location
Data files should be placed in the `data/` directory of the project root:
```
data/
├── datatest.txt
├── datatest2.txt
└── datatraining.txt
```

## Troubleshooting

### Common Issues

1. **No data files available**
   - Check that files exist in the `data/` directory
   - Verify ML API is running and accessible
   - Check browser console for API errors

2. **Time picker not working**
   - Ensure a data file is selected first
   - Check that the selected time is within the data range
   - Verify the time format is correct

3. **Kafka sending fails**
   - Check Kafka broker is running
   - Verify environment variables are set correctly
   - Check network connectivity to Kafka

4. **No predictions received**
   - Ensure WebSocket connection is established
   - Check ML service is running and processing data
   - Verify Kafka consumer is active

### Debug Information
- Check browser console for detailed error messages
- Monitor ML API logs for processing errors
- Verify Kafka topic has messages being produced

## Future Enhancements

- **Data Visualization**: Add charts and graphs for sensor data
- **Batch Processing**: Send multiple data points in sequence
- **Custom Time Ranges**: Allow custom start/end time selection
- **Data Export**: Export selected data ranges
- **Real-time Simulation**: Simulate real-time data flow with historical data

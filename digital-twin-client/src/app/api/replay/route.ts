import { NextRequest, NextResponse } from 'next/server';
import { DataParser, SensorDataPoint } from '@/utils/dataParser';
import fs from 'fs';
import path from 'path';

const dataCache = new Map<string, any>();

async function loadDataFiles() {
  if (dataCache.size > 0) return;

  try {
    const dataDir = path.join(process.cwd(), '..', 'data');
    
    const files = fs.readdirSync(dataDir).filter(file => 
      file.endsWith('.txt') || file.endsWith('.csv')
    );
    
    for (const filename of files) {
      try {
        const filePath = path.join(dataDir, filename);
        
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = await DataParser.parseDataFile(content, filename);
          dataCache.set(filename, parsed);
          console.log(`Loaded ${filename}: ${parsed.totalRecords} records`);
        } else {
          console.warn(`File not found: ${filePath}`);
        }
      } catch (error) {
        console.error(`Failed to load ${filename}:`, error);
      }
    }
  } catch (error) {
    console.error('Error loading data files:', error);
  }
}

loadDataFiles();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const filename = searchParams.get('filename');
    const time = searchParams.get('time');

    console.log(`[Replay API] GET request - action: ${action}, filename: ${filename}, time: ${time}`);

    await loadDataFiles();

    switch (action) {
      case 'list-files':
        if (dataCache.size === 0) {
          console.log('[Replay API] No data files loaded, attempting to reload...');
          await loadDataFiles();
        }
        
        const fileList = Array.from(dataCache.keys()).map(name => {
          const data = dataCache.get(name);
          return {
            filename: name,
            totalRecords: data?.totalRecords || 0,
            timeRange: data?.timeRange || { start: '', end: '' }
          };
        });
        console.log(`[Replay API] Returning ${fileList.length} files`);
        return NextResponse.json({ 
          success: true, 
          files: fileList,
          cacheSize: dataCache.size,
          dataDir: path.join(process.cwd(), '..', 'data')
        });

      case 'get-data':
        if (!filename || !dataCache.has(filename)) {
          return NextResponse.json(
            { success: false, error: 'File not found' },
            { status: 404 }
          );
        }

        const fileData = dataCache.get(filename);
        
        if (!time) {
          return NextResponse.json({
            success: true,
            data: fileData
          });
        }

        const targetTime = new Date(time);
        const dataAtTime = DataParser.getDataAtTime(fileData.data, targetTime);
        
        if (!dataAtTime) {
          return NextResponse.json(
            { success: false, error: 'No data found at specified time' },
            { status: 404 }
          );
        }


        return NextResponse.json({
          success: true,
          data: {
            ...fileData,
            data: [dataAtTime],
            totalRecords: 1
          },
          currentTime: targetTime.toISOString()
        });

      case 'get-time-range':
        if (!filename || !dataCache.has(filename)) {
          return NextResponse.json(
            { success: false, error: 'File not found' },
            { status: 404 }
          );
        }

        const fileDataForRange = dataCache.get(filename);
        return NextResponse.json({
          success: true,
          timeRange: fileDataForRange.timeRange,
          totalRecords: fileDataForRange.totalRecords
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Replay API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, filename, time, speed = 1 } = body;

    await loadDataFiles();

    switch (action) {
      case 'send-kafka-message':
        if (!filename || !time || !dataCache.has(filename)) {
          return NextResponse.json(
            { success: false, error: 'Missing required parameters' },
            { status: 400 }
          );
        }

        const fileData = dataCache.get(filename);
        const targetTime = new Date(time);
        const dataAtTime = DataParser.getDataAtTime(fileData.data, targetTime);
        
        if (!dataAtTime) {
          return NextResponse.json(
            { success: false, error: 'No data found at specified time' },
            { status: 404 }
          );
        }

        const kafkaData = DataParser.formatSensorDataForKafka(dataAtTime);
        
        // Send data to Kafka for processing (features will be processed via Kafka, not HTTP)
        const kafkaResponse = await fetch(`${request.nextUrl.origin}/api/kafka`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sensorData: kafkaData,
            source: 'replay',
            filename: filename,
            timestamp: time
          })
        });

        const kafkaResult = await kafkaResponse.json();

        return NextResponse.json({
          success: true,
          message: `Sent data from ${filename} at ${time} to Kafka for processing`,
          sensorData: kafkaData,
          kafkaResult: kafkaResult,
          originalData: dataAtTime,
          note: "Results will be delivered via WebSocket to connected clients"
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Replay API POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

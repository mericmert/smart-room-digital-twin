import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if we can connect to API
    const mlApiUrl = process.env.ML_API_URL || 'http://localhost:8000';
    const kafkaBrokerUrl = process.env.KAFKA_BROKER_URL || 'localhost:9092';
    
    let mlApiStatus = 'unknown';
    let kafkaStatus = 'unknown';
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${mlApiUrl}/health`, { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      mlApiStatus = response.ok ? 'healthy' : 'unhealthy';
    } catch (error) {
      mlApiStatus = 'unreachable';
    }
    
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        nextjs: 'healthy',
        ml_api: mlApiStatus,
        kafka_broker: kafkaStatus
      },
      environment: {
        node_env: process.env.NODE_ENV || 'development',
        ml_api_url: mlApiUrl,
        kafka_broker_url: kafkaBrokerUrl,
        kafka_topic: process.env.KAFKA_TOPIC || 'docker-occupancy-data'
      }
    };
    
    return NextResponse.json(healthStatus, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

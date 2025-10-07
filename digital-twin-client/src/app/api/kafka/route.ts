import { NextRequest, NextResponse } from 'next/server';
import { Kafka, Producer } from 'kafkajs';

// Global producer connection pool
let producerInstance: Producer | null = null;
let producerConnecting: Promise<void> | null = null;

// Environment-aware Kafka configuration
const getKafkaConfig = () => {
  const brokerUrl = process.env.KAFKA_BROKER_URL || 'localhost:19092';
  const topic = process.env.KAFKA_TOPIC || 'docker-occupancy-data';
  const clientId = process.env.KAFKA_CLIENT_ID || 'digital-twin-client';

  return {
    kafka: new Kafka({
      clientId,
      brokers: [brokerUrl],
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    }),
    topic,
    clientId
  };
};

// Get or create a persistent Kafka producer
const getProducer = async (): Promise<Producer> => {
  if (producerInstance) {
    return producerInstance;
  }

  // If already connecting, wait for that connection
  if (producerConnecting) {
    await producerConnecting;
    if (producerInstance) {
      return producerInstance;
    }
  }

  // Create new connection
  const { kafka } = getKafkaConfig();
  const producer = kafka.producer();
  
  producerConnecting = producer.connect();
  await producerConnecting;
  producerConnecting = null;
  
  producerInstance = producer;
  console.log('Kafka producer connected and ready');
  
  return producer;
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { topic, clientId } = getKafkaConfig();
    
    // Check if we should use simulation mode (only if explicitly disabled)
    const brokerUrl = process.env.KAFKA_BROKER_URL || 'localhost:19092';
    const enableKafka = process.env.ENABLE_KAFKA !== 'false';
    const useSimulation = !enableKafka || brokerUrl === 'simulation';
    
    // Parse request body to check if sensor data is provided
    let requestBody = null;
    try {
      requestBody = await request.json();
    } catch (e) {
      // If no body, continue with generated data
    }
    
    // Use provided sensor data or generate realistic sensor data
    const sensorData = requestBody?.sensorData || {
      timestamp: new Date().toISOString(),
      Temperature: Math.round((Math.random() * 10 + 20) * 10) / 10, // 20-30°C
      Humidity: Math.round((Math.random() * 30 + 40) * 10) / 10, // 40-70%
      Light: Math.round(Math.random() * 1000), // 0-1000 lux
      CO2: Math.round(Math.random() * 500 + 400), // 400-900 ppm
      HumidityRatio: Math.round((Math.random() * 0.01 + 0.005) * 1000) / 1000 // 0.005-0.015
    };
    
    // Add metadata if provided
    const messageMetadata = requestBody ? {
      source: requestBody.source || 'generated',
      filename: requestBody.filename,
      timestamp: requestBody.timestamp
    } : {
      source: 'generated'
    };
    
    if (useSimulation) {
      // Kafka simulation mode - generate data but don't send to Kafka
      console.log(`[Simulation] Generated sensor data in ${Date.now() - startTime}ms`);
      
      return NextResponse.json(
        { 
          success: true, 
          message: `Simulation mode - sensor data generated (Kafka disabled)`,
          sensorData: sensorData,
          config: {
            broker: brokerUrl,
            topic,
            clientId,
            mode: "simulation"
          }
        },
        { status: 200 }
      );
    }
    
    // Use persistent producer for better performance with concurrent requests
    const producer = await getProducer();
    
    console.log(`[Kafka] Sending message to topic "${topic}"...`);
    
    // Create the complete message with sensor data and metadata
    const kafkaMessage = {
      ...sensorData,
      metadata: messageMetadata,
      processed_at: new Date().toISOString()
    };
    
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(kafkaMessage),
          timestamp: Date.now().toString(),
        },
      ],
    });
    
    console.log(`[Kafka] Message sent successfully in ${Date.now() - startTime}ms`);
    
    return NextResponse.json(
      { 
        success: true, 
        message: `Sensor data sent to topic "${topic}"`,
        sensorData: sensorData,
        metadata: messageMetadata,
        config: {
          broker: process.env.KAFKA_BROKER_URL || 'localhost:19092',
          topic,
          clientId
        },
        processingTime: `${Date.now() - startTime}ms`
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Kafka] Error sending message:', error);
    
    // If it's a connection error, reset the producer
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConnectionError = errorMessage.includes('ENOTFOUND') || 
                              errorMessage.includes('ECONNREFUSED') ||
                              errorMessage.includes('Connection') ||
                              errorMessage.includes('timeout');
    
    if (isConnectionError && producerInstance) {
      console.log('[Kafka] Connection error detected, resetting producer...');
      try {
        await producerInstance.disconnect();
      } catch (e) {
        console.error('[Kafka] Error disconnecting producer:', e);
      }
      producerInstance = null;
      producerConnecting = null;
    }
    
    if (isConnectionError) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Kafka broker not available: ${errorMessage}`,
          suggestion: "Make sure Kafka is running locally or use Docker Compose",
          config: {
            broker: process.env.KAFKA_BROKER_URL || 'localhost:19092',
            topic: process.env.KAFKA_TOPIC || 'docker-occupancy-data',
            clientId: process.env.KAFKA_CLIENT_ID || 'digital-twin-client'
          },
          processingTime: `${Date.now() - startTime}ms`
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to send Kafka message: ${errorMessage}`,
        config: {
          broker: process.env.KAFKA_BROKER_URL || 'localhost:19092',
          topic: process.env.KAFKA_TOPIC || 'docker-occupancy-data',
          clientId: process.env.KAFKA_CLIENT_ID || 'digital-twin-client'
        },
        processingTime: `${Date.now() - startTime}ms`
      },
      { status: 500 }
    );
  }
}

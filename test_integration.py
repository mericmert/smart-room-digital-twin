#!/usr/bin/env python3
"""
Test script to verify the complete Kafka -> ML integration.
This script sends test sensor data to Kafka and verifies the ML processing works.
"""

import json
import time
import requests
from datetime import datetime
from kafka import KafkaProducer

# Configuration
KAFKA_BOOTSTRAP_SERVERS = "localhost:9092"
KAFKA_TOPIC = "test-topic"
ML_API_URL = "http://localhost:8000"

def create_test_sensor_data():
    """Create realistic test sensor data."""
    return {
        "timestamp": datetime.now().isoformat(),
        "Temperature": 23.5,
        "Humidity": 55.2,
        "Light": 450,
        "CO2": 650,
        "HumidityRatio": 0.0085
    }

def send_test_data_to_kafka():
    """Send test sensor data to Kafka."""
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda x: json.dumps(x).encode('utf-8')
    )
    
    sensor_data = create_test_sensor_data()
    
    try:
        future = producer.send(KAFKA_TOPIC, sensor_data)
        record_metadata = future.get(timeout=10)
        
        print(f"✅ Successfully sent sensor data to Kafka:")
        print(f"   Topic: {record_metadata.topic}")
        print(f"   Partition: {record_metadata.partition}")
        print(f"   Offset: {record_metadata.offset}")
        print(f"   Data: {json.dumps(sensor_data, indent=2)}")
        
        return True
    except Exception as e:
        print(f"❌ Failed to send data to Kafka: {e}")
        return False
    finally:
        producer.close()

def test_ml_api_health():
    """Test if the ML API is running and healthy."""
    try:
        response = requests.get(f"{ML_API_URL}/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ ML API is healthy:")
            print(f"   Status: {health_data.get('status')}")
            print(f"   Kafka Consumer: {health_data.get('kafka_consumer')}")
            print(f"   Kafka Topic: {health_data.get('kafka_topic')}")
            return True
        else:
            print(f"❌ ML API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to ML API: {e}")
        return False

def test_direct_prediction():
    """Test direct prediction via the ML API."""
    sensor_data = create_test_sensor_data()
    
    # Convert to the format expected by the API
    api_request = {
        "date": sensor_data["timestamp"],
        "Temperature": sensor_data["Temperature"],
        "Humidity": sensor_data["Humidity"],
        "Light": sensor_data["Light"],
        "CO2": sensor_data["CO2"],
        "HumidityRatio": sensor_data["HumidityRatio"]
    }
    
    try:
        response = requests.post(
            f"{ML_API_URL}/predict",
            json=api_request,
            timeout=10
        )
        
        if response.status_code == 200:
            prediction = response.json()
            print(f"✅ Direct prediction successful:")
            print(f"   Occupancy: {prediction['occupancy']} ({'Occupied' if prediction['occupancy'] == 1 else 'Vacant'})")
            print(f"   Probability: {prediction['probability']:.3f}")
            return True
        else:
            print(f"❌ Direct prediction failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except Exception as e:
        print(f"❌ Failed to make direct prediction: {e}")
        return False

def main():
    """Run all integration tests."""
    print("🧪 Starting Digital Twin Integration Tests")
    print("=" * 50)
    
    # Test 1: ML API Health
    print("\n1. Testing ML API Health...")
    api_healthy = test_ml_api_health()
    
    if not api_healthy:
        print("\n❌ ML API is not running. Please start it first:")
        print("   cd /Users/mericmertbulca/digital_twin_project")
        print("   python -m src.occupancy_ml.api")
        return
    
    # Test 2: Direct Prediction
    print("\n2. Testing Direct ML Prediction...")
    direct_prediction_works = test_direct_prediction()
    
    if not direct_prediction_works:
        print("\n❌ Direct prediction failed. Check ML model artifacts.")
        return
    
    # Test 3: Kafka Integration
    print("\n3. Testing Kafka Integration...")
    kafka_works = send_test_data_to_kafka()
    
    if not kafka_works:
        print("\n❌ Kafka integration failed. Make sure Kafka is running:")
        print("   docker-compose up -d")
        return
    
    print("\n4. Waiting for Kafka consumer to process...")
    time.sleep(2)
    
    print("\n✅ All tests completed successfully!")
    print("\n📋 Next steps:")
    print("   1. Open the web client: http://localhost:3000")
    print("   2. Click 'Send Sensor Data' to test the complete flow")
    print("   3. Check ML API logs for processed data")

if __name__ == "__main__":
    main()

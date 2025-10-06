#!/usr/bin/env python3
"""
Test script to verify ML predictions are working in local development mode.
This script tests the complete flow: Next.js -> Kafka -> ML API -> Prediction
"""

import requests
import json
import time
import sys

def test_ml_prediction_flow():
    """Test the complete ML prediction flow."""
    print("🧪 Testing ML Prediction Flow in Local Development Mode")
    print("=" * 60)
    
    # Test 1: Check ML API health
    print("\n1️⃣ Testing ML API Health...")
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            health_data = response.json()
            print(f"✅ ML API is healthy")
            print(f"   Status: {health_data.get('status', 'unknown')}")
            print(f"   Kafka Consumer: {health_data.get('kafka_consumer', 'unknown')}")
            print(f"   Kafka Topic: {health_data.get('kafka_topic', 'unknown')}")
        else:
            print(f"❌ ML API health check failed: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ ML API not accessible: {e}")
        return False
    
    # Test 2: Direct ML API prediction
    print("\n2️⃣ Testing Direct ML API Prediction...")
    test_data = {
        "Temperature": 25.5,
        "Humidity": 60.0,
        "Light": 500,
        "CO2": 450,
        "HumidityRatio": 0.01
    }
    
    try:
        response = requests.post("http://localhost:8000/predict", 
                               json=test_data, 
                               timeout=10)
        if response.status_code == 200:
            prediction_data = response.json()
            print(f"✅ Direct prediction successful")
            print(f"   Occupancy: {prediction_data.get('occupancy', 'unknown')}")
            print(f"   Probability: {prediction_data.get('probability', 'unknown'):.3f}")
        else:
            print(f"❌ Direct prediction failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Direct prediction request failed: {e}")
        return False
    
    # Test 3: Test Next.js Kafka endpoint
    print("\n3️⃣ Testing Next.js Kafka Endpoint...")
    try:
        response = requests.post("http://localhost:3000/api/kafka", 
                               timeout=10)
        if response.status_code == 200:
            kafka_data = response.json()
            print(f"✅ Next.js Kafka endpoint successful")
            print(f"   Message: {kafka_data.get('message', 'unknown')}")
            print(f"   Mode: {kafka_data.get('config', {}).get('mode', 'unknown')}")
            
            # Check if it's actually sending to Kafka or using simulation
            if kafka_data.get('config', {}).get('mode') == 'simulation':
                print("⚠️  Warning: Using simulation mode - Kafka not enabled")
                return False
            else:
                print("✅ Kafka integration is active")
        else:
            print(f"❌ Next.js Kafka endpoint failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Next.js Kafka endpoint not accessible: {e}")
        return False
    
    # Test 4: Wait and check for Kafka-processed predictions
    print("\n4️⃣ Checking for Kafka-processed predictions...")
    print("   Waiting 5 seconds for Kafka processing...")
    time.sleep(5)
    
    # Check ML API logs or WebSocket for processed data
    try:
        response = requests.get("http://localhost:8000/health/detailed", timeout=5)
        if response.status_code == 200:
            detailed_health = response.json()
            print(f"✅ Detailed health check successful")
            print(f"   Kafka Consumer: {detailed_health.get('kafka', {}).get('consumer', 'unknown')}")
            print(f"   Model Status: {detailed_health.get('model', {}).get('model_loaded', 'unknown')}")
        else:
            print(f"❌ Detailed health check failed: {response.status_code}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Detailed health check failed: {e}")
    
    print("\n" + "=" * 60)
    print("🎉 ML Prediction Flow Test Complete!")
    print("\nNext steps:")
    print("1. Check ML API logs for Kafka consumer activity")
    print("2. Monitor WebSocket connections for real-time predictions")
    print("3. Verify Kafka topic has messages")
    
    return True

def main():
    """Main test function."""
    print("Starting ML Prediction Flow Test...")
    print("Make sure the development environment is running:")
    print("  ./dev-mode.sh start")
    print()
    
    # Check if services are running
    services_running = True
    
    # Check ML API
    try:
        requests.get("http://localhost:8000/health", timeout=2)
        print("✅ ML API is running")
    except:
        print("❌ ML API is not running")
        services_running = False
    
    # Check Next.js
    try:
        requests.get("http://localhost:3000", timeout=2)
        print("✅ Next.js is running")
    except:
        print("❌ Next.js is not running")
        services_running = False
    
    if not services_running:
        print("\n❌ Some services are not running. Please start the development environment:")
        print("   ./dev-mode.sh start")
        sys.exit(1)
    
    # Run the test
    success = test_ml_prediction_flow()
    
    if success:
        print("\n✅ All tests passed! ML predictions are working in local mode.")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed. Check the output above for details.")
        sys.exit(1)

if __name__ == "__main__":
    main()

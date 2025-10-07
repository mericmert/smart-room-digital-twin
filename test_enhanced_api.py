#!/usr/bin/env python3
"""
Test script to verify the enhanced prediction API is working correctly.
"""

import requests
import json
from datetime import datetime

def test_enhanced_prediction():
    """Test the enhanced prediction endpoint."""
    
    # Test data
    test_data = {
        "date": datetime.now().isoformat(),
        "Temperature": 23.5,
        "Humidity": 45.2,
        "Light": 500,
        "CO2": 600,
        "HumidityRatio": 0.008
    }
    
    # Test anomaly data
    anomaly_data = {
        "date": datetime.now().isoformat(),
        "Temperature": 50.0,  # Outside normal range
        "Humidity": 45.2,
        "Light": 500,
        "CO2": 600,
        "HumidityRatio": 0.008
    }
    
    ml_api_url = "http://localhost:8000"
    
    print("Testing Enhanced Prediction API...")
    print("=" * 50)
    
    # Test 1: Normal prediction
    print("\n1. Testing normal prediction:")
    try:
        response = requests.post(f"{ml_api_url}/predict-enhanced", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success! Response: {json.dumps(result, indent=2)}")
            
            # Verify required fields
            required_fields = ['features', 'prob', 'occupancy', 'is_anomaly']
            missing_fields = [field for field in required_fields if field not in result]
            if missing_fields:
                print(f"❌ Missing required fields: {missing_fields}")
            else:
                print("✅ All required fields present")
                
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 2: Anomaly detection
    print("\n2. Testing anomaly detection:")
    try:
        response = requests.post(f"{ml_api_url}/predict-enhanced", json=anomaly_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success! Response: {json.dumps(result, indent=2)}")
            
            if result.get('is_anomaly'):
                print("✅ Anomaly correctly detected!")
            else:
                print("⚠️  Anomaly not detected (may be expected)")
                
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 3: Legacy endpoint compatibility
    print("\n3. Testing legacy endpoint:")
    try:
        response = requests.post(f"{ml_api_url}/predict", json=test_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Success! Response: {json.dumps(result, indent=2)}")
            
            # Verify legacy fields
            if 'occupancy' in result and 'probability' in result:
                print("✅ Legacy fields present")
            else:
                print("❌ Missing legacy fields")
                
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Exception: {e}")
    
    # Test 4: Health check
    print("\n4. Testing health check:")
    try:
        response = requests.get(f"{ml_api_url}/health")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Health check: {json.dumps(result, indent=2)}")
        else:
            print(f"❌ Health check failed: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")

if __name__ == "__main__":
    test_enhanced_prediction()

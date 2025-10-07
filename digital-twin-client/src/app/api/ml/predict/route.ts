import { NextRequest, NextResponse } from 'next/server';

const ML_API_BASE_URL = process.env.ML_API_BASE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Use enhanced predict endpoint that includes anomaly detection
    const response = await fetch(`${ML_API_BASE_URL}/predict-enhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ML API error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: 'ML API request failed', 
          details: errorText,
          status: response.status 
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error calling ML API:', error);
    return NextResponse.json(
      { 
        error: 'Failed to call ML API', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

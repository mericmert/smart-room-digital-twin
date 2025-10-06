import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Environment-specific configurations
  env: {
    ML_API_URL: process.env.ML_API_URL || 'http://localhost:8000',
    KAFKA_BROKER_URL: process.env.KAFKA_BROKER_URL || 'localhost:9092',
    KAFKA_TOPIC: process.env.KAFKA_TOPIC || 'docker-occupancy-data',
  },
  
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/ml/:path*',
        destination: `${process.env.ML_API_URL || 'http://localhost:8000'}/:path*`,
      },
    ];
  },
  
  // Headers for CORS
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;

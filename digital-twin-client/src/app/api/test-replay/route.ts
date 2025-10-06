import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
  try {
    const dataDir = path.join(process.cwd(), '..', 'data');
    console.log('Data directory:', dataDir);
    
    // Check if data directory exists
    const dataDirExists = fs.existsSync(dataDir);
    console.log('Data directory exists:', dataDirExists);
    
    if (!dataDirExists) {
      return NextResponse.json({
        success: false,
        error: 'Data directory not found',
        dataDir,
        cwd: process.cwd()
      });
    }
    
    // List files in data directory
    const files = fs.readdirSync(dataDir);
    console.log('Files in data directory:', files);
    
    // Check for specific data files
    const dataFiles = ['datatest.txt', 'datatest2.txt', 'datatraining.txt'];
    const fileStatus = dataFiles.map(filename => {
      const filePath = path.join(dataDir, filename);
      const exists = fs.existsSync(filePath);
      const size = exists ? fs.statSync(filePath).size : 0;
      return { filename, exists, size, path: filePath };
    });
    
    return NextResponse.json({
      success: true,
      dataDir,
      cwd: process.cwd(),
      files,
      dataFiles: fileStatus
    });
  } catch (error) {
    console.error('Test replay API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      dataDir: path.join(process.cwd(), '..', 'data'),
      cwd: process.cwd()
    });
  }
}

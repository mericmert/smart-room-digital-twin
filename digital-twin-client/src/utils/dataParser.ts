export interface SensorDataPoint {
  id: string;
  date: string;
  Temperature: number;
  Humidity: number;
  Light: number;
  CO2: number;
  HumidityRatio: number;
  Occupancy: number;
}

export interface ParsedDataFile {
  filename: string;
  data: SensorDataPoint[];
  totalRecords: number;
  timeRange: {
    start: string;
    end: string;
  };
}

export class DataParser {
  static parseCSVLine(line: string): SensorDataPoint | null {
    try {
      // Remove quotes and split by comma
      const cleanLine = line.replace(/"/g, '');
      const parts = cleanLine.split(',');
      
      if (parts.length < 7) {
        return null;
      }

      return {
        id: parts[0].trim(),
        date: parts[1].trim(),
        Temperature: parseFloat(parts[2]),
        Humidity: parseFloat(parts[3]),
        Light: parseFloat(parts[4]),
        CO2: parseFloat(parts[5]),
        HumidityRatio: parseFloat(parts[6]),
        Occupancy: parseInt(parts[7]) || 0
      };
    } catch (error) {
      console.error('Error parsing CSV line:', error, line);
      return null;
    }
  }

  static async parseDataFile(fileContent: string, filename: string): Promise<ParsedDataFile> {
    const lines = fileContent.split('\n');
    const data: SensorDataPoint[] = [];
    
    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const parsed = this.parseCSVLine(line);
        if (parsed) {
          data.push(parsed);
        }
      }
    }

    const timeRange = this.getTimeRange(data);
    
    return {
      filename,
      data,
      totalRecords: data.length,
      timeRange
    };
  }

  static getTimeRange(data: SensorDataPoint[]): { start: string; end: string } {
    if (data.length === 0) {
      return { start: '', end: '' };
    }

    const dates = data.map(d => new Date(d.date)).filter(d => !isNaN(d.getTime()));
    if (dates.length === 0) {
      return { start: '', end: '' };
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    return {
      start: dates[0].toISOString(),
      end: dates[dates.length - 1].toISOString()
    };
  }

  static filterDataByTimeRange(
    data: SensorDataPoint[], 
    startTime: Date, 
    endTime: Date
  ): SensorDataPoint[] {
    return data.filter(point => {
      const pointTime = new Date(point.date);
      return pointTime >= startTime && pointTime <= endTime;
    });
  }

  static getDataAtTime(data: SensorDataPoint[], targetTime: Date): SensorDataPoint | null {
    // Find the closest data point to the target time
    let closest: SensorDataPoint | null = null;
    let minDiff = Infinity;

    for (const point of data) {
      const pointTime = new Date(point.date);
      const diff = Math.abs(pointTime.getTime() - targetTime.getTime());
      
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }

  static getDataInTimeWindow(
    data: SensorDataPoint[], 
    centerTime: Date, 
    windowMinutes: number
  ): SensorDataPoint[] {
    const halfWindow = windowMinutes * 60 * 1000 / 2; // Convert to milliseconds
    const startTime = new Date(centerTime.getTime() - halfWindow);
    const endTime = new Date(centerTime.getTime() + halfWindow);
    
    return this.filterDataByTimeRange(data, startTime, endTime);
  }

  static formatSensorDataForKafka(dataPoint: SensorDataPoint): any {
    return {
      timestamp: new Date(dataPoint.date).toISOString(),
      Temperature: dataPoint.Temperature,
      Humidity: dataPoint.Humidity,
      Light: dataPoint.Light,
      CO2: dataPoint.CO2,
      HumidityRatio: dataPoint.HumidityRatio,
      // Include original data for reference
      originalData: {
        id: dataPoint.id,
        date: dataPoint.date,
        Occupancy: dataPoint.Occupancy
      }
    };
  }
}

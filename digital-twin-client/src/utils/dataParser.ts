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

import { parseISO, format, isValid } from 'date-fns';

export class DataParser {
  /**
   * Safely parses a date string using date-fns for robust locale-independent parsing
   */
  static parseDate(dateString: string): Date | null {
    try {
      // Try parsing as ISO first (most reliable)
      if (dateString.includes('-') && (dateString.includes('T') || dateString.includes(' '))) {
        const isoString = dateString.includes('T') ? dateString : dateString.replace(' ', 'T');
        const date = parseISO(isoString);
        if (isValid(date)) {
          return date;
        }
      }

      // Fallback to native Date parsing
      const date = new Date(dateString);
      return isValid(date) ? date : null;
    } catch (error) {
      console.error('Error parsing date:', error, dateString);
      return null;
    }
  }

  /**
   * Converts a date to datetime-local input format (YYYY-MM-DDTHH:mm:ss)
   * Includes seconds for more precise time selection
   */
  static toDateTimeLocal(dateString: string): string {
    const date = this.parseDate(dateString);
    if (!date) return '';
    
    return format(date, "yyyy-MM-dd'T'HH:mm:ss");
  }

  static parseCSVLine(line: string): SensorDataPoint | null {
    try {
      // Remove quotes and split by comma
      const cleanLine = line.replace(/"/g, '');
      const parts = cleanLine.split(',');
      
      if (parts.length < 7) {
        return null;
      }

      // Check if this is the anomaly CSV format (date first) or regular format (ID first)
      const isAnomalyFormat = parts[0].includes('-') && parts[0].includes(':'); // Date format check
      
      let dateString: string;
      let id: string;
      let tempIdx: number, humidityIdx: number, lightIdx: number, co2Idx: number, humidityRatioIdx: number, occupancyIdx: number;

      if (isAnomalyFormat) {
        // Anomaly CSV format: date,Temperature,Humidity,Light,CO2,HumidityRatio,Occupancy
        dateString = parts[0].trim();
        id = `anomaly_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; // Generate unique ID
        tempIdx = 1;
        humidityIdx = 2;
        lightIdx = 3;
        co2Idx = 4;
        humidityRatioIdx = 5;
        occupancyIdx = 6;
      } else {
        // Regular format: ID,date,Temperature,Humidity,Light,CO2,HumidityRatio,Occupancy
        id = parts[0].trim();
        dateString = parts[1].trim();
        tempIdx = 2;
        humidityIdx = 3;
        lightIdx = 4;
        co2Idx = 5;
        humidityRatioIdx = 6;
        occupancyIdx = 7;
      }

      // Parse the date and convert to ISO format for consistency
      const parsedDate = this.parseDate(dateString);
      const isoDate = parsedDate ? parsedDate.toISOString() : dateString;

      return {
        id,
        date: isoDate, // Date in ISO format
        Temperature: parseFloat(parts[tempIdx]),
        Humidity: parseFloat(parts[humidityIdx]),
        Light: parseFloat(parts[lightIdx]),
        CO2: parseFloat(parts[co2Idx]),
        HumidityRatio: parseFloat(parts[humidityRatioIdx]),
        Occupancy: parseFloat(parts[occupancyIdx]) || 0
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

    const dates = data.map(d => this.parseDate(d.date)).filter(d => d !== null) as Date[];
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
      const pointTime = this.parseDate(point.date);
      if (!pointTime) return false;
      return pointTime >= startTime && pointTime <= endTime;
    });
  }

  static getDataAtTime(data: SensorDataPoint[], targetTime: Date): SensorDataPoint | null {
    // Find the closest data point to the target time
    let closest: SensorDataPoint | null = null;
    let minDiff = Infinity;

    for (const point of data) {
      const pointTime = this.parseDate(point.date);
      if (!pointTime) continue;
      
      const diff = Math.abs(pointTime.getTime() - targetTime.getTime());
      
      if (diff < minDiff) {
        minDiff = diff;
        closest = point;
      }
    }

    return closest;
  }


  static formatSensorDataForKafka(dataPoint: SensorDataPoint): any {
    const parsedDate = this.parseDate(dataPoint.date);
    return {
      timestamp: parsedDate ? parsedDate.toISOString() : new Date().toISOString(),
      Temperature: dataPoint.Temperature,
      Humidity: dataPoint.Humidity,
      Light: dataPoint.Light,
      CO2: dataPoint.CO2,
      HumidityRatio: dataPoint.HumidityRatio,
      actualOccupancy: dataPoint.Occupancy, // Include actual occupancy in main message
      // Include original data for reference
      originalData: {
        id: dataPoint.id,
        date: dataPoint.date,
        Occupancy: dataPoint.Occupancy
      }
    };
  }
}

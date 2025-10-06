import { DataParser, SensorDataPoint } from '../dataParser';


describe('DataParser', () => {
  const sampleCSVLine = '"1","2015-02-04 17:51:00",23.18,27.272,426,721.25,0.00479298817650529,1';
  const sampleData = [
    {
      id: '1',
      date: '2015-02-04 17:51:00',
      Temperature: 23.18,
      Humidity: 27.272,
      Light: 426,
      CO2: 721.25,
      HumidityRatio: 0.00479298817650529,
      Occupancy: 1
    },
    {
      id: '2',
      date: '2015-02-04 17:52:00',
      Temperature: 23.15,
      Humidity: 27.2675,
      Light: 429.5,
      CO2: 714,
      HumidityRatio: 0.00478344094931065,
      Occupancy: 1
    }
  ];

  describe('parseCSVLine', () => {
    it('should parse a valid CSV line correctly', () => {
      const result = DataParser.parseCSVLine(sampleCSVLine);
      expect(result).toEqual({
        id: '1',
        date: '2015-02-04 17:51:00',
        Temperature: 23.18,
        Humidity: 27.272,
        Light: 426,
        CO2: 721.25,
        HumidityRatio: 0.00479298817650529,
        Occupancy: 1
      });
    });

    it('should return null for invalid CSV line', () => {
      const result = DataParser.parseCSVLine('invalid,line');
      expect(result).toBeNull();
    });
  });

  describe('getTimeRange', () => {
    it('should return correct time range for data', () => {
      const result = DataParser.getTimeRange(sampleData);
      expect(result.start).toBe('2015-02-04T17:51:00.000Z');
      expect(result.end).toBe('2015-02-04T17:52:00.000Z');
    });

    it('should return empty range for empty data', () => {
      const result = DataParser.getTimeRange([]);
      expect(result).toEqual({ start: '', end: '' });
    });
  });

  describe('getDataAtTime', () => {
    it('should return closest data point to target time', () => {
      const targetTime = new Date('2015-02-04T17:51:30.000Z');
      const result = DataParser.getDataAtTime(sampleData, targetTime);
      expect(result).toEqual(sampleData[0]);
    });

    it('should return null if no data available', () => {
      const targetTime = new Date('2015-02-04T18:00:00.000Z');
      const result = DataParser.getDataAtTime(sampleData, targetTime);
      expect(result).toBeNull();
    });
  });

  describe('formatSensorDataForKafka', () => {
    it('should format data correctly for Kafka', () => {
      const result = DataParser.formatSensorDataForKafka(sampleData[0]);
      expect(result).toEqual({
        timestamp: '2015-02-04T17:51:00.000Z',
        Temperature: 23.18,
        Humidity: 27.272,
        Light: 426,
        CO2: 721.25,
        HumidityRatio: 0.00479298817650529,
        originalData: {
          id: '1',
          date: '2015-02-04 17:51:00',
          Occupancy: 1
        }
      });
    });
  });

});

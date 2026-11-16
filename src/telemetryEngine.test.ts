import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveDynamicAlerts,
  deriveRiverSensorFromDischarge,
  deriveReservoirsFromRain,
  type CapitalWeather,
  type MarineBuoyData
} from './telemetryEngine.ts';

test('deriveDynamicAlerts emits 0 emergency alerts when weather and waves are calm in autumn/winter', () => {
  const calmCapitals: Record<string, CapitalWeather> = {
    bilbao: {
      name: 'Bilbao', basqueName: 'Bilbo', province: 'BIZKAIA', lat: 43.263, lon: -2.935,
      temp: 13.5, apparentTemp: 12.8, humidity: 78, windSpeed: 14.0, windGusts: 22.0,
      windDirection: 280, precipitation: 0.2, isDay: true, weatherCode: 2,
      sunrise: '07:55', sunset: '17:42', fwi: 4.2, fwiCategory: 'Bajo / Baxua', loading: false
    },
    donostia: {
      name: 'San Sebastián', basqueName: 'Donostia', province: 'GIPUZKOA', lat: 43.318, lon: -1.981,
      temp: 13.0, apparentTemp: 12.2, humidity: 80, windSpeed: 12.5, windGusts: 19.0,
      windDirection: 300, precipitation: 0.0, isDay: true, weatherCode: 1,
      sunrise: '07:51', sunset: '17:38', fwi: 3.8, fwiCategory: 'Bajo / Baxua', loading: false
    },
    vitoria: {
      name: 'Vitoria-Gasteiz', basqueName: 'Gasteiz', province: 'ARABA', lat: 42.846, lon: -2.671,
      temp: 8.4, apparentTemp: 7.1, humidity: 82, windSpeed: 11.0, windGusts: 18.0,
      windDirection: 15, precipitation: 0.0, isDay: true, weatherCode: 3,
      sunrise: '07:54', sunset: '17:43', fwi: 2.1, fwiCategory: 'Bajo / Baxua', loading: false
    }
  };

  const calmBuoys: Record<string, MarineBuoyData> = {
    matxitxako: { id: 'matxitxako', name: 'Boya Cabo Matxitxako', province: 'BIZKAIA', waveHeight: 1.3, wavePeriod: 9.2, waveDirection: 315 },
    pasaia: { id: 'pasaia', name: 'Boya Pasaia / Donostia', province: 'GIPUZKOA', waveHeight: 1.1, wavePeriod: 8.8, waveDirection: 310 }
  };

  const rivers = [
    deriveRiverSensorFromDischarge('nervion', 'Nervión (Ibaizabal)', 'BIZKAIA', 14.2, 3.5),
    deriveRiverSensorFromDischarge('zadorra', 'Zadorra', 'ARABA', 16.0, 2.5)
  ];

  const alerts = deriveDynamicAlerts(calmCapitals, calmBuoys, rivers);
  assert.equal(alerts.length, 0, 'Calm autumn weather should not produce fake Galerna or Heat alerts');
});

test('deriveDynamicAlerts detects real coastal wave alert, strong wind gusts, and frost/snow conditions', () => {
  const stormyCapitals: Record<string, CapitalWeather> = {
    bilbao: {
      name: 'Bilbao', basqueName: 'Bilbo', province: 'BIZKAIA', lat: 43.263, lon: -2.935,
      temp: 11.0, apparentTemp: 8.5, humidity: 88, windSpeed: 54.0, windGusts: 78.0,
      windDirection: 310, precipitation: 6.4, isDay: true, weatherCode: 81,
      sunrise: '07:55', sunset: '17:42', fwi: 1.0, fwiCategory: 'Bajo / Baxua', loading: false
    },
    donostia: {
      name: 'San Sebastián', basqueName: 'Donostia', province: 'GIPUZKOA', lat: 43.318, lon: -1.981,
      temp: 10.5, apparentTemp: 8.0, humidity: 90, windSpeed: 38.0, windGusts: 55.0,
      windDirection: 300, precipitation: 4.5, isDay: true, weatherCode: 63,
      sunrise: '07:51', sunset: '17:38', fwi: 1.0, fwiCategory: 'Bajo / Baxua', loading: false
    },
    vitoria: {
      name: 'Vitoria-Gasteiz', basqueName: 'Gasteiz', province: 'ARABA', lat: 42.846, lon: -2.671,
      temp: 0.4, apparentTemp: -2.5, humidity: 92, windSpeed: 22.0, windGusts: 35.0,
      windDirection: 10, precipitation: 1.8, isDay: true, weatherCode: 71,
      sunrise: '07:54', sunset: '17:43', fwi: 0.5, fwiCategory: 'Bajo / Baxua', loading: false
    }
  };

  const roughBuoys: Record<string, MarineBuoyData> = {
    matxitxako: { id: 'matxitxako', name: 'Boya Cabo Matxitxako', province: 'BIZKAIA', waveHeight: 4.6, wavePeriod: 13.5, waveDirection: 315 },
    pasaia: { id: 'pasaia', name: 'Boya Pasaia / Donostia', province: 'GIPUZKOA', waveHeight: 3.2, wavePeriod: 12.0, waveDirection: 310 }
  };

  const rivers = [
    deriveRiverSensorFromDischarge('zadorra', 'Zadorra', 'ARABA', 68.0, 2.5)
  ];

  const alerts = deriveDynamicAlerts(stormyCapitals, roughBuoys, rivers);
  assert.ok(alerts.length >= 3, 'Should generate dynamic alerts for wind/waves/snow/river');
  assert.ok(alerts.some(a => a.province === 'BIZKAIA' && a.level === 'orange'));
  assert.ok(alerts.some(a => a.province === 'ARABA' && (a.type.includes('Nieve') || a.type.includes('Helada') || a.type.includes('Hidrológico'))));
});

test('deriveReservoirsFromRain computes dynamic reservoir levels from real humidity and precipitation', () => {
  const reservoirs = deriveReservoirsFromRain(3.5, 76);
  assert.equal(reservoirs.length, 3);
  assert.ok(reservoirs[0].percentage > 50 && reservoirs[0].percentage <= 100);
});

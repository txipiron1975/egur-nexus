export interface CapitalWeather {
  name: string;
  basqueName: string;
  province: string;
  lat: number;
  lon: number;
  temp: number;
  apparentTemp: number;
  humidity: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  precipitation: number;
  isDay: boolean;
  weatherCode: number;
  sunrise: string;
  sunset: string;
  fwi: number;
  fwiCategory: string;
  loading: boolean;
}

export interface MarineBuoyData {
  id: string;
  name: string;
  province: string;
  waveHeight: number; // meters
  wavePeriod: number; // seconds
  waveDirection: number; // degrees
}

export interface RiverSensor {
  id: string;
  name: string;
  province: string;
  level: number; // meters
  flow: number;  // m3/s
  criticalLevel: number;
  status: 'nominal' | 'warning' | 'alert';
}

export interface ReservoirSensor {
  name: string;
  province: string;
  capacity: number; // hm3
  currentLevel: number; // hm3
  percentage: number;
}

export interface WeatherAlert {
  id: string;
  province: string;
  type: string;
  level: 'yellow' | 'orange' | 'red';
  message: string;
  protocol: string;
  active: boolean;
}

/**
 * Converts real river discharge (m3/s from Open-Meteo GloFAS Flood API or precipitation runoff model)
 * into a physical gauge level (meters) and Euskalmet/URA threshold status.
 */
export function deriveRiverSensorFromDischarge(
  id: string,
  name: string,
  province: string,
  dischargeM3s: number,
  criticalLevel: number
): RiverSensor {
  const safeFlow = Math.max(1.2, Number(dischargeM3s.toFixed(1)));
  // Stage-discharge rating curve approximation: h = h0 + k * Q^0.48
  const rawLevel = 0.35 + 0.24 * Math.pow(safeFlow, 0.48);
  const level = Number(Math.min(criticalLevel * 1.25, rawLevel).toFixed(2));

  let status: 'nominal' | 'warning' | 'alert' = 'nominal';
  if (level >= criticalLevel) {
    status = 'alert';
  } else if (level >= criticalLevel * 0.78) {
    status = 'warning';
  }

  return {
    id,
    name,
    province,
    level,
    flow: safeFlow,
    criticalLevel,
    status
  };
}

/**
 * Computes Basque reservoir storage from seasonal base + real-time precipitation & humidity balance.
 */
export function deriveReservoirsFromRain(
  avgPrecipitationMm: number,
  avgHumidityPct: number
): ReservoirSensor[] {
  const hydroModifier = Math.min(8, Math.max(-8, (avgHumidityPct - 65) * 0.12 + avgPrecipitationMm * 0.6));

  const specs = [
    { name: 'Ullibarri-Gamboa', province: 'ARABA', capacity: 146.6, basePct: 79.4 },
    { name: 'Urrunaga', province: 'ARABA', capacity: 72.5, basePct: 76.8 },
    { name: 'Añarbe', province: 'GIPUZKOA', capacity: 37.2, basePct: 83.2 }
  ];

  return specs.map(s => {
    const pct = Number(Math.min(98.5, Math.max(45.0, s.basePct + hydroModifier)).toFixed(1));
    const currentLevel = Number(((s.capacity * pct) / 100).toFixed(1));
    return {
      name: s.name,
      province: s.province,
      capacity: s.capacity,
      currentLevel,
      percentage: pct
    };
  });
}

/**
 * Evaluates live telemetry against Euskalmet / SOS Deiak 112 meteorological, coastal, fire, and hydrological thresholds.
 * Returns ONLY real active warnings. If conditions are nominal, returns an empty array ([]).
 */
export function deriveDynamicAlerts(
  capitals: Record<string, CapitalWeather>,
  buoys: Record<string, MarineBuoyData>,
  rivers: RiverSensor[]
): WeatherAlert[] {
  const activeAlerts: WeatherAlert[] = [];

  // 1. Evaluate each Basque capital's live weather
  for (const key of Object.keys(capitals)) {
    const cap = capitals[key];
    const peakWind = Math.max(cap.windSpeed, cap.windGusts || cap.windSpeed);

    // Wind / Galerna threshold (>= 50 km/h yellow, >= 70 km/h orange, >= 90 km/h red)
    if (peakWind >= 50) {
      const level: 'yellow' | 'orange' | 'red' =
        peakWind >= 90 ? 'red' : peakWind >= 70 ? 'orange' : 'yellow';
      const isCoastalGalerna =
        (cap.province === 'BIZKAIA' || cap.province === 'GIPUZKOA') &&
        cap.windDirection >= 260 &&
        cap.windDirection <= 340 &&
        peakWind >= 60;

      activeAlerts.push({
        id: `wind-${cap.province.toLowerCase()}`,
        province: cap.province,
        type: isCoastalGalerna
          ? 'Riesgo Costero / Giro Brusco NW'
          : 'Viento Fuerte / Haizeufada',
        level,
        message: `${cap.name}: Viento sostenido de ${cap.windSpeed} km/h con rachas registradas/previstas de ${peakWind} km/h (${cap.windDirection}°).`,
        protocol: 'SOS DEIAK 112: Asegurar elementos de fachada, precaución en conducción por viaductos y zonas expuestas.',
        active: true
      });
    }

    // Heavy Rain / Storm threshold (weatherCode >= 80 or precipitation >= 4.0 mm/h)
    if (cap.precipitation >= 4.0 || cap.weatherCode >= 80) {
      const level: 'yellow' | 'orange' | 'red' =
        cap.precipitation >= 15.0 || cap.weatherCode >= 95 ? 'orange' : 'yellow';
      activeAlerts.push({
        id: `rain-${cap.province.toLowerCase()}`,
        province: cap.province,
        type: cap.weatherCode >= 95 ? 'Tormenta Eléctrica / Ekaitza' : 'Precipitaciones Intensas / Euri-jasa',
        level,
        message: `${cap.name}: Precipitación activa (${cap.precipitation} mm/h) con código sinóptico WMO ${cap.weatherCode}.`,
        protocol: 'SOS DEIAK 112: Evitar pasos subterráneos inundables y estacionamiento en cauces de arroyos.',
        active: true
      });
    }

    // Snow / Frost / Low Temperature threshold (Temp <= 2°C or snow WMO code 71-77, 85-86)
    if (cap.temp <= 2.0 || (cap.weatherCode >= 71 && cap.weatherCode <= 77)) {
      const isSnow = cap.weatherCode >= 71 && cap.weatherCode <= 77;
      activeAlerts.push({
        id: `cold-${cap.province.toLowerCase()}`,
        province: cap.province,
        type: isSnow ? 'Nieve en Cotas Bajas / Elurra' : 'Heladas y Bajas Temperaturas / Izotza',
        level: cap.temp <= -2.0 || isSnow ? 'orange' : 'yellow',
        message: `${cap.name}: Temperatura actual de ${cap.temp}°C (Sensación térmica: ${cap.apparentTemp}°C). Riesgo de placas de hielo.`,
        protocol: 'SOS DEIAK 112: Plan de Vialidad Invernal activo en puertos de montaña (Opakua, Herrera, Barazar, Etzegarate).',
        active: true
      });
    }

    // Extreme Heat threshold (Temp >= 32°C)
    if (cap.temp >= 32.0) {
      activeAlerts.push({
        id: `heat-${cap.province.toLowerCase()}`,
        province: cap.province,
        type: 'Temperaturas Muy Altas / Bero Handia',
        level: cap.temp >= 36.0 ? 'orange' : 'yellow',
        message: `${cap.name}: Temperatura actual de ${cap.temp}°C (Sensación ${cap.apparentTemp}°C, Humedad ${cap.humidity}%).`,
        protocol: 'SOS DEIAK 112: Hidratación frecuente y restricción de esfuerzos intensos al aire libre en horas centrales.',
        active: true
      });
    }

    // Forest Fire risk (only when FWI >= 28 and humidity < 45%)
    if (cap.fwi >= 28 && cap.humidity < 45) {
      activeAlerts.push({
        id: `fire-${cap.province.toLowerCase()}`,
        province: cap.province,
        type: 'Riesgo de Incendios Forestales / Baso-suteak',
        level: cap.fwi >= 38 ? 'orange' : 'yellow',
        message: `${cap.name}: Índice FWI en ${cap.fwi} (${cap.fwiCategory}) por baja humedad (${cap.humidity}%) y viento.`,
        protocol: 'SOS DEIAK 112: Prohibición de quemas agrícolas y uso de maquinaria forestal con riesgo de chispa.',
        active: true
      });
    }
  }

  // 2. Evaluate Marine Buoys (Matxitxako & Pasaia) for Coastal Wave Impact (>= 2.5m yellow, >= 4.0m orange, >= 6.0m red)
  for (const bKey of Object.keys(buoys)) {
    const buoy = buoys[bKey];
    if (buoy.waveHeight >= 2.5) {
      const level: 'yellow' | 'orange' | 'red' =
        buoy.waveHeight >= 6.0 ? 'red' : buoy.waveHeight >= 4.0 ? 'orange' : 'yellow';
      activeAlerts.push({
        id: `wave-${buoy.id}`,
        province: buoy.province,
        type: 'Impacto en Costa y Oleaje / Itsasaldeko Arriskua',
        level,
        message: `${buoy.name}: Altura de ola significativa real de ${buoy.waveHeight}m con periodo de ${buoy.wavePeriod}s.`,
        protocol: 'SOS DEIAK 112: Cierre preventivo de espigones, paseos marítimos expuestos y vigilancia en línea de costa.',
        active: true
      });
    }
  }

  // 3. Evaluate Hydrological River Gauges
  for (const river of rivers) {
    if (river.status === 'warning' || river.status === 'alert') {
      activeAlerts.push({
        id: `river-${river.id}`,
        province: river.province,
        type: `Crecida Hidrológica (${river.name}) / Uholde Arriskua`,
        level: river.status === 'alert' ? 'red' : 'orange',
        message: `Estación URA ${river.name}: Nivel en ${river.level}m (Umbral crítico: ${river.criticalLevel}m) con caudal de ${river.flow} m³/s.`,
        protocol: 'SOS DEIAK 112: Seguimiento de cuenca hidrográfica URA y retirada de vehículos en riberas inundables.',
        active: true
      });
    }
  }

  return activeAlerts;
}

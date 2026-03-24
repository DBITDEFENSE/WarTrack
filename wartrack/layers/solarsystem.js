// ============================================
// SOLAR SYSTEM LAYER — Flyable planets with orbital paths
// ============================================

import { PLANETS, computePlanetPosition, generatePlanetIcon } from '../data/planets.js';

let dataSource = null;
let visible = false;
let planetEntities = new Map();

// Icon sizes based on planet importance
function getPlanetIconSize(planet) {
  if (planet.isSun) return 72;
  if (planet.name === 'Jupiter') return 64;
  if (planet.name === 'Saturn') return 68; // wider for rings
  if (planet.isMoon) return 48;
  if (planet.name === 'Mars' || planet.name === 'Venus') return 48;
  return 44;
}

// ============================================
// INIT
// ============================================
export function initSolarSystem(viewer) {
  dataSource = new Cesium.CustomDataSource('solarsystem');
  viewer.dataSources.add(dataSource);

  const now = new Date();

  for (const planet of PLANETS) {
    const pos = computePlanetPosition(planet, now);
    if (!pos) continue;

    const iconSize = getPlanetIconSize(planet);
    const icon = generatePlanetIcon(planet, iconSize * 2); // 2x for crisp rendering

    const entity = dataSource.entities.add({
      id: `planet-${planet.name}`,
      position: pos,
      billboard: {
        image: icon,
        width: iconSize,
        height: iconSize,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1e7, 2.5, 1e12, 0.3),
      },
      label: {
        text: planet.name.toUpperCase(),
        font: '12px Share Tech Mono',
        fillColor: Cesium.Color.fromCssColorString(planet.color),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -(iconSize / 2 + 10)),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1e7, 1, 1e12, 0.3),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      }
    });

    entity.entityType = 'planet';
    entity.planetData = planet;
    planetEntities.set(planet.name, entity);
  }

  // Start hidden by default
  dataSource.show = false;
}

// ============================================
// FLY TO PLANET
// ============================================
export function flyToPlanet(viewer, planetName) {
  const entity = planetEntities.get(planetName);
  if (!entity) return;

  const pos = entity.position.getValue(Cesium.JulianDate.now());
  if (!pos) return;

  // CesiumJS flyTo doesn't work at planetary distances, use setView
  viewer.camera.setView({ destination: pos });
  viewer.scene.requestRender();
}

// ============================================
// FLY BACK TO EARTH
// ============================================
export function flyToEarth(viewer) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(30, 30, 18000000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90),
      roll: 0,
    },
  });
  viewer.scene.requestRender();
}

// ============================================
// VISIBILITY
// ============================================
export function setSolarSystemVisible(v) {
  visible = v;
  dataSource.show = v;
}

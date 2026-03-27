/**
 * @module solarsystem
 * @description Solar system layer — renders the Sun, planets, and the Moon as flyable
 * billboard entities on the Cesium globe. Positions are computed from orbital data.
 * Hidden by default; toggled via the layer panel.
 */

// ============================================
// SOLAR SYSTEM LAYER — Flyable planets with orbital paths
// ============================================

import { PLANETS, computePlanetPosition, generatePlanetIcon } from '../data/planets.js';

/** @type {Cesium.CustomDataSource|null} */
let dataSource = null;
/** @type {boolean} Whether the solar system layer is toggled visible */
let visible = false;
/** @type {Map<string, Cesium.Entity>} Map of planet name to Cesium entity */
let planetEntities = new Map();

/**
 * Determine the billboard icon size in pixels based on planet type and importance.
 * @param {Object} planet - Planet data object from PLANETS array
 * @returns {number} Icon size in pixels
 */
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
/**
 * Initialize the solar system layer. Creates the data source and adds a billboard
 * entity for each planet/body at its computed position. Starts hidden.
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 */
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
/**
 * Fly the camera to a specific planet by name using setView (flyTo fails at planetary distances).
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 * @param {string} planetName - Name of the planet to fly to (must match a PLANETS entry)
 */
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
/**
 * Fly the camera back to Earth at a default overview altitude (18,000 km).
 * @param {Cesium.Viewer} viewer - The CesiumJS viewer instance
 */
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
/**
 * Toggle visibility of the solar system layer.
 * @param {boolean} v - Whether the layer should be visible
 */
export function setSolarSystemVisible(v) {
  visible = v;
  dataSource.show = v;
}

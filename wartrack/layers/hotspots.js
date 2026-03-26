// ============================================
// HOTSPOTS LAYER — Conflict Zone Visualization
// Static ellipses + animated billboard for pulse effect (perf-friendly)
// ============================================

let dataSource = null;
let hotspotIconScale = 1.0;

// Listen for icon resize events
window.addEventListener('wartrack-icon-resize', (e) => {
  if (e.detail.layer !== 'hotspots' || !dataSource) return;
  hotspotIconScale = e.detail.scale;
  for (const entity of dataSource.entities.values) {
    if (entity.billboard) {
      entity.billboard.width = 48 * hotspotIconScale;
      entity.billboard.height = 48 * hotspotIconScale;
    }
  }
  window.viewer?.scene?.requestRender();
});

const hotspots = [
  { name: "Ukraine Front", lat: 48.5, lon: 31.2, severity: "high", summary: "Active conflict, eastern front", searchQuery: "Ukraine war Russia" },
  { name: "Taiwan Strait", lat: 23.5, lon: 120.0, severity: "elevated", summary: "PLA naval exercises ongoing", searchQuery: "Taiwan China PLA military" },
  { name: "Red Sea / Houthi Zone", lat: 15.0, lon: 42.5, severity: "high", summary: "Houthi drone/missile activity", searchQuery: "Houthi Red Sea shipping" },
  { name: "Strait of Hormuz", lat: 26.5, lon: 56.3, severity: "elevated", summary: "Iranian naval presence", searchQuery: "Iran Hormuz naval" },
  { name: "Gaza Strip", lat: 31.4, lon: 34.4, severity: "high", summary: "Active conflict zone", searchQuery: "Gaza Israel conflict" },
  { name: "South China Sea", lat: 12.0, lon: 114.0, severity: "elevated", summary: "Territorial disputes, PLAN activity", searchQuery: "South China Sea dispute navy" },
  { name: "North Korea DMZ", lat: 38.3, lon: 127.0, severity: "watch", summary: "Monitoring zone", searchQuery: "North Korea DPRK missile" }
];

const SEVERITY_COLORS = {
  high: '#ff3344',
  elevated: '#ffaa00',
  watch: '#ffdd44'
};

// Create a pulsing ring sprite with CSS animation baked into an animated SVG
function createPulseDot(severity) {
  const color = SEVERITY_COLORS[severity] || '#ffdd44';
  // SVG with SMIL animation for pulse — renders on GPU, no JS callback needed
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <!-- Outer pulse ring 1 -->
      <circle cx="32" cy="32" r="8" fill="none" stroke="${color}" stroke-width="1.5" opacity="0">
        <animate attributeName="r" from="8" to="28" dur="2.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.7" to="0" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <!-- Outer pulse ring 2 (offset) -->
      <circle cx="32" cy="32" r="8" fill="none" stroke="${color}" stroke-width="1" opacity="0">
        <animate attributeName="r" from="8" to="28" dur="2.5s" begin="0.8s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.5" to="0" dur="2.5s" begin="0.8s" repeatCount="indefinite"/>
      </circle>
      <!-- Outer pulse ring 3 (offset) -->
      <circle cx="32" cy="32" r="8" fill="none" stroke="${color}" stroke-width="0.8" opacity="0">
        <animate attributeName="r" from="8" to="28" dur="2.5s" begin="1.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" begin="1.6s" repeatCount="indefinite"/>
      </circle>
      <!-- Center glow -->
      <circle cx="32" cy="32" r="7" fill="${color}" opacity="0.2"/>
      <!-- Center dot -->
      <circle cx="32" cy="32" r="4" fill="${color}" opacity="0.9">
        <animate attributeName="opacity" from="0.9" to="0.5" dur="1.5s" repeatCount="indefinite" values="0.9;0.5;0.9"/>
      </circle>
    </svg>
  `)}`;
}

// Also add a static zone ring via ellipse for geographic scale
const ZONE_RADIUS = {
  high: 150000,
  elevated: 200000,
  watch: 120000
};

// ============================================
// INIT
// ============================================
export function initHotspots(viewer) {
  dataSource = new Cesium.CustomDataSource('hotspots');
  viewer.dataSources.add(dataSource);

  for (const hs of hotspots) {
    const color = SEVERITY_COLORS[hs.severity] || '#ffdd44';
    const pos = Cesium.Cartesian3.fromDegrees(hs.lon, hs.lat);
    const cesiumColor = Cesium.Color.fromCssColorString(color);

    // Animated pulse billboard
    const dot = dataSource.entities.add({
      id: `hotspot-${hs.name}`,
      position: pos,
      billboard: {
        image: createPulseDot(hs.severity),
        width: 48,
        height: 48,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 2.0, 2e7, 0.6),
      },
      label: {
        text: hs.name.toUpperCase(),
        font: '12px Share Tech Mono',
        fillColor: cesiumColor,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -30),
        disableDepthTestDistance: 0,
        scaleByDistance: new Cesium.NearFarScalar(1e5, 1, 2e7, 0.4),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('rgba(0,0,0,0.7)')
      },
      // Static zone outline ellipse
      ellipse: {
        semiMinorAxis: ZONE_RADIUS[hs.severity] || 150000,
        semiMajorAxis: ZONE_RADIUS[hs.severity] || 150000,
        material: cesiumColor.withAlpha(0.06),
        outline: true,
        outlineColor: cesiumColor.withAlpha(0.25),
        outlineWidth: 1,
        height: 0,
      }
    });
    dot.hotspotData = hs;
    dot.entityType = 'hotspot';
  }
}

// ============================================
// VISIBILITY
// ============================================
export function setHotspotsVisible(v) {
  dataSource.show = v;
}

export function getHotspots() {
  return hotspots;
}

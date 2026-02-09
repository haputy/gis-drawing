'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';

const GEOSERVER_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL || 'https://dev-geoserver.zartico.com/geoserver';
const POI_ZOOM_THRESHOLD = 13;

interface Polygon {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: Record<string, unknown>;
}

interface FeatureCollection {
  type: 'FeatureCollection';
  features: Polygon[];
}

interface MapProps {
  onPolygonCreated: (geometry: Polygon['geometry']) => void;
  onPolygonSelected: (polygon: Polygon | null) => void;
  polygons: FeatureCollection | null;
}

export default function Map({ onPolygonCreated, onPolygonSelected, polygons }: MapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const draw = useRef<MapboxDraw | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPoiLabels, setShowPoiLabels] = useState(false);
  const [showPoiLayer, setShowPoiLayer] = useState(true);
  const [poiCount, setPoiCount] = useState(0);
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false);

  const loadedBounds = useRef<Set<string>>(new Set());
  const loadedPoiFeatures = useRef<any[]>([]);

  const defaultCenter = useMemo(() =>
    process.env.NEXT_PUBLIC_DEFAULT_CENTER
      ? JSON.parse(process.env.NEXT_PUBLIC_DEFAULT_CENTER)
      : [-122.4, 37.8],
    []
  );
  const defaultZoom = useMemo(() =>
    process.env.NEXT_PUBLIC_DEFAULT_ZOOM
      ? parseFloat(process.env.NEXT_PUBLIC_DEFAULT_ZOOM)
      : 12,
    []
  );

  const getBoundsKey = useCallback((bounds: mapboxgl.LngLatBounds): string => {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    return `${sw.lng.toFixed(3)},${sw.lat.toFixed(3)},${ne.lng.toFixed(3)},${ne.lat.toFixed(3)}`;
  }, []);

  const loadPOIsFromWFS = useCallback(async (bounds: mapboxgl.LngLatBounds) => {
    const boundsKey = getBoundsKey(bounds);
    if (loadedBounds.current.has(boundsKey)) return;

    setIsLoadingPOIs(true);

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // WFS 1.1.0 with EPSG:4326 uses lat,lng order for bbox
    const wfsUrl = `${GEOSERVER_URL}/zartographer/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=zartographer:gis_master&outputFormat=json&srsName=EPSG:4326&bbox=${sw.lat},${sw.lng},${ne.lat},${ne.lng}&maxFeatures=1000`;

    try {
      const response = await fetch(wfsUrl);
      if (!response.ok) throw new Error(`WFS request failed: ${response.status}`);

      const data = await response.json();

      if (data.features && data.features.length > 0) {
        const existingIds = new Set(loadedPoiFeatures.current.map((f: any) => f.properties?.id || f.id));
        const newFeatures = data.features.filter((f: any) =>
          !existingIds.has(f.properties?.id || f.id)
        );
        loadedPoiFeatures.current = [...loadedPoiFeatures.current, ...newFeatures];
        loadedBounds.current.add(boundsKey);

        const source = map.current?.getSource('poi-source') as mapboxgl.GeoJSONSource;
        if (source) {
          source.setData({
            type: 'FeatureCollection',
            features: loadedPoiFeatures.current,
          });
        }
        setPoiCount(loadedPoiFeatures.current.length);
      } else {
        loadedBounds.current.add(boundsKey);
      }
    } catch (error) {
      console.error('Error loading POIs from WFS:', error);
    } finally {
      setIsLoadingPOIs(false);
    }
  }, [getBoundsKey]);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: defaultCenter,
      zoom: defaultZoom,
    });

    draw.current = new MapboxDraw({
      displayControlsDefault: false,
      controls: {},
      defaultMode: 'simple_select',
    });

    map.current.addControl(draw.current);
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('draw.create', (e: { features: GeoJSON.Feature[] }) => {
      const feature = e.features[0];
      if (feature.geometry.type === 'Polygon') {
        onPolygonCreated(feature.geometry as Polygon['geometry']);
        draw.current?.deleteAll();
        setIsDrawing(false);
      }
    });

    map.current.on('load', () => {
      const ZOOM_THRESHOLD = 14;

      // --- User-drawn polygon layers ---
      map.current!.addSource('polygons', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.current!.addSource('centroids', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // --- GeoServer POI layers ---
      map.current!.addSource('poi-source', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // POI fill (polygons)
      map.current!.addLayer({
        id: 'poi-fill-layer',
        type: 'fill',
        source: 'poi-source',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'fill-color': '#088',
          'fill-opacity': 0.6,
        },
      });

      // POI outline (polygons)
      map.current!.addLayer({
        id: 'poi-outline-layer',
        type: 'line',
        source: 'poi-source',
        filter: ['==', ['geometry-type'], 'Polygon'],
        paint: {
          'line-color': '#000',
          'line-width': 1,
        },
      });

      // POI points
      map.current!.addLayer({
        id: 'poi-point-layer',
        type: 'circle',
        source: 'poi-source',
        filter: ['==', ['geometry-type'], 'Point'],
        paint: {
          'circle-radius': 6,
          'circle-color': '#088',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      // POI labels
      map.current!.addLayer({
        id: 'poi-labels-layer',
        type: 'symbol',
        source: 'poi-source',
        layout: {
          'text-field': ['get', 'f_name'],
          'text-size': 12,
          'text-offset': [0, 1.5],
          'visibility': 'none',
        },
        paint: {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 2,
        },
      });

      // --- User-drawn polygon layers (on top of POIs) ---
      map.current!.addLayer({
        id: 'polygons-fill',
        type: 'fill',
        source: 'polygons',
        minzoom: ZOOM_THRESHOLD,
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.3,
        },
      });

      map.current!.addLayer({
        id: 'polygons-outline',
        type: 'line',
        source: 'polygons',
        minzoom: ZOOM_THRESHOLD,
        paint: {
          'line-color': '#1d4ed8',
          'line-width': 2,
        },
      });

      map.current!.addLayer({
        id: 'polygons-points',
        type: 'circle',
        source: 'centroids',
        maxzoom: ZOOM_THRESHOLD,
        paint: {
          'circle-radius': 6,
          'circle-color': '#3b82f6',
          'circle-stroke-color': '#1d4ed8',
          'circle-stroke-width': 2,
        },
      });

      // --- Click handlers for user-drawn polygons ---
      const clickableLayers = ['polygons-fill', 'polygons-points'];

      clickableLayers.forEach((layerId) => {
        map.current!.on('click', layerId, (e) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0];
            onPolygonSelected({
              type: 'Feature',
              id: feature.properties?.id,
              geometry: feature.geometry as Polygon['geometry'],
              properties: feature.properties as Record<string, unknown>,
            });
          }
        });

        map.current!.on('mouseenter', layerId, () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });

        map.current!.on('mouseleave', layerId, () => {
          map.current!.getCanvas().style.cursor = '';
        });
      });

      // --- Click handler for POI layers (popup) ---
      map.current!.on('click', 'poi-fill-layer', showPoiPopup);
      map.current!.on('click', 'poi-point-layer', showPoiPopup);

      ['poi-fill-layer', 'poi-point-layer'].forEach((layerId) => {
        map.current!.on('mouseenter', layerId, () => {
          map.current!.getCanvas().style.cursor = 'pointer';
        });
        map.current!.on('mouseleave', layerId, () => {
          map.current!.getCanvas().style.cursor = '';
        });
      });

      // --- Load POIs on zoom/move ---
      const handleMapMove = () => {
        if (!map.current) return;
        const zoom = map.current.getZoom();
        if (zoom >= POI_ZOOM_THRESHOLD) {
          const bounds = map.current.getBounds();
          if (bounds) loadPOIsFromWFS(bounds);
        }
      };

      map.current!.on('moveend', handleMapMove);
      map.current!.on('zoomend', handleMapMove);

      // Trigger initial load if already zoomed in
      handleMapMove();
    });

    function showPoiPopup(e: mapboxgl.MapLayerMouseEvent) {
      if (!map.current || !e.features || e.features.length === 0) return;

      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['poi-fill-layer', 'poi-point-layer'],
      });

      if (!features || features.length === 0) return;

      const popupParts = features.slice(0, 5).map((feature, index) => {
        const props = feature.properties || {};
        const name = props.f_name || props.name || 'N/A';
        const naicsCode = props.f_naics_code || props.naics_code || props.naics || 'N/A';
        const id = props.id || 'N/A';

        const excludedKeys = ['id', 'f_name', 'name', 'f_naics_code', 'naics_code', 'naics'];
        const otherFields = Object.entries(props)
          .filter(([key]) => !excludedKeys.includes(key))
          .map(([key, value]) => `<div style="margin-left:10px"><strong>${key}:</strong> ${value}</div>`)
          .join('');

        return `
          <div style="border-bottom:${index < features.length - 1 ? '2px solid #ccc' : 'none'};padding-bottom:${index < features.length - 1 ? '10px' : '0'};margin-bottom:${index < features.length - 1 ? '10px' : '0'}">
            <div style="font-size:14px;font-weight:bold;margin-bottom:4px;color:#088">${name}</div>
            <div style="margin-bottom:2px"><strong>ID:</strong> ${id}</div>
            <div style="margin-bottom:2px"><strong>NAICS:</strong> ${naicsCode}</div>
            <details style="margin-top:6px;cursor:pointer">
              <summary style="font-weight:600;color:#007bff;user-select:none;font-size:12px">All attributes</summary>
              <div style="margin-top:4px;padding:6px;background:#f5f5f5;border-radius:4px;font-size:11px">${otherFields}</div>
            </details>
          </div>
        `;
      });

      const header = features.length > 1
        ? `<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #088">${features.length} POIs at this location</div>`
        : '';

      new mapboxgl.Popup({ maxWidth: '350px' })
        .setLngLat(e.lngLat)
        .setHTML(`<div style="max-height:350px;overflow-y:auto">${header}${popupParts.join('')}</div>`)
        .addTo(map.current);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [defaultCenter, defaultZoom, onPolygonCreated, onPolygonSelected, loadPOIsFromWFS]);

  useEffect(() => {
    if (!map.current || !polygons) return;
    const polySource = map.current.getSource('polygons') as mapboxgl.GeoJSONSource;
    const centroidSource = map.current.getSource('centroids') as mapboxgl.GeoJSONSource;
    if (polySource) {
      polySource.setData(polygons);
    }
    if (centroidSource) {
      const centroidFeatures = polygons.features.map((f) => {
        const coords = f.geometry.coordinates[0];
        let lngSum = 0, latSum = 0;
        const n = coords.length;
        for (const [lng, lat] of coords) {
          lngSum += lng;
          latSum += lat;
        }
        return {
          type: 'Feature' as const,
          id: f.id,
          geometry: { type: 'Point' as const, coordinates: [lngSum / n, latSum / n] },
          properties: f.properties,
        };
      });
      centroidSource.setData({ type: 'FeatureCollection', features: centroidFeatures });
    }
  }, [polygons]);

  // Toggle POI label visibility
  useEffect(() => {
    if (!map.current) return;
    try {
      map.current.setLayoutProperty('poi-labels-layer', 'visibility', showPoiLabels ? 'visible' : 'none');
    } catch { /* layer not yet added */ }
  }, [showPoiLabels]);

  // Toggle POI layer visibility
  useEffect(() => {
    if (!map.current) return;
    const visibility = showPoiLayer ? 'visible' : 'none';
    try {
      ['poi-fill-layer', 'poi-outline-layer', 'poi-point-layer', 'poi-labels-layer'].forEach((id) => {
        map.current!.setLayoutProperty(id, 'visibility',
          id === 'poi-labels-layer' ? (showPoiLayer && showPoiLabels ? 'visible' : 'none') : visibility
        );
      });
    } catch { /* layers not yet added */ }
  }, [showPoiLayer, showPoiLabels]);

  const startDrawing = useCallback(() => {
    if (draw.current) {
      draw.current.changeMode('draw_polygon');
      setIsDrawing(true);
    }
  }, []);

  const cancelDrawing = useCallback(() => {
    if (draw.current) {
      draw.current.deleteAll();
      draw.current.changeMode('simple_select');
      setIsDrawing(false);
    }
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Draw button */}
      <div className="absolute top-4 left-4 z-10">
        {!isDrawing ? (
          <button
            onClick={startDrawing}
            className="bg-blue-500 text-white px-4 py-2 rounded shadow hover:bg-blue-600"
          >
            Draw Polygon
          </button>
        ) : (
          <button
            onClick={cancelDrawing}
            className="bg-red-500 text-white px-4 py-2 rounded shadow hover:bg-red-600"
          >
            Cancel
          </button>
        )}
      </div>

      {/* POI layer controls */}
      <div className="absolute bottom-8 left-4 z-10 bg-white rounded-lg shadow-lg p-3 space-y-2 text-sm">
        <div className="font-semibold text-gray-700 text-xs uppercase tracking-wide">POI Layer</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPoiLayer}
            onChange={(e) => setShowPoiLayer(e.target.checked)}
            className="rounded"
          />
          <span>Show POIs</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showPoiLabels}
            onChange={(e) => setShowPoiLabels(e.target.checked)}
            disabled={!showPoiLayer}
            className="rounded"
          />
          <span className={!showPoiLayer ? 'text-gray-400' : ''}>Labels</span>
        </label>
        {isLoadingPOIs && (
          <div className="text-xs text-gray-500">Loading...</div>
        )}
        {poiCount > 0 && (
          <div className="text-xs text-gray-500">{poiCount} POIs loaded</div>
        )}
      </div>
    </div>
  );
}

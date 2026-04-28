import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, useJsApiLoader, Marker, DirectionsRenderer } from '@react-google-maps/api';

interface MapComponentProps {
  victimLocation: { lat: number, lng: number } | null;
  responderLocation: { lat: number, lng: number } | null;
  otherResponders?: { id: string, location: { lat: number, lng: number } }[];
  showPath?: boolean;
}

const containerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '1.5rem'
};

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function MapComponent({ victimLocation, responderLocation, otherResponders = [], showPath = false }: MapComponentProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [customDestination, setCustomDestination] = useState<{ lat: number, lng: number } | null>(null);
  const [directionsResponse, setDirectionsResponse] = useState<google.maps.DirectionsResult | null>(null);
  const longPressTimer = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseDown = useCallback((e: google.maps.MapMouseEvent) => {
    longPressTimer.current = setTimeout(() => {
      if (e.latLng) {
        setCustomDestination({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        // Optional: haptic feedback placeholder
        if ('vibrate' in navigator) navigator.vibrate(50);
      }
    }, 600); // 600ms for tactical long-press
  }, []);

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleDragStart = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    setMap(null);
  }, []);

  useEffect(() => {
    if (isLoaded && showPath && responderLocation && (customDestination || victimLocation)) {
      const directionsService = new google.maps.DirectionsService();
      const destination = customDestination || victimLocation!;
      
      directionsService.route(
        {
          origin: responderLocation,
          destination: destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirectionsResponse(result);
          } else {
            console.error(`error fetching directions ${result}`);
            setDirectionsResponse(null);
          }
        }
      );
    } else {
      setDirectionsResponse(null);
    }
  }, [isLoaded, showPath, victimLocation, responderLocation, customDestination]);

  if (!apiKey) {
    return (
      <div className="w-full h-full bg-zinc-950 border border-zinc-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center">
        <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-2">Maps Engine Unavailable</p>
        <p className="text-zinc-600 text-[10px]">Please configure <span className="text-white font-mono">VITE_GOOGLE_MAPS_API_KEY</span> in your environment. Ensure "Maps JavaScript API" and "Directions API" are enabled in your Google Cloud Console.</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-3xl animate-pulse flex items-center justify-center">
        <span className="text-[10px] text-zinc-600 uppercase font-black">Syncing Satellites...</span>
      </div>
    );
  }

  const defaultCenter = responderLocation || victimLocation || { lat: 20, lng: 77 };

  const handleRightClick = (e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      setCustomDestination({ lat: e.latLng.lat(), lng: e.latLng.lng() });
    }
  };

  return (
    <GoogleMap
      mapContainerStyle={containerStyle}
      center={defaultCenter}
      zoom={14}
      onLoad={onLoad}
      onUnmount={onUnmount}
      onRightClick={handleRightClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onDragStart={handleDragStart}
      options={{
        styles: darkMapStyles,
        disableDefaultUI: true,
        zoomControl: true,
      }}
    >
      {responderLocation && (
        <Marker
          position={responderLocation}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 8,
          }}
          title="Responder"
        />
      )}

      {otherResponders.map(r => (
        <Marker
          key={r.id}
          position={r.location}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#9ca3af',
            fillOpacity: 0.7,
            strokeWeight: 0,
            scale: 5,
          }}
          title="Other Responder"
        />
      ))}

      {victimLocation && (
        <Marker
          position={victimLocation}
          icon={{
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: '#dc2626',
            fillOpacity: 1,
            strokeWeight: 0,
            scale: 6,
          }}
          title="Victim"
        />
      )}

      {customDestination && (
        <Marker
          position={customDestination}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: '#8b5cf6', // Purple for custom
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: '#ffffff',
            scale: 8,
          }}
          title="Custom Destination"
          onClick={() => setCustomDestination(null)}
        />
      )}

      {directionsResponse && (
        <DirectionsRenderer
          directions={directionsResponse}
          options={{
            polylineOptions: {
              strokeColor: '#3b82f6',
              strokeOpacity: 0.8,
              strokeWeight: 4,
            },
            preserveViewport: false,
            suppressMarkers: true,
          }}
        />
      )}

      {/* Tactical Overlay */}
      {customDestination && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2">
          <div className="bg-zinc-950/90 border border-ui-primary/50 text-ui-primary px-4 py-2 rounded-full shadow-2xl backdrop-blur-md flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-ui-primary animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Tactical Destination Active</span>
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 setCustomDestination(null);
               }}
               className="ml-2 p-1 hover:bg-white/10 rounded-full transition-colors"
             >
                <span className="text-xs font-bold px-1">×</span>
             </button>
          </div>
        </div>
      )}
    </GoogleMap>
  );
}

const darkMapStyles = [
  { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#263c3f" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#6b9a76" }],
  },
  {
    featureType: "road",
    elementType: "geometry",
    stylers: [{ color: "#38414e" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212a37" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9ca5b3" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#746855" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry.stroke",
    stylers: [{ color: "#1f2835" }],
  },
  {
    featureType: "road.highway",
    elementType: "labels.text.fill",
    stylers: [{ color: "#f3d19c" }],
  },
  {
    featureType: "transit",
    elementType: "geometry",
    stylers: [{ color: "#2f3948" }],
  },
  {
    featureType: "transit.station",
    elementType: "labels.text.fill",
    stylers: [{ color: "#d59563" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#17263c" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#515c6d" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#17263c" }],
  },
];

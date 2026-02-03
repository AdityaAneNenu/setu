'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon issue
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = icon;

interface Project {
  id: number;
  lat: number;
  lng: number;
  title: string;
  description: string;
  status: string;
  budget?: string;
}

interface MapComponentProps {
  projects?: Project[];
  height?: string;
}

// PM-AJAY Operational States with approximate coordinates
const pmAjayStates = [
  { name: 'Andhra Pradesh', lat: 15.9129, lng: 79.7400 },
  { name: 'Assam', lat: 26.2006, lng: 92.9376 },
  { name: 'Bihar', lat: 25.0961, lng: 85.3131 },
  { name: 'Chhattisgarh', lat: 21.2787, lng: 81.8661 },
  { name: 'Gujarat', lat: 22.2587, lng: 71.1924 },
  { name: 'Haryana', lat: 29.0588, lng: 76.0856 },
  { name: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  { name: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  { name: 'Jharkhand', lat: 23.6102, lng: 85.2799 },
  { name: 'Karnataka', lat: 15.3173, lng: 75.7139 },
  { name: 'Kerala', lat: 10.8505, lng: 76.2711 },
  { name: 'Madhya Pradesh', lat: 22.9734, lng: 78.6569 },
  { name: 'Maharashtra', lat: 19.7515, lng: 75.7139 },
  { name: 'Odisha', lat: 20.9517, lng: 85.0985 },
  { name: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  { name: 'Punjab', lat: 31.1471, lng: 75.3412 },
  { name: 'Rajasthan', lat: 27.0238, lng: 74.2179 },
  { name: 'Tamil Nadu', lat: 11.1271, lng: 78.6569 },
  { name: 'Telangana', lat: 18.1124, lng: 79.0193 },
  { name: 'Tripura', lat: 23.9408, lng: 91.9882 },
  { name: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Uttarakhand', lat: 30.0668, lng: 79.0193 },
  { name: 'West Bengal', lat: 22.9868, lng: 87.8550 }
];

export default function MapComponent({ projects = [], height = '500px' }: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (mapRef.current) return; // Map already initialized
    
    if (!mapContainerRef.current) return;

    // Initialize map centered on India
    const map = L.map(mapContainerRef.current).setView([20.5937, 78.9629], 5);
    mapRef.current = map;

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add PM-AJAY state markers (circle markers)
    pmAjayStates.forEach(state => {
      const stateMarker = L.circleMarker([state.lat, state.lng], {
        radius: 8,
        fillColor: '#000000',
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8
      }).addTo(map);
      
      stateMarker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; padding: 0.5rem;">
          <strong style="font-size: 1.1rem; color: #1f2937;">PM-AJAY Operational State</strong><br>
          <strong style="color: #8b5cf6; font-size: 1rem;">${state.name}</strong><br>
          <em style="color: #6b7280; font-size: 0.875rem;">Projects sanctioned and funds released</em>
        </div>
      `);
    });

    // Add project markers if any
    if (projects.length > 0) {
      projects.forEach(project => {
        if (project.lat && project.lng) {
          const projectMarker = L.marker([project.lat, project.lng], {
            icon: redIcon
          }).addTo(map);
          
          projectMarker.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; padding: 0.5rem;">
              <strong style="font-size: 1.1rem; color: #1f2937;">Active Project</strong><br>
              <strong style="color: #8b5cf6;">${project.title}</strong><br>
              <em style="color: #6b7280; font-size: 0.875rem;">${project.description}</em>
              <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #e5e7eb;">
                <strong style="color: #4b5563;">Status:</strong> 
                <span style="color: #8b5cf6; font-weight: 600;">${project.status}</span><br>
                ${project.budget ? `<strong style="color: #4b5563;">Budget:</strong> <span style="color: #8b5cf6; font-weight: 600;">${project.budget}</span>` : ''}
              </div>
            </div>
          `);
        }
      });
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [projects]);

  return (
    <div 
      ref={mapContainerRef} 
      style={{ 
        height, 
        width: '100%', 
        borderRadius: '16px',
        border: '3px solid var(--border-color)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
      }} 
    />
  );
}

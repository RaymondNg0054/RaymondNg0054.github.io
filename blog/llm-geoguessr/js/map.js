// Initialize the map
const map = L.map('map').setView([0, 0], 2); // Will be centered based on data

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Define colors for visualization
const colors = {
    'truth': 'blue',
    'prediction': 'red',
    'path': 'purple'
};

// Create layer groups
const layers = {
    'Ground Truth': L.layerGroup().addTo(map),
    'Predictions': L.layerGroup().addTo(map),
    'Error Paths': L.layerGroup().addTo(map)
};

// Function to calculate distance between two points in km (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Function to load and process JSONL files
async function loadJSONLFiles() {
    // Arrays to store all coordinates for calculating bounds and center
    const allLats = [];
    const allLons = [];
    const allCoordinates = [];
    
    try {
        // Load source of truth data
        const truthResponse = await fetch('/blog/llm-geoguessr/data/source_of_truth.jsonl');
        const truthText = await truthResponse.text();
        const truthLines = truthText.trim().split('\n');
        const truthData = truthLines.map(line => JSON.parse(line));
        
        // Load prediction data
        const predResponse = await fetch('/blog/llm-geoguessr/data/o4_mini_results.jsonl');
        const predText = await predResponse.text();
        const predLines = predText.trim().split('\n');
        const predData = predLines.map(line => JSON.parse(line));
        
        // Create a map of truth data by ID for easy lookup
        const truthMap = {};
        truthData.forEach(item => {
            truthMap[item.id] = item;
        });
        
        // Process each prediction and match with ground truth
        predData.forEach(predItem => {
            const truthItem = truthMap[predItem.id];
            
            if (truthItem) {
                const latTruth = parseFloat(truthItem.lat);
                const lonTruth = parseFloat(truthItem.lon);
                const latPred = parseFloat(predItem.lat);
                const lonPred = parseFloat(predItem.lon);
                
                if (!isNaN(latTruth) && !isNaN(lonTruth) && !isNaN(latPred) && !isNaN(lonPred)) {
                    // Calculate error distance in km
                    const errorDistance = calculateDistance(latTruth, lonTruth, latPred, lonPred);
                    
                    // Store coordinates for bounds calculation
                    allLats.push(latTruth, latPred);
                    allLons.push(lonTruth, lonPred);
                    allCoordinates.push([latTruth, lonTruth], [latPred, lonPred]);
                    
                    // Create popup content for ground truth
                    const truthPopup = `
                        <b>ID:</b> ${truthItem.id}<br>
                        <b>Ground Truth:</b> ${truthItem.city}, ${truthItem.country}<br>
                        <b>Coordinates:</b> ${latTruth.toFixed(6)}, ${lonTruth.toFixed(6)}<br>
                        <b>Notes:</b> ${truthItem.notes || 'N/A'}
                    `;
                    
                    // Create popup content for prediction
                    const predPopup = `
                        <b>ID:</b> ${predItem.id}<br>
                        <b>Prediction:</b> ${predItem.city}, ${predItem.country}<br>
                        <b>Coordinates:</b> ${latPred.toFixed(6)}, ${lonPred.toFixed(6)}<br>
                        <b>Error:</b> ${errorDistance.toFixed(2)} km<br>
                        <b>Notes:</b> ${predItem.notes || 'N/A'}
                    `;
                    
                    // Add ground truth marker
                    L.marker([latTruth, lonTruth], {
                        icon: L.divIcon({
                            className: 'truth-marker',
                            html: `<div style="background-color:${colors.truth};width:10px;height:10px;border-radius:50%;"></div>`,
                            iconSize: [10, 10]
                        })
                    })
                    .bindPopup(truthPopup)
                    .bindTooltip(`Ground Truth: ${truthItem.city}, ${truthItem.country}`)
                    .addTo(layers['Ground Truth']);
                    
                    // Add prediction marker
                    L.marker([latPred, lonPred], {
                        icon: L.divIcon({
                            className: 'pred-marker',
                            html: `<div style="background-color:${colors.prediction};width:10px;height:10px;border-radius:50%;"></div>`,
                            iconSize: [10, 10]
                        })
                    })
                    .bindPopup(predPopup)
                    .bindTooltip(`Prediction: ${predItem.city}, ${predItem.country}`)
                    .addTo(layers['Predictions']);
                    
                    // Add animated path between points (similar to AntPath in Folium)
                    const pathOptions = {
                        color: colors.path,
                        weight: 2,
                        opacity: 0.6,
                        dashArray: '10, 20',
                        dashOffset: '0',
                        pulseColor: '#FFFFFF',
                        delay: 800,
                        paused: false,
                        reverse: false
                    };
                    
                    // Create a polyline with dash pattern to simulate ant path
                    const errorPath = L.polyline([[latTruth, lonTruth], [latPred, lonPred]], {
                        color: colors.path,
                        weight: 2,
                        dashArray: '10, 20',
                        opacity: 0.7
                    })
                    .bindPopup(`<b>Error:</b> ${errorDistance.toFixed(2)} km`)
                    .addTo(layers['Error Paths']);
                    
                    // Add animation to simulate ant path effect
                    let offset = 0;
                    setInterval(() => {
                        offset = (offset + 1) % 30;
                        errorPath.setStyle({ dashOffset: -offset.toString() });
                    }, 100);
                }
            }
        });
            
        // After loading all data, fit the map to the bounds of all points
        if (allCoordinates.length > 0) {
            try {
                const bounds = L.latLngBounds(allCoordinates);
                map.fitBounds(bounds, {
                    padding: [50, 50],
                    maxZoom: 12
                });
            } catch (e) {
                console.error("Error setting bounds:", e);
                // Fallback to center calculation if bounds fail
                const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
                const centerLon = allLons.reduce((a, b) => a + b, 0) / allLons.length;
                map.setView([centerLat, centerLon], 4);
            }
        }
    } catch (error) {
        console.error(`Error loading data:`, error);
    }
}

// Create a legend
const legend = L.control({position: 'bottomright'});
let legendContent;

legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'legend');
    
    // Create a container for the legend content
    const legendBox = L.DomUtil.create('div', 'legend-box', div);
    legendBox.innerHTML = '<h4>Map Legend</h4>';
    
    // Create a container for the legend content
    legendContent = L.DomUtil.create('div', 'legend-content', legendBox);
    
    // Add legend items
    legendContent.innerHTML += `
        <div class="legend-item">
            <span class="color-box" style="background-color: ${colors.truth}"></span>
            Ground Truth Locations
        </div>
        <div class="legend-item">
            <span class="color-box" style="background-color: ${colors.prediction}"></span>
            Predicted Locations
        </div>
        <div class="legend-item">
            <span class="color-box" style="background-color: ${colors.path}"></span>
            Error Paths
        </div>
    `;
    
    // Add toggle button for legend
    const toggleButton = L.DomUtil.create('button', 'map-control-button legend-toggle', div);
    toggleButton.innerHTML = 'Hide Legend';
    toggleButton.style.display = 'block';
    toggleButton.style.width = '100%';
    toggleButton.style.marginTop = '5px';
    
    toggleButton.onclick = function() {
        if (legendBox.classList.contains('collapsed')) {
            legendBox.classList.remove('collapsed');
            toggleButton.innerHTML = 'Hide Legend';
        } else {
            legendBox.classList.add('collapsed');
            toggleButton.innerHTML = 'Show Legend';
        }
    };
    
    return div;
};

legend.addTo(map);

// Add layer control with custom container
const overlays = {};
Object.entries(layers).forEach(([name, layer]) => {
    overlays[name] = layer;
});

// Add the layer control
const layerControl = L.control.layers(null, overlays, {collapsed: false}).addTo(map);

// Get the layer control container and add it to our custom box
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        const layerControlContainer = document.querySelector('.leaflet-control-layers');
        const layerBox = document.querySelector('.layer-box');
        if (layerControlContainer && layerBox) {
            layerBox.appendChild(layerControlContainer);
        }
    }, 100);
});

// Add toggle button for layer control
const layerControlToggle = L.control({position: 'topright'});
layerControlToggle.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'layer-control-toggle');
    
    // Create a container for the layer control box
    const layerBox = L.DomUtil.create('div', 'layer-box', div);
    
    // Add toggle button for layer control
    const toggleButton = L.DomUtil.create('button', 'map-control-button', div);
    toggleButton.innerHTML = 'Hide Layers';
    toggleButton.style.display = 'block';
    toggleButton.style.width = '100%';
    
    toggleButton.onclick = function() {
        // Find the layer control container
        const layerControlContainer = document.querySelector('.leaflet-control-layers');
        
        if (layerBox.classList.contains('collapsed')) {
            layerBox.classList.remove('collapsed');
            layerControlContainer.classList.remove('collapsed');
            toggleButton.innerHTML = 'Hide Layers';
        } else {
            layerBox.classList.add('collapsed');
            layerControlContainer.classList.add('collapsed');
            toggleButton.innerHTML = 'Show Layers';
        }
    };
    
    return div;
};

layerControlToggle.addTo(map);

// Add custom CSS for the markers and paths
document.addEventListener('DOMContentLoaded', function() {
    // Add CSS for markers and animations
    const style = document.createElement('style');
    style.textContent += `
        .truth-marker, .pred-marker {
            border-radius: 50%;
            width: 10px;
            height: 10px;
        }
        
        .truth-marker {
            background-color: ${colors.truth};
        }
        
        .pred-marker {
            background-color: ${colors.prediction};
        }
        
        @keyframes dash {
            to {
                stroke-dashoffset: 1000;
            }
        }
    `;
    document.head.appendChild(style);
    
    // Load the data
    loadJSONLFiles();
    
    // Add CSS to make the layer control collapsible
    style.textContent = `
        .leaflet-control-layers-expanded {
            padding: 6px 10px 6px 6px;
        }
        
        .leaflet-control-layers {
            background-color: white;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
        }
        
        .leaflet-control-layers.collapsed {
            display: none;
        }
        
        .layer-box {
            background-color: white;
            padding: 0;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
        }
        
        .layer-box.collapsed {
            display: none;
        }
        
        .legend-box {
            background-color: white;
            padding: 6px 8px;
            border-radius: 4px;
            box-shadow: 0 1px 5px rgba(0,0,0,0.4);
            transition: all 0.3s ease;
        }
        
        .legend-box.collapsed {
            display: none;
        }
        
        .legend-content {
            max-height: 500px;
            opacity: 1;
            transition: max-height 0.3s, opacity 0.3s;
            overflow: hidden;
        }
        

    `;
    document.head.appendChild(style);
});

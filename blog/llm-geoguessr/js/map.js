// Initialize the map
const map = L.map('map').setView([37.0902, -95.7129], 4); // Default to US center

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Define colors for each source
const colors = {
    'Source of Truth': 'black',
    'O4 Mini Results': 'blue'
};

// Create layer groups for each source
const layers = {};
Object.keys(colors).forEach(source => {
    layers[source] = L.layerGroup().addTo(map);
});

// Function to load and process JSONL files
async function loadJSONLFiles() {
    const jsonlFiles = [
        '/blog/llm-geoguessr/data/source_of_truth.jsonl',
        '/blog/llm-geoguessr/data/o4_mini_results.jsonl'
    ];
    
    // Arrays to store all coordinates for calculating bounds
    const allLats = [];
    const allLons = [];
    const allCoordinates = [];
    
    // Map source names from filenames to display names
    const sourceNameMap = {
        'source_of_truth': 'Source of Truth',
        'o4_mini_results': 'O4 Mini Results'
    };
    
    for (const file of jsonlFiles) {
        const fileKey = file.split('/').pop().replace('.jsonl', '');
        const sourceName = sourceNameMap[fileKey] || fileKey;
        
        try {
            const response = await fetch(file);
            const jsonlText = await response.text();
            
            // Process JSONL by splitting on newlines and parsing each line
            const lines = jsonlText.trim().split('\n');
            const data = lines.map(line => JSON.parse(line));
            
            data.forEach(item => {
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    // Store coordinates for bounds calculation
                    allLats.push(lat);
                    allLons.push(lon);
                    allCoordinates.push([lat, lon]);
                    
                    // Create popup content
                    const popupContent = `
                        <b>Source:</b> ${sourceName}<br>
                        <b>ID:</b> ${item.id}<br>
                        <b>Location:</b> ${item.city}, ${item.country}<br>
                        <b>Coordinates:</b> ${lat}, ${lon}<br>
                        <b>Notes:</b> ${item.notes || 'N/A'}
                    `;
                    
                    // Add marker to the appropriate layer
                    L.circleMarker([lat, lon], {
                        radius: 5,
                        color: colors[sourceName],
                        fillColor: colors[sourceName],
                        fillOpacity: 0.7,
                        weight: 1
                    })
                    .bindPopup(popupContent)
                    .bindTooltip(`${sourceName}: ${item.id}`)
                    .addTo(layers[sourceName]);
                }
            });
                    
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
            console.error(`Error loading ${file}:`, error);
        }
    }
}

// Create a legend
const legend = L.control({position: 'bottomright'});
let legendContent;

legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<h4>Data Sources</h4>';
    
    // Create a container for the legend content
    legendContent = L.DomUtil.create('div', 'legend-content', div);
    
    Object.entries(colors).forEach(([source, color]) => {
        legendContent.innerHTML += `
            <div class="legend-item">
                <span class="color-box" style="background-color: ${color}"></span>
                ${source.replace(/_/g, ' ')}
            </div>
        `;
    });
    
    // Add toggle button for legend
    const toggleButton = L.DomUtil.create('button', 'map-control-button legend-toggle', div);
    toggleButton.innerHTML = 'Hide Legend';
    toggleButton.style.display = 'block';
    toggleButton.style.width = '100%';
    toggleButton.style.marginTop = '5px';
    
    toggleButton.onclick = function() {
        if (legendContent.classList.contains('collapsed')) {
            legendContent.classList.remove('collapsed');
            toggleButton.innerHTML = 'Hide Legend';
        } else {
            legendContent.classList.add('collapsed');
            toggleButton.innerHTML = 'Show Legend';
        }
    };
    
    return div;
};

legend.addTo(map);

// Add layer control with custom container
const overlays = {};
Object.entries(layers).forEach(([name, layer]) => {
    overlays[name.replace(/_/g, ' ')] = layer;
});

// Add the layer control
const layerControl = L.control.layers(null, overlays, {collapsed: false}).addTo(map);

// Add toggle button for layer control
const layerControlToggle = L.control({position: 'topright'});
layerControlToggle.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'layer-control-toggle');
    const button = L.DomUtil.create('button', 'map-control-button', div);
    button.innerHTML = 'Hide Layers';
    
    button.onclick = function() {
        // Find the layer control container
        const layerControlContainer = document.querySelector('.leaflet-control-layers');
        const layerControlForm = layerControlContainer.querySelector('.leaflet-control-layers-list');
        
        if (layerControlForm.classList.contains('collapsed')) {
            layerControlForm.classList.remove('collapsed');
            button.innerHTML = 'Hide Layers';
        } else {
            layerControlForm.classList.add('collapsed');
            button.innerHTML = 'Show Layers';
        }
    };
    
    return div;
};

layerControlToggle.addTo(map);

// Load the data
document.addEventListener('DOMContentLoaded', function() {
    loadJSONLFiles();
    
    // Add CSS to make the layer control collapsible
    const style = document.createElement('style');
    style.textContent = `
        .leaflet-control-layers-expanded {
            padding: 6px 10px 6px 6px;
        }
        
        .leaflet-control-layers-list.collapsed {
            max-height: 0;
            opacity: 0;
            margin: 0;
            padding: 0;
        }
        
        .leaflet-control-layers-list {
            max-height: 500px;
            opacity: 1;
            transition: max-height 0.3s, opacity 0.3s, margin 0.3s, padding 0.3s;
            overflow: hidden;
        }
        
        .legend-content.collapsed {
            max-height: 0;
            opacity: 0;
            margin: 0;
            padding: 0;
        }
        
        .legend-content {
            max-height: 500px;
            opacity: 1;
            transition: max-height 0.3s, opacity 0.3s, margin 0.3s, padding 0.3s;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
});

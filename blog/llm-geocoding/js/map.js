// Initialize the map
const map = L.map('map').setView([37.0902, -95.7129], 4); // Default to US center

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19
}).addTo(map);

// Define colors for each source
const colors = {
    'Address Source of Truth': 'black',
    'ChatGPT o1': 'blue',
    'Claude 3.7 Sonnet': 'green',
    'DeepSeek R1': 'red',
    'DeepSeek V3': 'purple',
    'Gemini 2.5 Pro Experimental': 'orange',
    'Llama 3.1 405B Instruct': 'darkred',
    'LLama 4 Maverick 17B 12E Instruct': 'cadetblue'
};

// Create layer groups for each source
const layers = {};
Object.keys(colors).forEach(source => {
    layers[source] = L.layerGroup().addTo(map);
});

// Function to load and process CSV files
async function loadCSVs() {
    const csvFiles = [
        '/blog/llm-geocoding/csv/address_source_of_truth.csv',
        '/blog/llm-geocoding/csv/chatgpt_o1.csv',
        '/blog/llm-geocoding/csv/claude_3_7_sonnet.csv',
        '/blog/llm-geocoding/csv/deepseek_r1.csv',
        '/blog/llm-geocoding/csv/deepseek_v3.csv',
        '/blog/llm-geocoding/csv/gemini_2_5_pro_experimental.csv',
        '/blog/llm-geocoding/csv/llama_3_1_405B_instruct.csv',
        '/blog/llm-geocoding/csv/llama_4_maverick_17B_128E_instruct.csv'
    ];
    
    // Arrays to store all coordinates for calculating bounds
    const allLats = [];
    const allLons = [];
    const allCoordinates = [];
    
    // Map source names from filenames to display names
    const sourceNameMap = {
        'address_source_of_truth': 'Address Source of Truth',
        'chatgpt_o1': 'ChatGPT o1',
        'claude_3_7_sonnet': 'Claude 3.7 Sonnet',
        'deepseek_r1': 'DeepSeek R1',
        'deepseek_v3': 'DeepSeek V3',
        'gemini_2_5_pro_experimental': 'Gemini 2.5 Pro Experimental',
        'llama_3_1_405B_instruct': 'Llama 3.1 405B Instruct',
        'llama_4_maverick_17B_128E_instruct': 'LLama 4 Maverick 17B 12E Instruct'
    };
    
    for (const file of csvFiles) {
        const fileKey = file.split('/').pop().replace('.csv', '');
        const sourceName = sourceNameMap[fileKey] || fileKey;
        
        try {
            const response = await fetch(file);
            console.log(`Response for ${file}:`, response);
            const csvText = await response.text();
            console.log(`CSV text for ${file}:`, csvText.substring(0, 200) + '...');
            
            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    results.data.forEach(row => {
                        const lat = parseFloat(row.Latitude);
                        const lon = parseFloat(row.Longitude);
                        
                        if (!isNaN(lat) && !isNaN(lon)) {
                            // Store coordinates for bounds calculation
                            allLats.push(lat);
                            allLons.push(lon);
                            allCoordinates.push([lat, lon]);
                            
                            // Create popup content
                            const popupContent = `
                                <b>Source:</b> ${sourceName}<br>
                                <b>Address:</b> ${row.Address}<br>
                                <b>Coordinates:</b> ${lat}, ${lon}
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
                            .bindTooltip(`${sourceName}: ${row.Address}`)
                            .addTo(layers[sourceName]);
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
                }
            });
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
    loadCSVs();
    
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

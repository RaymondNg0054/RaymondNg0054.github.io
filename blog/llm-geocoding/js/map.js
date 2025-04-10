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
        'csv/address_source_of_truth.csv',
        'csv/chatgpt_o1.csv',
        'csv/claude_3_7_sonnet.csv',
        'csv/deepseek_r1.csv',
        'csv/deepseek_v3.csv',
        'csv/gemini_2_5_pro_experimental.csv',
        'csv/llama_3_1_405B_instruct.csv',
        'csv/llama_4_maverick_17B_128E_instruct.csv'
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
        const fileKey = file.replace('csv/', '').replace('.csv', '');
        const sourceName = sourceNameMap[fileKey] || fileKey;
        
        try {
            const response = await fetch(file);
            const csvText = await response.text();
            
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

legend.onAdd = function(map) {
    const div = L.DomUtil.create('div', 'legend');
    div.innerHTML = '<h4>Data Sources</h4>';
    
    Object.entries(colors).forEach(([source, color]) => {
        div.innerHTML += `
            <div class="legend-item">
                <span class="color-box" style="background-color: ${color}"></span>
                ${source.replace(/_/g, ' ')}
            </div>
        `;
    });
    
    return div;
};

legend.addTo(map);

// Add layer control
const overlays = {};
Object.entries(layers).forEach(([name, layer]) => {
    overlays[name.replace(/_/g, ' ')] = layer;
});

L.control.layers(null, overlays, {collapsed: false}).addTo(map);

// Load the data
document.addEventListener('DOMContentLoaded', function() {
    loadCSVs();
});

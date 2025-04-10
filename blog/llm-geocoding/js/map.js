// Initialize the map
const map = L.map('map').setView([0, 0], 2);

// Add OpenStreetMap tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Define colors for each source
const colors = {
    'address_source_of_truth': 'black',
    'chatgpt_o1': 'blue',
    'claude_3_7_sonnet': 'green',
    'deepseek_r1': 'red',
    'deepseek_v3': 'purple',
    'gemini_2_5_pro_experimental': 'orange',
    'llama_3_1_405B_instruct': 'darkred',
    'llama_4_maverick_17B_128E_instruct': 'cadetblue'
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
    
    const allLats = [];
    const allLons = [];
    
    for (const file of csvFiles) {
        const sourceName = file.replace('csv/', '').replace('.csv', '');
        
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
                            allLats.push(lat);
                            allLons.push(lon);
                            
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
                    
                    // After loading all data, center the map
                    if (allLats.length > 0 && allLons.length > 0) {
                        const centerLat = allLats.reduce((a, b) => a + b, 0) / allLats.length;
                        const centerLon = allLons.reduce((a, b) => a + b, 0) / allLons.length;
                        map.setView([centerLat, centerLon], 2);
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

const algoButtons = document.querySelectorAll(".sidebar button");
const runBtn = document.querySelector(".run-btn");
const visualBox = document.querySelector(".visual-box");
const controls = document.querySelectorAll(".controls button");
const inputPanel = document.querySelector(".input-panel");

const mainHeading = document.querySelector(".top-bar h1");
const mainSubheading = document.querySelector(".top-bar p");
const stepLog = document.querySelector(".step-log");

// PERFORMANCE FIELDS
const perf = document.querySelector(".performance");

// STATE
let currentAlgorithm = "";
let steps = [];
let currentStep = 0;
let interval = null;
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;

// ALGORITHM INPUT DEFINITIONS
const algoInputs = {
    "Bellman-Ford": ["Vertices Count (V)", "Edges (u,v,w)", "Source Node"],
    "Matrix Chain Multiplication": ["Dimensions (p)"],
    "Fractional Knapsack": ["Items (value,weight)", "Capacity"],
    "Dijkstra's Algorithm": ["Vertices Count (V)", "Edges (u,v,w)", "Source Node"],
    "Prim's Algorithm": ["Vertices Count (V)", "Edges (u,v,w)"],
    "Kruskal's Algorithm": ["Vertices Count (V)", "Edges (u,v,w)"],
    "Activity Selection": ["Activities (start,finish)"],
};
const GRAPH_ALGOS = ["Dijkstra's Algorithm", "Prim's Algorithm", "Kruskal's Algorithm", "Bellman-Ford"];

function ensureInputFieldsContainer() {
    if (!inputPanel) return null;
    let fields = document.getElementById("input-fields");
    if (!fields) {
        fields = document.createElement("div");
        fields.id = "input-fields";
        inputPanel.insertBefore(fields, runBtn);
    }

    const playbackInput = inputPanel.querySelector("input[type='range']");
    if (playbackInput && playbackInput.previousElementSibling) {
        playbackInput.previousElementSibling.classList.add("playback-label");
    }

    const staleInputs = inputPanel.querySelectorAll("label:not(.playback-label), input[type='text']");
    staleInputs.forEach(el => el.remove());
    return fields;
}

function setStepLog(message) {
    if (!stepLog) return;
    stepLog.innerHTML = message || "";
}

function ensureGraphLayout() {
    if (!window.vis) {
        visualBox.innerHTML = '<p>Graph library not loaded. Add vis-network.min.js to the page.</p>';
        return;
    }
    if (!document.getElementById('graph-container')) {
        visualBox.innerHTML = '<div class="graph-host"><div id="graph-container"></div></div>';
    }
}

function ensureVisDataSets() {
    if (!window.vis) return false;
    if (!nodesDataSet || !edgesDataSet) {
        nodesDataSet = new vis.DataSet();
        edgesDataSet = new vis.DataSet();
    }
    return true;
}

function setSteps(newSteps) {
    steps = newSteps;
    currentStep = 0;
    clearInterval(interval);
    interval = null;
    updateVisualization();
    updatePerformance();
}

function parseEdgeTriples(input, allowNegative = false) {
    const pattern = allowNegative ? /\(\s*\d+\s*,\s*\d+\s*,\s*-?\d+\s*\)/g : /\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;
    const matches = input.match(pattern)?.map(s => {
        const parts = s.replace(/[()\s]/g, "").split(',');
        return { from: parseInt(parts[0]), to: parseInt(parts[1]), label: parts[2] };
    }) || [];

    if (matches.length > 0) return matches;

    const fallback = input.split(';').map(s => s.trim()).filter(Boolean);
    const edges = [];
    for (const entry of fallback) {
        const cleaned = entry.replace(/[()\s]/g, "");
        const parts = cleaned.split(',');
        if (parts.length !== 3) continue;
        const u = parseInt(parts[0]);
        const v = parseInt(parts[1]);
        const w = parseInt(parts[2]);
        if ([u, v, w].some(Number.isNaN)) continue;
        if (!allowNegative && w < 0) continue;
        edges.push({ from: u, to: v, label: String(w) });
    }
    return edges;
}

function cloneNodes(nodes) {
    return nodes.map(n => ({ ...n, color: n.color ? { ...n.color } : undefined }));
}

function cloneEdges(edges) {
    return edges.map(e => ({ ...e, color: e.color ? { ...e.color } : undefined }));
}

function buildGraphBase(numVertices, edges, arrowEnabled) {
    const nodes = [];
    const radius = 180;
    for (let i = 0; i < numVertices; i++) {
        const angle = (2 * Math.PI * i) / Math.max(1, numVertices);
        const x = Math.round(radius * Math.cos(angle));
        const y = Math.round(radius * Math.sin(angle));
        nodes.push({
            id: i,
            label: `Node ${i}`,
            shape: 'circle',
            x,
            y,
            fixed: true,
            color: { background: '#1e244a' }
        });
    }
    const normalizedEdges = edges.map((e, idx) => ({
        ...e,
        id: idx,
        color: { color: '#444c8a' },
        width: 1,
        arrows: arrowEnabled ? 'to' : ''
    }));
    return { nodes, edges: normalizedEdges };
}

function renderGraphStep(step) {
    ensureGraphLayout();
    if (!ensureVisDataSets()) return;
    const container = document.getElementById('graph-container');
    if (!container) return;
    container.style.display = 'block';
    container.style.width = '100%';
    container.style.height = '100%';

    if (step.nodes) {
        nodesDataSet.clear();
        nodesDataSet.add(step.nodes);
    }
    if (step.edges) {
        edgesDataSet.clear();
        edgesDataSet.add(step.edges);
    }

    const data = { nodes: nodesDataSet, edges: edgesDataSet };
    const options = {
        physics: false,
        interaction: { dragNodes: false },
        nodes: {
            font: {
                size: 18,
                color: '#ffffff',
                face: 'Segoe UI'
            },
            borderWidth: 2,
            color: {
                border: '#8fa2ff'
            }
        },
        edges: {
            font: {
                size: 14,
                color: '#d9e1ff',
                align: 'top'
            }
        }
    };
    if (!network) {
        network = new vis.Network(container, data, options);
    } else {
        network.setData(data);
        network.setOptions(options);
    }
}

function buildDistanceSteps(numVertices, edges, distances) {
    const base = buildGraphBase(numVertices, edges, true);
    const nodesWithDist = base.nodes.map((n, i) => ({
        ...n,
        label: `Node ${i}\nDist: ${distances[i] === -1 ? '∞' : distances[i]}`
    }));
    const stepsOut = [];
    stepsOut.push({ message: 'Distances computed. Animating nodes.', nodes: cloneNodes(nodesWithDist), edges: cloneEdges(base.edges), distances: [...distances] });
    distances.forEach((d, i) => {
        const highlightNodes = nodesWithDist.map(n => ({ ...n, color: { background: n.id === i ? '#6c8cff' : '#1e244a' } }));
        stepsOut.push({ message: `Node ${i}: ${d === -1 ? 'Unreachable' : d}`, nodes: cloneNodes(highlightNodes), edges: cloneEdges(base.edges), distances: [...distances] });
    });
    return stepsOut;
}

function buildMstSteps(numVertices, edges, mstEdges, label) {
    const base = buildGraphBase(numVertices, edges, false);
    const mstSet = new Set(mstEdges.map(e => `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}`));
    const stepsOut = [{ message: `${label} MST in progress.`, nodes: cloneNodes(base.nodes), edges: cloneEdges(base.edges) }];
    const currentEdges = cloneEdges(base.edges);

    mstEdges.forEach((edge, idx) => {
        currentEdges.forEach(e => {
            const key = `${Math.min(e.from, e.to)}-${Math.max(e.from, e.to)}`;
            if (key === `${Math.min(edge.u, edge.v)}-${Math.max(edge.u, edge.v)}`) {
                e.color = { color: '#ff5757' };
                e.width = 3;
            }
        });
        stepsOut.push({ message: `Adding edge (${edge.u} - ${edge.v}) weight ${edge.w}.`, nodes: cloneNodes(base.nodes), edges: cloneEdges(currentEdges) });
    });
    return stepsOut;
}

function buildActivitySteps(activities, selected) {
    const stepsOut = [];
    const sorted = [...activities].sort((a, b) => a.finish - b.finish);
    let lastFinish = -Infinity;
    const selectedList = [];
    stepsOut.push({
        message: 'Sorting activities by finish time.',
        activities: sorted,
        selected: [],
        candidateIndex: -1,
        reason: 'We sort by finish time to maximize the number of activities.'
    });
    sorted.forEach((activity, idx) => {
        const canTake = activity.start >= lastFinish;
        const reason = canTake
            ? `Selected because start ${activity.start} >= last finish ${lastFinish}.`
            : `Rejected because start ${activity.start} < last finish ${lastFinish}.`;

        if (canTake) {
            lastFinish = activity.finish;
            selectedList.push(activity);
        }

        stepsOut.push({
            message: `Evaluating activity (${activity.start}, ${activity.finish}).`,
            activities: sorted,
            selected: [...selectedList],
            candidateIndex: idx,
            reason
        });
    });
    return stepsOut;
}

function buildMcmSteps(dims, minCost) {
    return [
        { message: 'Initialized DP table for Matrix Chain Multiplication.', html: `<p>Dimensions: ${dims.join(', ')}</p>` },
        { message: 'Computed minimum scalar multiplications.', html: `<p>Minimum Cost: ${minCost}</p>` }
    ];
}

function cloneMatrix(matrix) {
    return matrix.map(row => row.slice());
}

function buildMcmMatrixSteps(dims) {
    const n = dims.length - 1;
    const m = Array.from({ length: n + 1 }, () => Array(n + 1).fill(null));
    const stepsOut = [];

    for (let i = 1; i <= n; i++) {
        m[i][i] = 0;
    }
    stepsOut.push({
        message: 'Initialized DP table (diagonal set to 0).',
        matrix: cloneMatrix(m),
        dims: [...dims],
        highlight: { i: 1, j: 1 }
    });

    for (let L = 2; L <= n; L++) {
        for (let i = 1; i <= n - L + 1; i++) {
            const j = i + L - 1;
            m[i][j] = Infinity;
            for (let k = i; k <= j - 1; k++) {
                const cost = m[i][k] + m[k + 1][j] + dims[i - 1] * dims[k] * dims[j];
                if (cost < m[i][j]) {
                    m[i][j] = cost;
                }
                stepsOut.push({
                    message: `Evaluating A${i}..A${j} with split k=${k}. Cost=${cost}.`,
                    matrix: cloneMatrix(m),
                    dims: [...dims],
                    highlight: { i, j, k }
                });
            }
        }
    }

    stepsOut.push({
        message: `Minimum multiplications: ${m[1][n]}.`,
        matrix: cloneMatrix(m),
        dims: [...dims],
        highlight: { i: 1, j: n },
        minCost: m[1][n]
    });

    return stepsOut;
}

// SELECT ALGORITHM
algoButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        currentAlgorithm = btn.innerText;

        // Highlight selected button
        algoButtons.forEach(b => b.style.background = "#11183f");
        btn.style.background = "#6c8cff";

        // Update UI
        mainHeading.innerText = `${currentAlgorithm}`;
        mainSubheading.innerText = `Enter the inputs for ${currentAlgorithm} and click "Run"`;
        setStepLog("Waiting for algorithm to run...");

        if (GRAPH_ALGOS.includes(currentAlgorithm)) {
            ensureGraphLayout();
        } else {
            if (network) {
                network.destroy();
                network = null;
            }
            visualBox.innerHTML = `<p>Select inputs and run the algorithm</p>`;
        }

        updateInputFields();
        resetPerformance();
    });
});

// UPDATE DYNAMIC INPUT FIELDS
function updateInputFields() {
    const inputContainer = ensureInputFieldsContainer();
    if (!inputContainer) return;
    inputContainer.innerHTML = "";
    const inputs = algoInputs[currentAlgorithm];

    if (inputs) {
        inputs.forEach(label => {
            const group = document.createElement("div");
            group.className = "input-group";

            const labelEl = document.createElement("label");
            labelEl.innerText = label;

            const inputEl = document.createElement("input");
            inputEl.type = "text";
            inputEl.id = `input-${label.split(' ')[0].toLowerCase()}`; // e.g., input-vertices
            inputEl.placeholder = getPlaceholder(label);

            group.appendChild(labelEl);
            group.appendChild(inputEl);
            inputContainer.appendChild(group);
        });
    } else {
        inputContainer.innerHTML = "<p>No specific inputs for this algorithm.</p>";
    }
}

function getPlaceholder(label) {
    switch (label) {
        case "Vertices Count (V)": return "e.g., 5";
        case "Edges (u,v,w)": return "e.g., 0,1,10; 1,2,5; 2,3,2";
        case "Source Node": return "e.g., 0";
        case "Dimensions (p)": return "e.g., 10,20,5,30";
        case "Items (value,weight)": return "e.g., (60,10), (100,20), ...";
        case "Capacity": return "e.g., 50";
        case "Activities (start,finish)": return "e.g., (1,4), (3,5), (0,6), ...";
        default: return "";
    }
}

// RUN BUTTON
runBtn.addEventListener("click", () => {
    if (!currentAlgorithm) {
        alert("Please select an algorithm first!");
        return;
    }

    // Clear previous visualization
    steps = [];
    currentStep = 0;

    switch (currentAlgorithm) {
        case "Dijkstra's Algorithm":
            const verticesInputD = document.getElementById("input-vertices").value;
            const edgesInputD = document.getElementById("input-edges").value;
            const sourceInputD = document.getElementById("input-source").value;

            try {
                const numVertices = parseInt(verticesInputD);
                const sourceNode = parseInt(sourceInputD);

                const edges = parseEdgeTriples(edgesInputD, false);

                if (isNaN(numVertices) || isNaN(sourceNode) || edges.length === 0) {
                    alert("Invalid input for Dijkstra's. Please check the format.");
                    return;
                }

                // Call Backend API
                ensureGraphLayout();
                fetch("http://localhost:18080/api/dijkstra", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vertices: numVertices, source: sourceNode, edges: edges.map(e => ({ u: e.from, v: e.to, w: parseInt(e.label) })) })
                }).then(res => res.json()).then(data => {
                    const results = data.distances.map((d, i) => `Node ${i}: ${d}`).join('<br>');
                    setStepLog(`<strong>Dijkstra Results:</strong><br>${results}`);
                    setSteps(buildDistanceSteps(numVertices, edges, data.distances));
                }).catch(e => {
                    console.error(e);
                    setStepLog('Error connecting to backend API. Using JS fallback.');
                    runDijkstra(numVertices, edges, sourceNode);
                });

            } catch (e) {
                alert("Could not parse inputs for Dijkstra's. Ensure they are in the correct format.");
            }
            break;

        case "Bellman-Ford":
            const verticesInputBF = document.getElementById("input-vertices").value;
            const edgesInputBF = document.getElementById("input-edges").value;
            const sourceInputBF = document.getElementById("input-source").value;

            try {
                const numVertices = parseInt(verticesInputBF);
                const sourceNode = parseInt(sourceInputBF);

                const edges = parseEdgeTriples(edgesInputBF, true);

                if (isNaN(numVertices) || isNaN(sourceNode) || edges.length === 0) {
                    alert("Invalid input for Bellman-Ford. Please check the format.");
                    return;
                }

                ensureGraphLayout();
                fetch("http://localhost:18080/api/bellmanford", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vertices: numVertices, source: sourceNode, edges: edges.map(e => ({ u: e.from, v: e.to, w: parseInt(e.label) })) })
                }).then(res => res.json()).then(data => {
                    const results = data.distances.map((d, i) => `Node ${i}: ${d == -1 ? "Unreachable" : d}`).join('<br>');
                    setStepLog(`<strong>Bellman-Ford Results:</strong><br>${results}`);
                    setSteps(buildDistanceSteps(numVertices, edges, data.distances));
                }).catch(err => {
                    setStepLog('Error connecting to backend API.');
                });
            } catch (e) {
                alert("Could not parse inputs for Bellman-Ford.");
            }
            break;

        case "Prim's Algorithm":
        case "Kruskal's Algorithm":
            const verticesInputMST = document.getElementById("input-vertices").value;
            const edgesInputMST = document.getElementById("input-edges").value;

            try {
                const numVertices = parseInt(verticesInputMST);
                const edges = parseEdgeTriples(edgesInputMST, false);

                if (isNaN(numVertices) || edges.length === 0) {
                    alert(`Invalid input for ${currentAlgorithm}. Please check the format.`);
                    return;
                }

                let endpoint = currentAlgorithm === "Prim's Algorithm" ? "prim" : "kruskal";

                ensureGraphLayout();
                fetch(`http://localhost:18080/api/${endpoint}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ vertices: numVertices, edges: edges.map(e => ({ u: e.from, v: e.to, w: parseInt(e.label) })) })
                }).then(res => res.json()).then(data => {
                    let edgeListHtml = "None";
                    if (data.mst_edges && data.mst_edges.length > 0) {
                        edgeListHtml = data.mst_edges.map(e => `(${e.u} - ${e.v})  Weight: ${e.w}`).join('<br>');
                    }
                    setStepLog(`<strong>MST Results (${currentAlgorithm}):</strong><br>Total Weight: ${data.totalWeight}<br>Edges:<br>${edgeListHtml}`);
                    setSteps(buildMstSteps(numVertices, edges, data.mst_edges || [], currentAlgorithm));
                }).catch(err => {
                    setStepLog('Error connecting to backend API.');
                });
            } catch (e) {
                alert(`Could not parse inputs for ${currentAlgorithm}.`);
            }
            break;

        case "Fractional Knapsack":
            const itemsInput = document.getElementById("input-items").value;
            const capacityInput = document.getElementById("input-capacity").value;

            try {
                const items = itemsInput.match(/\(\s*\d+\s*,\s*\d+\s*\)/g)?.map(s => {
                    const parts = s.replace(/[()\s]/g, "").split(',');
                    return { value: parseInt(parts[0]), weight: parseInt(parts[1]) };
                }) || [];
                const capacity = parseInt(capacityInput);

                if (items.length === 0 || isNaN(capacity)) {
                    alert("Invalid input for Fractional Knapsack. Please check the format.");
                    return;
                }

                // Call Backend API
                fetch("http://localhost:18080/api/knapsack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ capacity, items })
                }).then(res => res.json()).then(data => {
                    runFractionalKnapsack(items, capacity);
                }).catch(err => {
                    console.error(err);
                    setStepLog('Error connecting to backend API.');
                    runFractionalKnapsack(items, capacity);
                });
            } catch (e) {
                alert("Invalid input for Fractional Knapsack.");
            }
            break;

        case "Activity Selection":
            const activityInput = document.getElementById("input-activities").value;
            try {
                const acts = activityInput.match(/\(\s*\d+\s*,\s*\d+\s*\)/g)?.map(s => {
                    const parts = s.replace(/[()\s]/g, "").split(',');
                    return { start: parseInt(parts[0]), finish: parseInt(parts[1]) };
                }) || [];

                if (acts.length === 0) {
                    alert("Invalid input for Activity Selection.");
                    return;
                }

                fetch("http://localhost:18080/api/activity", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ activities: acts })
                }).then(res => res.json()).then(data => {
                    setSteps(buildActivitySteps(acts, data.selected || []));
                }).catch(e => {
                    setStepLog('Error connecting to backend API.');
                });
            } catch (e) {
                alert("Could not parse inputs for Activity Selection.");
            }
            break;

        case "Matrix Chain Multiplication":
            const dimInput = document.getElementById("input-dimensions").value;
            try {
                const dims = dimInput.split(',').map(s => parseInt(s.trim()));
                if (dims.length < 2 || dims.some(isNaN)) {
                    alert("Invalid dimensions format.");
                    return;
                }
                setSteps(buildMcmMatrixSteps(dims));
            } catch (e) {
                alert(e);
            }
            break;

        default:
            // Dummy steps for other algorithms
            steps = ["Step 1", "Step 2", "Step 3", "Step 4"];
            updateVisualization();
            updatePerformance();
            break;
    }
});

function runDijkstra(numVertices, edgeArray, startNode) {
    clearInterval(interval);
    interval = null;
    ensureGraphLayout();
    if (!ensureVisDataSets()) {
        setStepLog('Graph library not loaded. Add vis-network.min.js to the page.');
        return;
    }
    // 1. Create nodes and edges for vis.js
    const nodes = [];
    for (let i = 0; i < numVertices; i++) {
        nodes.push({ id: i, label: `Node ${i}` });
    }
    const edgesWithIds = edgeArray.map((edge, idx) => ({ ...edge, id: idx }));
    nodesDataSet.clear();
    edgesDataSet.clear();
    nodesDataSet.add(nodes);
    edgesDataSet.add(edgesWithIds);

    // 2. Initialize the graph for visualization
    const container = document.getElementById('graph-container');
    const data = { nodes: nodesDataSet, edges: edgesDataSet };
    const options = {
        edges: {
            arrows: {
                to: { enabled: true, scaleFactor: 1, type: 'arrow' }
            }
        }
    };
    network = new vis.Network(container, data, options);

    // 3. Initialize Dijkstra's algorithm
    steps = [];
    const dist = new Array(numVertices).fill(Infinity);
    const visited = new Array(numVertices).fill(false);
    dist[startNode] = 0;
    nodesDataSet.update({ id: startNode, color: { background: '#f0ad4e' } });

    const adjacency = new Array(numVertices).fill(0).map(() => []);
    edgesWithIds.forEach(edge => {
        const weight = parseInt(edge.label);
        adjacency[edge.from].push({ to: edge.to, weight, edgeId: edge.id });
        adjacency[edge.to].push({ to: edge.from, weight, edgeId: edge.id });
    });


    // Priority queue to store {node, distance}
    const pq = [{ node: startNode, dist: 0 }];

    steps.push({
        message: `Initializing Dijkstra's. Starting at node ${startNode}. Distances are set to infinity, except for the start node (0).`,
        dist: [...dist],
        nodes: nodesDataSet.get({ fields: ['id', 'color'] }),
        edges: edgesDataSet.get({ fields: ['id', 'color'] })
    });

    while (pq.length > 0) {
        // Sort pq to get the minimum distance node
        pq.sort((a, b) => a.dist - b.dist);
        const { node: u, dist: d } = pq.shift();

        if (visited[u]) continue;
        visited[u] = true;

        nodesDataSet.update({ id: u, color: { background: '#5cb85c' } });

        steps.push({
            message: `Visiting node ${u}. Current shortest distance is ${d}.`,
            dist: [...dist],
            nodes: nodesDataSet.get({ fields: ['id', 'color'] }),
            edges: edgesDataSet.get({ fields: ['id', 'color'] })
        });

        const neighbors = adjacency[u];
        for (const edge of neighbors) {
            const v = edge.to;
            const weight = edge.weight;
            if (!visited[v] && dist[u] + weight < dist[v]) {
                dist[v] = dist[u] + weight;
                pq.push({ node: v, dist: dist[v] });
                nodesDataSet.update({ id: v, color: { background: '#f0ad4e' } });
                edgesDataSet.update({ id: edge.edgeId, color: { color: '#f0ad4e' } });
                steps.push({
                    message: `Updating distance of node ${v} to ${dist[v]}.`,
                    dist: [...dist],
                    nodes: nodesDataSet.get({ fields: ['id', 'color'] }),
                    edges: edgesDataSet.get({ fields: ['id', 'color'] })
                });
            }
        }
    }

    // Final step
    steps.push({
        message: `Dijkstra's algorithm finished.`,
        dist: [...dist],
        nodes: nodesDataSet.get({ fields: ['id', 'color'] }),
        edges: edgesDataSet.get({ fields: ['id', 'color'] })
    });

    // Initial UI update
    updateVisualization();
    updatePerformance();
}

function runFractionalKnapsack(items, capacity) {
    clearInterval(interval);
    interval = null;
    steps = [];
    let currentWeight = 0;
    let finalValue = 0;

    // 1. Calculate density and sort
    items.forEach(item => item.density = item.value / item.weight);
    items.sort((a, b) => b.density - a.density);

    steps.push({
        message: "Calculated density (value/weight) and sorted items in descending order.",
        items: JSON.parse(JSON.stringify(items)), // Deep copy
        currentWeight,
        finalValue
    });

    // 2. Iterate through items
    for (const item of items) {
        if (currentWeight + item.weight <= capacity) {
            // Take the whole item
            currentWeight += item.weight;
            finalValue += item.value;
            steps.push({
                message: `Taking whole item (Value: ${item.value}, Weight: ${item.weight}).`,
                items: JSON.parse(JSON.stringify(items)),
                currentItem: item,
                takeFraction: 1,
                takenWeight: currentWeight,
                currentWeight,
                finalValue
            });
        } else {
            // Take a fraction of the item
            const remainingWeight = capacity - currentWeight;
            const fraction = remainingWeight / item.weight;
            finalValue += item.value * fraction;
            currentWeight += remainingWeight;
            steps.push({
                message: `Taking a fraction (${fraction.toFixed(2)}) of item (Value: ${item.value}, Weight: ${item.weight}).`,
                items: JSON.parse(JSON.stringify(items)),
                currentItem: item,
                takeFraction: fraction,
                takenWeight: currentWeight,
                currentWeight,
                finalValue
            });
            break; // Knapsack is full
        }
    }

    steps.push({
        message: `Knapsack is full. Final value is ${finalValue.toFixed(2)}.`,
        items: JSON.parse(JSON.stringify(items)),
        takeFraction: 0,
        takenWeight: currentWeight,
        currentWeight,
        finalValue
    });

    // Initial call to render the first step
    updateVisualization();
    updatePerformance();
}

// UPDATE VISUALIZATION
function updateVisualization() {
    if (steps.length === 0) {
        visualBox.innerHTML = "<p>Select inputs and run the algorithm</p>";
        return;
    }

    if (GRAPH_ALGOS.includes(currentAlgorithm)) {
        ensureGraphLayout();
    }

    const step = steps[currentStep];
    setStepLog(step.message || 'Step update');

    if (step.nodes || step.edges) {
        renderGraphStep(step);
        return;
    }

    if (step.items) {
        let html = '<div class="knapsack-array">';
        step.items.forEach(item => {
            const isCurrent = step.currentItem && step.currentItem.value === item.value && step.currentItem.weight === item.weight;
            const fill = isCurrent ? Math.round((step.takeFraction || 0) * 100) : 0;
            html += `
                <div class="knapsack-cell ${isCurrent ? 'current' : ''}">
                    <div class="knapsack-label">(${item.value}, ${item.weight})</div>
                    <div class="knapsack-density">d=${item.density.toFixed(2)}</div>
                    <div class="knapsack-bar"><div class="knapsack-fill" style="width: ${fill}%;"></div></div>
                </div>
            `;
        });
        html += '</div>';
        visualBox.innerHTML = html;
        return;
    }

    if (step.matrix) {
        const n = step.matrix.length - 1;
        let table = '<table class="mcm-table">';
        table += '<tr><th></th>';
        for (let j = 1; j <= n; j++) {
            table += `<th>A${j}</th>`;
        }
        table += '</tr>';
        for (let i = 1; i <= n; i++) {
            table += `<tr><th>A${i}</th>`;
            for (let j = 1; j <= n; j++) {
                const value = step.matrix[i][j];
                const text = value === null ? '-' : (value === Infinity ? '∞' : value);
                const isHighlight = step.highlight && step.highlight.i === i && step.highlight.j === j;
                const isDiag = i === j;
                table += `<td class="mcm-cell ${isHighlight ? 'mcm-highlight' : ''} ${isDiag ? 'mcm-diag' : ''}">${text}</td>`;
            }
            table += '</tr>';
        }
        table += '</table>';
        const detail = step.highlight && step.highlight.k !== undefined ? `<div class="mcm-split">Split k=${step.highlight.k}</div>` : '';
        visualBox.innerHTML = `<div>${detail}${table}</div>`;
        return;
    }

    if (step.activities) {
        const selectedSet = new Set((step.selected || []).map(a => `${a.start}-${a.finish}`));
        let html = '<div class="activity-block">';
        html += '<div class="activity-title">Sorted Activities</div>';
        html += '<div class="activity-array">';
        step.activities.forEach((a, idx) => {
            const key = `${a.start}-${a.finish}`;
            const isSelected = selectedSet.has(key);
            const isCandidate = step.candidateIndex === idx;
            const cellClass = isCandidate
                ? (step.reason && step.reason.startsWith('Selected') ? 'activity-candidate activity-selected' : 'activity-candidate activity-rejected')
                : (isSelected ? 'activity-selected' : '');
            html += `<div class="activity-cell ${cellClass}">(${a.start}, ${a.finish})</div>`;
        });
        html += '</div>';
        html += '<div class="activity-title">Selected</div>';
        html += '<div class="activity-array">';
        (step.selected || []).forEach(a => {
            html += `<div class="activity-cell activity-selected">(${a.start}, ${a.finish})</div>`;
        });
        html += '</div>';
        if (step.reason) {
            html += `<div class="activity-reason">${step.reason}</div>`;
        }
        html += '</div>';
        visualBox.innerHTML = html;
        return;
    }

    if (step.html) {
        visualBox.innerHTML = step.html;
    }
}

// UPDATE PERFORMANCE
function updatePerformance() {
    if (steps.length === 0) return;

    const lastStep = steps[steps.length - 1];
    let html = `<h3>PERFORMANCE</h3>`;

    switch (currentAlgorithm) {
        case "Dijkstra's Algorithm":
        case "Bellman-Ford":
            const distances = lastStep.distances || lastStep.dist || [];
            html += `
                <p>Time Complexity - ${currentAlgorithm === "Dijkstra's Algorithm" ? 'O(E log V)' : 'O(VE)'}</p>
                <p>Space Complexity - O(V)</p>
                <p>Total Steps - ${steps.length}</p>
                
                <h3>Final Distances</h3>
            `;
            distances.forEach((d, i) => {
                const value = d === Infinity || d === -1 ? '∞' : d;
                html += `<p>Node ${i}: ${value}</p>`;
            });
            break;

        case "Fractional Knapsack":
            const itemsInput = document.getElementById("input-items").value;
            const capacityInput = document.getElementById("input-capacity").value;

            html += `
                <p>Time Complexity - O(n log n)</p>
                <p>Space Complexity - O(n)</p>
                <p>Total Steps - ${steps.length}</p>
                
                <h3>Inputs</h3>
                <p>Items - ${itemsInput}</p>
                <p>Capacity - ${capacityInput}</p>
                <p>Optimal Value - ${lastStep.finalValue.toFixed(2)}</p>
            `;
            break;

        case "Prim's Algorithm":
        case "Kruskal's Algorithm":
            html += `
                <p>Time Complexity - O(E log V)</p>
                <p>Space Complexity - O(V)</p>
                <p>Total Steps - ${steps.length}</p>
            `;
            break;

        case "Activity Selection":
            html += `
                <p>Time Complexity - O(n log n)</p>
                <p>Space Complexity - O(n)</p>
                <p>Total Steps - ${steps.length}</p>
            `;
            break;

        case "Matrix Chain Multiplication":
            if (lastStep.minCost !== undefined) {
                html += `<p>Minimum Cost - ${lastStep.minCost}</p>`;
            }
            html += `
                <p>Time Complexity - O(n^3)</p>
                <p>Space Complexity - O(n^2)</p>
                <p>Total Steps - ${steps.length}</p>
            `;
            break;

        default:
            html += `
                <p>Execution Time - ${Math.floor(Math.random() * 10)} ms</p>
                <p>Time Complexity - O(n log n)</p>
                <p>Space Complexity - O(n)</p>
                <p>Total Steps - ${steps.length}</p>
            `;
            break;
    }

    perf.innerHTML = html;
}

function resetPerformance() {
    perf.innerHTML = `
    <h3>PERFORMANCE</h3>
    <p>Execution Time -</p>
    <p>Time Complexity -</p>
    <p>Space Complexity -</p>
    <p>Total Steps -</p>

    <h3>Inputs</h3>
    <p>Items -</p>
    <p>Capacity -</p>
    <p>Optimal Value -</p>
    `;
}

// CONTROLS

// BACK
controls[0].addEventListener("click", () => {
    if (currentStep > 0) {
        currentStep--;
        updateVisualization();
        updatePerformance();
    }
});

// PLAY
controls[1].addEventListener("click", () => {
    if (interval) return;

    interval = setInterval(() => {
        if (currentStep < steps.length - 1) {
            currentStep++;
            updateVisualization();
            updatePerformance();
        } else {
            clearInterval(interval);
            interval = null;
        }
    }, 800);
});

// FORWARD
controls[2].addEventListener("click", () => {
    if (currentStep < steps.length - 1) {
        currentStep++;
        updateVisualization();
        updatePerformance();
    }
});

// RESET
controls[3].addEventListener("click", () => {
    currentStep = 0;
    updateVisualization();
    updatePerformance();
    clearInterval(interval);
    interval = null;
});


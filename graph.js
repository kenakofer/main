$(document).ready(async function() {
    // Use a relative URL when running locally (file:) and remote URL when served from webserver
    const dataUrl = window.location.protocol === 'file:' ?
        "data/data1.0.json" :
        "https://raw.githubusercontent.com/greeny/SatisfactoryTools/refs/heads/master/data/data1.0.json";

    const { items, recipes } = await $.getJSON(dataUrl);
    
    // Filter items and recipes
    const filteredItems = Object.values(items).filter(item => item.stackSize !== 1);
    const filteredRecipes = Object.values(recipes).filter(recipe => 
        !recipe.alternate && recipe.inMachine && recipe.products
    );

    // Create nodes
    const nodes = new vis.DataSet(filteredItems.map(item => ({
        id: item.className,
        label: item.name,
        image: `https://www.satisfactorytools.com/assets/images/items/${item.icon}_64.png`,
        shape: 'image',
        title: `<b>${item.name}</b><br>${item.description}`
    })));

    // Create edges
    const edges = [];
    let edgeIdCounter = 0;

    filteredRecipes.forEach(recipe => {
        // Directed edges (ingredients -> products)
        recipe.products.forEach(product => {
            recipe.ingredients.forEach(ingredient => {
                edges.push({
                    id: `directed-${edgeIdCounter++}`,
                    from: ingredient.item,
                    to: product.item,
                    arrows: 'to',
                    color: '#28a745',
                    title: `<b>${recipe.name}</b><br>Produced in: ${recipe.producedIn.join(', ')}`
                });
            });
        });

        // Undirected co-ingredient edges
        if (recipe.ingredients.length > 1) {
            const ingredients = recipe.ingredients.map(i => i.item);
            for (let i = 0; i < ingredients.length; i++) {
                for (let j = i + 1; j < ingredients.length; j++) {
                    edges.push({
                        id: `undirected-${edgeIdCounter++}`,
                        from: ingredients[i],
                        to: ingredients[j],
                        dashes: [5,5],
                        color: '#007bff',
                        title: `<b>${recipe.name}</b><br>Produced in: ${recipe.producedIn.join(', ')}`,
                        physics: false
                    });
                }
            }
        }
    });

    // Network configuration
    const container = document.getElementById('network-container');
    const data = { nodes, edges: new vis.DataSet(edges) };
    
    const options = {
        nodes: {
            borderWidth: 1,
            size: 64,
            font: { size: 14 },
            shadow: true
        },
        edges: {
            smooth: false,
            width: 2,
            selectionWidth: 3
        },
        physics: {
            stabilization: true,
            barnesHut: {
                gravitationalConstant: -2000,
                springLength: 200,
                springConstant: 0.04
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 100
        }
    };

    const network = new vis.Network(container, data, options);

    // Control handlers (fixed version)
    $('#showUndirected').change(function() {
        const show = this.checked;
        data.edges.update(
            edges
                .filter(edge => edge.dashes)
                .map(edge => ({
                    id: edge.id,
                    hidden: !show
                }))
        );
    });

    $('#hideIsolated').change(function() {
        const hide = this.checked;
        const allEdges = edges.filter(e => !e.hidden);
        const connectedNodes = new Set(
            allEdges.flatMap(e => [e.from, e.to])
        );
        
        nodes.update(nodes.get().map(node => ({
            ...node,
            hidden: hide && !connectedNodes.has(node.id)
        })));
    });

    // Tooltip handling
    const tooltip = document.getElementById('tooltip');
    network.on("hoverNode", e => {
        const node = nodes.get(e.node);
        tooltip.innerHTML = node.title;
        tooltip.style.display = 'block';
    });
    
    network.on("hoverEdge", e => {
        const edge = edges[e.edge];
        tooltip.innerHTML = edge.title;
        tooltip.style.display = 'block';
    });

    network.on("blurNode", () => tooltip.style.display = 'none');
    network.on("blurEdge", () => tooltip.style.display = 'none');

    document.addEventListener('mousemove', e => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    });
});
$(document).ready(async function () {
    // Use a relative URL when running locally (file:) and remote URL when served from webserver
    const dataUrl = "data/data1.0.json";

    // Fetch data from JSON
    const { items, recipes } = await $.getJSON(dataUrl);

    // Filter items and recipes
    const filteredItems = Object.values(items).filter(item =>
        item.stackSize !== 1 &&
        // Name doesn't start with "Packaged "
        item.name.indexOf("Packaged ") !== 0
    );
    const filteredRecipes = Object.values(recipes).filter(recipe =>
        !recipe.alternate && recipe.inMachine && recipe.products &&
        !recipe.producedIn.every(machine =>
            machine === 'Desc_Converter_C' || machine === 'Desc_Packager_C')
    );

    // Define default visibility states
    const itemConfigs = [
        { className: 'Desc_SAMIngot_C', default: false },
        { className: 'Desc_Water_C', default: false },
        { className: 'Desc_Coal_C', default: false },
    ];

    // Create lookup for default visibility (defaulting to true if not specified)
    const defaultVisibility = Object.fromEntries(
        filteredItems.map(item => [
            item.className,
            itemConfigs.find(c => c.className === item.className)?.default ?? true
        ])
    );

    // Calculate complexity for each item
    const itemComplexity = {};
    const unassignedItems = new Set(filteredItems.map(item => item.className));
    const assignedItems = new Set();

    // Initialize all items with complexity 13
    filteredItems.forEach(item => {
        itemComplexity[item.className] = 13;
    });

    // Set of items to manually set 0 complexity
    const zeroComplexityItems = new Set([
        'Desc_OreCopper_C', 'Desc_OreIron_C', 'Desc_Stone_C',
        'Desc_OreUranium_C', 'Desc_Coal_C', 'Desc_OreGold_C',
        'Desc_LiquidOil_C', 'Desc_Water_C', 'Desc_NitrogenGas_C'
    ]);

    // Find items that are not a product of any recipe and set their complexity to 0
    filteredItems.forEach(item => {
        console.log(`Checking item ${item.className} (${item.name})`);
        // Debugging: for Desc_OreIron_C, print out what it's a product of
        if (item.className === 'Desc_OreIron_C') {
            const recipesForItem = filteredRecipes.filter(recipe =>
                recipe.products.some(product => product.item === item.className)
            );
            console.log(`Recipes for Desc_OreIron_C: ${recipesForItem.map(r => r.name).join(', ')}`);
        }

        if (zeroComplexityItems.has(item.className) || !filteredRecipes.some(recipe => recipe.products.some(product => product.item === item.className))) {
            itemComplexity[item.className] = 0;
            unassignedItems.delete(item.className);
            assignedItems.add(item.className);
            console.log(`Assigned complexity 0 to item ${item.className}`);
        }
    });

    let currentComplexity = 1;

    while (unassignedItems.size > 0) {
        const newlyAssigned = new Set();

        unassignedItems.forEach(itemClass => {
            if (filteredRecipes.some(recipe =>
                recipe.products.some(product => product.item === itemClass) &&
                recipe.ingredients.every(ingredient => assignedItems.has(ingredient.item))
            )) {
                itemComplexity[itemClass] = currentComplexity;
                newlyAssigned.add(itemClass);
            }
        });

        if (newlyAssigned.size === 0) {
            console.warn("No more items can be assigned a complexity, stopping to prevent infinite loop.");
            break;
        }

        newlyAssigned.forEach(itemClass => {
            unassignedItems.delete(itemClass);
            assignedItems.add(itemClass);
            console.log(`Assigned complexity ${currentComplexity} to item ${itemClass}`);
        });

        // Break after 99 iterations to prevent infinite loop
        if (currentComplexity >= 13) {
            console.warn("Complexity calculation exceeded max iterations, stopping to prevent infinite loop.");
            break;
        }

        currentComplexity++;
    }

    // Create nodes with complexity using vis.DataSet, then extract plain arrays for 3D rendering
    const visNodes = new vis.DataSet(filteredItems.map(item => ({
        id: item.className,
        label: item.name,
        image: `img/${item.icon}_64.png`,
        shape: 'image',
        myTitle: `<b>${item.name}</b><br>${item.description}`,
        complexity: itemComplexity[item.className],
        hidden: !defaultVisibility[item.className],
        physics: defaultVisibility[item.className]
    })));
    const nodesArray = visNodes.get();

    // Create edges as plain objects
    const edges = [];
    let edgeIdCounter = 0;

    filteredRecipes.forEach(recipe => {
        // Directed edges (ingredients -> products)
        recipe.products.forEach(product => {
            recipe.ingredients.forEach(ingredient => {
                // Check that the ingredient and product exist in the filtered items
                if (!filteredItems.some(item => item.className === ingredient.item) ||
                    !filteredItems.some(item => item.className === product.item)) {
                    console.warn(`Skipping edge creation for non-existent items: ${ingredient.item} or ${product.item}`);
                    return;
                }
                edges.push({
                    id: `directed-${edgeIdCounter++}`,
                    from: ingredient.item,
                    to: product.item,
                    arrows: 'to',
                    color: '#28a745',
                    myTitle: `<b>${recipe.name}</b><br>Produced in: ${recipe.producedIn.join(', ')}`
                });
            });
        });

    });

    // Instead of vis.Network, use ForceGraph3D for a 3D graph
    const container = document.getElementById('network-container');
    // Create a tooltip element in HTML with id="tooltip" for hover display if not already present
    const tooltip = document.getElementById('tooltip');

    const Graph = ForceGraph3D()(container)
        .graphData({ nodes: nodesArray, links: edges.map(e => ({ ...e, source: e.from, target: e.to })) })
        .nodeAutoColorBy('complexity')
        .nodeVal(node => {
            // Smaller complexity (closer relationship) gives larger value
            return node.hidden ? 1 : Math.max(5 - node.complexity, 1);
        })
        .linkWidth(1)
        .backgroundColor('#222')
        .onNodeHover(node => {
            if (node) {
                tooltip.innerHTML = node.myTitle;
                tooltip.style.display = 'block';
            } else {
                tooltip.style.display = 'none';
            }
        })
        .onLinkHover(link => {
            if (link) {
                tooltip.innerHTML = link.myTitle;
                tooltip.style.display = 'block';
            } else {
                tooltip.style.display = 'none';
            }
        });

    // Helper function to update the graph with transformed links
    function refreshGraph() {
        Graph.graphData({
            nodes: nodesArray,
            links: edges.map(e => ({ ...e, source: e.from, target: e.to }))
        });
    }

    // Create item checkboxes - Moved BEFORE network event triggers
    const itemCheckboxesContainer = $('#item-checkboxes');
    itemConfigs.forEach(config => {
        const item = filteredItems.find(i => i.className === config.className);
        if (!item) return;
        const checkboxId = `item-${config.className}`;
        const isChecked = config.default;
        const checkbox = $(`
            <div class="item-checkbox">
                <input type="checkbox" id="${checkboxId}" ${isChecked ? 'checked' : ''}>
                <label for="${checkboxId}">${item.name}</label>
            </div>
        `);
        itemCheckboxesContainer.append(checkbox);
        $(`#${checkboxId}`).change(function () {
            console.log(`Checkbox ${checkboxId} changed to ${this.checked}`);
            const show = this.checked;
            // Update the node's hidden and physics flags in nodesArray
            const node = nodesArray.find(n => n.id === item.className);
            if (node) {
                node.hidden = !show;
            }
            console.log(`Updated node ${item.className} to hidden: ${!show}`);
            refreshGraph();
        });
    });

    // Control handlers: update edges and nodes for checkboxes controlling graph view
    $('#showUndirected').change(function () {
        const show = this.checked;
        edges.forEach(edge => {
            if (edge.dashes) {
                edge.hidden = !show;
                edge.physics = show;  // Only enable physics when shown
            }
        });
        refreshGraph();
    });

    $('#hideIsolated').change(function () {
        const hide = this.checked;
        const connectedNodes = new Set();
        edges.forEach(edge => {
            if (!edge.hidden) {
                connectedNodes.add(edge.from);
                connectedNodes.add(edge.to);
            }
        });
        nodesArray.forEach(node => {
            node.hidden = hide && !connectedNodes.has(node.id);
            node.physics = !(hide && !connectedNodes.has(node.id));
        });
        refreshGraph();
    });

    $('#maxComplexity').change(function () {
        const maxComplexity = parseInt(this.value, 10);
        nodesArray.forEach(node => {
            node.hidden = node.complexity > maxComplexity;
            node.physics = node.complexity <= maxComplexity;
        });
        // Update edges connected to hidden nodes
        edges.forEach(edge => {
            const fromNode = nodesArray.find(n => n.id === edge.from);
            const toNode = nodesArray.find(n => n.id === edge.to);
            const isHidden = (fromNode ? fromNode.hidden : false) || (toNode ? toNode.hidden : false);
            edge.hidden = isHidden;
            edge.physics = !isHidden;
        });
        refreshGraph();
    });

    // Trigger control checkbox events initially
    $('#showUndirected').trigger('change');
    $('#hideIsolated').trigger('change');
    $('#maxComplexity').trigger('change');

    // Handle tooltip repositioning on mouse movement
    document.addEventListener('mousemove', e => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    });

    // Expose the graph instance for debugging if needed
    window.Graph3D = Graph;
});
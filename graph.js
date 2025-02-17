$(document).ready(async function () {
    // Use a relative URL when running locally (file:) and remote URL when served from webserver
    const dataUrl = "data/data1.0.json"

    const { items, recipes } = await $.getJSON(dataUrl);

    // Filter items and recipes
    const filteredItems = Object.values(items).filter(item => item.stackSize !== 1);
    const filteredRecipes = Object.values(recipes).filter(recipe =>
        !recipe.alternate && recipe.inMachine && recipe.products
    );

    // Define default visibility states
    const itemConfigs = [
        { className: 'Desc_SAMIngot_C', default: false },
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
    filteredItems.forEach(item => itemComplexity[item.className] = 13);

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

    // Create nodes with complexity
    const nodes = new vis.DataSet(filteredItems.map(item => ({
        id: item.className,
        label: item.name,
        image: `https://www.satisfactorytools.com/assets/images/items/${item.icon}_64.png`,
        shape: 'image',
        myTitle: `<b>${item.name}</b><br>${item.description}`,
        complexity: itemComplexity[item.className],
        hidden: !defaultVisibility[item.className],
        physics: defaultVisibility[item.className]
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
                    myTitle: `<b>${recipe.name}</b><br>Produced in: ${recipe.producedIn.join(', ')}`
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
                        dashes: [5, 5],
                        color: '#007bff',
                        myTitle: `<b>${recipe.name}</b><br>Produced in: ${recipe.producedIn.join(', ')}`,
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
            size: 32,
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
        }
    };

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
            nodes.update({
                id: item.className,
                hidden: !show,
                physics: show
            });
            console.log(`Updated node ${item.className} to hidden: ${!show}`);
            console.log(`Node data:`, nodes.get(item.className));
            const connectedEdges = edges.filter(edge =>
                edge.from === item.className || edge.to === item.className
            );
            data.edges.update(connectedEdges.map(edge => ({
                id: edge.id,
                hidden: !show ||
                    nodes.get(edge.from).hidden ||
                    nodes.get(edge.to).hidden,
                physics: show &&
                    !nodes.get(edge.from).hidden &&
                    !nodes.get(edge.to).hidden
            })));
            window.network.redraw();
        });
    });

    // Network initialization remains unchanged
    window.network = new vis.Network(container, data, options);

    // Wait for network stabilization before triggering checkbox events
    network.once('stabilizationIterationsDone', () => {
        triggerAllCheckboxes();
    });

    // Helper function to trigger all checkboxes
    function triggerAllCheckboxes() {
        // Works out here
        ['showUndirected', 'hideIsolated', 'maxComplexity']
            .forEach(id => $(`#${id}`).trigger('change'));

        console.log("Manually Triggering checkbox for item-Desc_SAMIngot_C");

        // For some extremely weird reason, the initial call to trigger the checkbox
        // will only update the network if it comes after the other checkbox triggers
        for (let i = 0; i < itemConfigs.length; i++) {
            const config = itemConfigs[i];
            const checkboxId = `item-${config.className}`;
            console.log(`Triggering checkbox for ${checkboxId}`);
            // log the jquery object to see if it exists
            // console.log($(`#${checkboxId}`));
            $(`#${checkboxId}`).trigger('change');
            // $('#item-Desc_SAMIngot_C').trigger('change')
        }
    }
    // Expose the function to the global scope for debugging
    window.triggerAllCheckboxes = triggerAllCheckboxes;

    // Control handlers (fixed version)
    $('#showUndirected').change(function () {
        const show = this.checked;
        data.edges.update(
            edges
                .filter(edge => edge.dashes)
                .map(edge => ({
                    id: edge.id,
                    hidden: !show,
                    physics: show  // Only enable physics when shown
                }))
        );
    });

    $('#hideIsolated').change(function () {
        const hide = this.checked;
        const allEdges = edges.filter(e => !e.hidden);
        const connectedNodes = new Set(
            allEdges.flatMap(e => [e.from, e.to])
        );

        nodes.update(nodes.get().map(node => ({
            ...node,
            hidden: hide && !connectedNodes.has(node.id),
            physics: !(hide && !connectedNodes.has(node.id))  // Only enable physics when shown
        })));
    });

    $('#maxComplexity').change(function () {
        const maxComplexity = parseInt(this.value, 13);
        nodes.update(nodes.get().map(node => ({
            ...node,
            hidden: node.complexity > maxComplexity,
            physics: node.complexity <= maxComplexity  // Only enable physics when shown
        })));

        // Also update edges connected to hidden nodes
        data.edges.update(edges.map(edge => {
            const fromNode = nodes.get(edge.from);
            const toNode = nodes.get(edge.to);
            const isHidden = fromNode.hidden || toNode.hidden;
            return {
                id: edge.id,
                hidden: isHidden,
                physics: !isHidden  // Only enable physics when shown
            };
        }));
    });

    // After all checkbox handlers are set up, trigger their change events
    // Only trigger control checkbox handlers
    $('#showUndirected').trigger('change');
    $('#hideIsolated').trigger('change');
    $('#maxComplexity').trigger('change');

    // Tooltip handling
    const tooltip = document.getElementById('tooltip');
    network.on("hoverNode", e => {
        const node = nodes.get(e.node);
        tooltip.innerHTML = node.myTitle;
        tooltip.style.display = 'block';
    });

    network.on("hoverEdge", e => {
        const edge = data.edges.get(e.edge); // Use data.edges.get to retrieve the edge
        if (!edge) {
            console.warn("Edge not found:", e.edge);
            return;
        }
        tooltip.innerHTML = edge.myTitle;
        tooltip.style.display = 'block';
    });

    network.on("blurNode", () => tooltip.style.display = 'none');
    network.on("blurEdge", () => tooltip.style.display = 'none');

    document.addEventListener('mousemove', e => {
        tooltip.style.left = `${e.pageX + 10}px`;
        tooltip.style.top = `${e.pageY + 10}px`;
    });
});
document.addEventListener("DOMContentLoaded", () => {
    // 1. Récupération des agents sauvegardés par la page principale
    const donneesAgents = localStorage.getItem("baseAgents");

    if (!donneesAgents) {
        alert("⚠️ Aucune donnée d'agent trouvée. Veuillez d'abord ouvrir la page RH (index.html) pour charger le tableau.");
        return;
    }

    const listeAgents = JSON.parse(donneesAgents);

    // 2. Génération de la Mind Map
    construireMindMap(listeAgents);
});

// Garder la fonction construireMindMap() inchangée ci-dessous...

// Fonction pour découper le CSV (séparateur point-virgule)
function analyserCSV(texte) {
    const lignes = texte.trim().split("\n");
    if (lignes.length < 2) return [];

    // Détection des en-têtes
    const entetes = lignes[0].split(";").map(e => e.trim().toLowerCase());
    const agents = [];

    for (let i = 1; i < lignes.length; i++) {
        if (!lignes[i].trim()) continue;
        
        const valeurs = lignes[i].split(";").map(v => v.trim());
        const agent = {};

        entetes.forEach((entete, index) => {
            agent[entete] = valeurs[index] || "";
        });

        agents.push(agent);
    }
    return agents;
}

// Fonction pour afficher la Mind Map
function construireMindMap(listeAgents) {
    const nodes = [];
    const edges = [];

    // 1. Nœud Central
    nodes.push({ 
        id: "CIS", 
        label: "🚒 Centre de Secours", 
        shape: "ellipse", 
        color: "#ef4444", 
        font: { color: "white", size: 22, face: "arial" } 
    });

    // 2. Nœuds de Branches Principales
    nodes.push({ id: "BRANCH_ENC", label: "🏢 Encadrement", shape: "box", color: "#3b82f6", font: { color: "white" } });
    edges.push({ from: "CIS", to: "BRANCH_ENC", length: 160 });

    nodes.push({ id: "BRANCH_EQ", label: "🚒 Équipes & Gardes", shape: "box", color: "#10b981", font: { color: "white" } });
    edges.push({ from: "CIS", to: "BRANCH_EQ", length: 160 });

    // 3. Extraction des équipes à partir du CSV
    const equipesUniques = [...new Set(listeAgents.map(a => a.equipe).filter(e => e && e.trim() !== ""))];

    equipesUniques.forEach(eq => {
        const eqId = `EQ_${eq}`;
        nodes.push({ id: eqId, label: `Équipe ${eq}`, shape: "box", color: "#059669", font: { color: "white" } });
        edges.push({ from: "BRANCH_EQ", to: eqId });
    });

    // 4. Positionnement des agents
    listeAgents.forEach((agent, idx) => {
        const agentId = `AGENT_${idx}`;
        const grade = agent.grade ? `${agent.grade} ` : '';
        const nomComplet = `${grade}${ (agent.nom || '').toUpperCase() } ${agent.prenom || ''}\n(${agent.fonction || 'Agent'})`;

        const fonctionTxt = (agent.fonction || '').toLowerCase();
        const estEncadrement = fonctionTxt.includes('chef') || fonctionTxt.includes('adjoint') || fonctionTxt.includes('bureau') || fonctionTxt.includes('responsable');

        if (estEncadrement) {
            nodes.push({ id: agentId, label: nomComplet, shape: "ellipse", color: "#60a5fa" });
            edges.push({ from: "BRANCH_ENC", to: agentId });
        } else if (agent.equipe) {
            nodes.push({ id: agentId, label: nomComplet, shape: "ellipse", color: "#34d399" });
            edges.push({ from: `EQ_${agent.equipe}`, to: agentId });
        }
    });

    // 5. Initialisation du réseau Vis.js
    const container = document.getElementById("mindmap");
    const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
    
    const options = {
        physics: {
            barnesHut: {
                gravitationalConstant: -4000,
                centralGravity: 0.3,
                springLength: 100
            }
        },
        interaction: { hover: true, zoomView: true, dragNodes: true }
    };

    new vis.Network(container, data, options);
}

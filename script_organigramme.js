let tousLesAgents = [];
let filtreActuel = 'TOUT';

document.addEventListener("DOMContentLoaded", () => {
    // 1. Récupération des données sauvegardées
    const donneesAgents = localStorage.getItem("baseAgents");

    if (!donneesAgents) {
        alert("⚠️ Aucune donnée d'agent trouvée dans le navigateur. Ouvrez d'abord la page RH principale.");
        return;
    }

    tousLesAgents = JSON.parse(donneesAgents);
    afficherColonnes();
});

function filtrerEffectifs(filtre, bouton) {
    filtreActuel = filtre;
    
    // Gestion des classes actives sur les boutons
    document.querySelectorAll('.filtre-btn').forEach(btn => btn.classList.remove('active'));
    if (bouton) bouton.classList.add('active');

    afficherColonnes();
}

function afficherColonnes() {
    const conteneur = document.getElementById("grille-equipes");
    conteneur.innerHTML = "";

    // Application du filtre sur les agents
    let agentsFiltres = tousLesAgents.filter(agent => {
        const statut = (agent.statut || '').toUpperCase();
        const equipe = (agent.equipe || '').trim();
        const fonction = (agent.fonction || '').toLowerCase();

        if (filtreActuel === 'TOUT') return true;
        if (filtreActuel === 'ENCADREMENT') {
            return fonction.includes('chef') || fonction.includes('adjoint') || fonction.includes('bureau') || fonction.includes('responsable');
        }
        if (filtreActuel === 'SPP') return statut.includes('SPP');
        if (filtreActuel === 'SPV') return statut.includes('SPV');
        
        // Filtre par équipe précise (ex: Équipe A, Équipe B, Équipe C, G12)
        return equipe.toLowerCase() === filtreActuel.toLowerCase();
    });

    // Récupération de la liste des équipes uniques présentes dans le résultat filtré
    let equipes = [...new Set(agentsFiltres.map(a => a.equipe ? a.equipe.trim() : "Non Affecté"))];
    equipes.sort();

    // Si le filtre Encadrement est sélectionné, regrouper dans une colonne dédiée
    if (filtreActuel === 'ENCADREMENT') {
        equipes = ["Encadrement & Direction"];
    }

    equipes.forEach(nomEquipe => {
        let membres = [];
        if (filtreActuel === 'ENCADREMENT') {
            membres = agentsFiltres;
        } else {
            membres = agentsFiltres.filter(a => (a.equipe ? a.equipe.trim() : "Non Affecté") === nomEquipe);
        }

        // Création du HTML de la colonne
        const col = document.createElement("div");
        col.className = "colonne-equipe";

        let html = `
            <div class="colonne-titre">
                <span>${nomEquipe}</span>
                <span class="badge-compteur">${membres.length}</span>
            </div>
            <div class="cartes-container">
        `;

        membres.forEach(agent => {
            const estSPP = (agent.statut || '').toUpperCase().includes('SPP');
            const classeStatut = estSPP ? 'spp' : 'spv';
            const grade = agent.grade || '-';
            const fonction = agent.fonction || 'Agent';
            const tpEng = agent.engagement || agent.tempsPartiel || '';

            html += `
                <div class="carte-agent ${classeStatut}">
                    <div class="carte-header">
                        <span>${grade}</span>
                        <span class="badge badge-statut">${agent.statut || 'SPP'}</span>
                    </div>
                    <div class="carte-nom">${agent.nom.toUpperCase()} ${agent.prenom}</div>
                    <div class="carte-details">
                        <span>${fonction}</span>
                        <span style="color:#60a5fa; font-weight:bold;">${tpEng}</span>
                    </div>
                    <div class="carte-badges">
                        ${genererBadgesHTML(agent.specialites)}
                    </div>
                </div>
            `;
        });

        html += `</div>`;
        col.innerHTML = html;
        conteneur.appendChild(col);
    });
}

// Fonction pour afficher les badges des spécialités (ex: SUAP)
function genererBadgesHTML(chaineTxt) {
    if (!chaineTxt || chaineTxt.trim() === "") return "";

    return chaineTxt.split(",")
        .map(i => i.trim())
        .filter(i => i.length > 0)
        .map(b => {
            const estSUAP = (b.toUpperCase() === "SUAP");
            const classeBadge = estSUAP ? "badge-suap" : "badge-autre";
            return `<span class="badge ${classeBadge}">${b}</span>`;
        }).join("");
}

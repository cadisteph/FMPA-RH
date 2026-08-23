let tousLesAgents = [];
let filtreActuel = 'TOUT';

// 1. DÉFINITION STRICTE DES HIÉRARCHIES
const ORDRE_FONCTIONS = [
    'CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 
    'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF',
    'CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'
];

const ORDRE_GRADES = [
    'CDT', 'CNE', 'LTN', 'ADC', 'ADJ', 'SCH', 'SGT', 'CCH', 'CPL', 'SAP'
];

document.addEventListener("DOMContentLoaded", () => {
    const donneesAgents = localStorage.getItem("baseAgents");

    if (!donneesAgents) {
        alert("⚠️ Aucune donnée d'agent trouvée. Ouvrez d'abord la page RH principale (index.html).");
        return;
    }

    tousLesAgents = JSON.parse(donneesAgents);
    afficherColonnes();
});

function filtrerEffectifs(filtre, bouton) {
    filtreActuel = filtre;
    
    document.querySelectorAll('.filtre-btn').forEach(btn => btn.classList.remove('active'));
    if (bouton) bouton.classList.add('active');

    afficherColonnes();
}

// Fonction utilitaire de nettoyage de texte
function normaliserTexte(txt) {
    if (!txt) return "";
    return txt.toString().trim().toUpperCase()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Supprime les accents
}

// Fonction de tri hiérarchique : Fonction -> Grade -> Nom -> Prénom
function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);

    let idxFA = ORDRE_FONCTIONS.indexOf(fA);
    let idxFB = ORDRE_FONCTIONS.indexOf(fB);
    if (idxFA === -1) idxFA = 999;
    if (idxFB === -1) idxFB = 999;

    if (idxFA !== idxFB) return idxFA - idxFB;

    // Égalité de fonction -> Tri par Grade
    const gA = normaliserTexte(a.grade);
    const gB = normaliserTexte(b.grade);

    let idxGA = ORDRE_GRADES.indexOf(gA);
    let idxGB = ORDRE_GRADES.indexOf(gB);
    if (idxGA === -1) idxGA = 999;
    if (idxGB === -1) idxGB = 999;

    if (idxGA !== idxGB) return idxGA - idxGB;

    // Égalité de grade -> Ordre alphabétique Nom puis Prénom
    const nomA = normaliserTexte(a.nom);
    const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB);

    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom));
}

function afficherColonnes() {
    const conteneur = document.getElementById("grille-equipes");
    conteneur.innerHTML = "";

    const filtreNorm = normaliserTexte(filtreActuel);

    // 1. Filtrage des agents
    let agentsFiltres = tousLesAgents.filter(agent => {
        const statut = normaliserTexte(agent.statut);
        const equipe = normaliserTexte(agent.equipe);
        const fonction = normaliserTexte(agent.fonction);

        if (filtreNorm === 'TOUT') return true;
        
        if (filtreNorm === 'ENCADREMENT') {
            const fonctionsEncadrement = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT'];
            return fonctionsEncadrement.includes(fonction) || fonction.includes('CHEF') || fonction.includes('RESPONSABLE');
        }

        if (filtreNorm === 'SPP') return statut.includes('SPP');
        if (filtreNorm === 'SPV') return statut.includes('SPV');

        // Recherche souple pour les équipes (ex: "EQUIPE A" ou "A")
        return equipe === filtreNorm || equipe.endsWith(" " + filtreNorm);
    });

    // 2. Détermination des colonnes à afficher
    let equipes = [];

    if (filtreNorm === 'ENCADREMENT') {
        equipes = ["Encadrement & Commandement"];
    } else if (filtreNorm !== 'TOUT' && filtreNorm !== 'SPP' && filtreNorm !== 'SPV') {
        // Si on filtre sur une équipe spécifique (ex: Équipe A)
        equipes = [filtreActuel];
    } else {
        // Si "Tous", "SPP" ou "SPV" -> On extrait toutes les équipes uniques
        equipes = [...new Set(agentsFiltres.map(a => normaliserTexte(a.equipe) || "NON AFFECTÉ"))];
        
        // Tri personnalisé des colonnes d'équipes
        equipes.sort((a, b) => {
            if (a.includes("A")) return -1;
            if (b.includes("A")) return 1;
            if (a.includes("B")) return -1;
            if (b.includes("B")) return 1;
            if (a.includes("C")) return -1;
            if (b.includes("C")) return 1;
            return a.localeCompare(b);
        });
    }

    // 3. Construction des colonnes et tri des membres
    equipes.forEach(nomEquipeNorm => {
        let membres = [];

        if (filtreNorm === 'ENCADREMENT') {
            membres = agentsFiltres;
        } else {
            membres = agentsFiltres.filter(a => {
                const eq = normaliserTexte(a.equipe) || "NON AFFECTÉ";
                return eq === nomEquipeNorm || eq.endsWith(" " + nomEquipeNorm);
            });
        }

        // Tri strict des membres selon la hiérarchie
        membres.sort(trierAgentsHierarchie);

        // Affichage du nom propre de l'équipe
        const nomEquipeLisible = membres.length > 0 && membres[0].equipe ? membres[0].equipe : nomEquipeNorm;

        const col = document.createElement("div");
        col.className = "colonne-equipe";

        let html = `
            <div class="colonne-titre">
                <span>${nomEquipeLisible}</span>
                <span class="badge-compteur">${membres.length}</span>
            </div>
            <div class="cartes-container">
        `;

        membres.forEach(agent => {
            const estSPP = normaliserTexte(agent.statut).includes('SPP');
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
                    <div class="carte-nom">${(agent.nom || '').toUpperCase()} ${agent.prenom || ''}</div>
                    <div class="carte-details">
                        <span class="fonction-tag">${fonction}</span>
                        <span style="color:#60a5fa; font-weight:bold;">${tpEng}</span>
                    </div>
                    
                    <!-- Spécialités -->
                    ${genererBadgesHTML(agent.specialites, 'specialite')}

                    <!-- Compétences -->
                    ${genererBadgesHTML(agent.competences, 'competence')}
                </div>
            `;
        });

        html += `</div>`;
        col.innerHTML = html;
        conteneur.appendChild(col);
    });
}

// Génération neutre des badges pour Spécialités et Compétences
function genererBadgesHTML(chaineTxt, type) {
    if (!chaineTxt || chaineTxt.trim() === "") return "";

    const elements = chaineTxt.split(",").map(i => i.trim()).filter(i => i.length > 0);
    if (elements.length === 0) return "";

    const couleurClass = (type === 'specialite') ? 'badge-spec' : 'badge-comp';

    return `
        <div class="carte-badges">
            ${elements.map(e => `<span class="badge ${couleurClass}">${e}</span>`).join("")}
        </div>
    `;
}

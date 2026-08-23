let tousLesAgents = [];
let filtreActuel = 'TOUT';

// DÉFINITION STRICTE DES HIÉRARCHIES
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

// Nettoyage complet pour la comparaison (sans accents, sans espaces en trop)
function normaliserTexte(txt) {
    if (!txt) return "";
    return txt.toString()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Supprime les accents
              .toUpperCase()
              .trim();
}

// Vérifie si un agent appartient à l'encadrement
function estAgentEncadrement(agent) {
    const fn = normaliserTexte(agent.fonction);
    const fonctionsEncadrement = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF'];
    return fonctionsEncadrement.includes(fn) || fn.includes('CHEF') || fn.includes('RESPONSABLE');
}

// Algorithme de tri hiérarchique : Fonction -> Grade -> Nom -> Prénom
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

    // 1. Filtrage des agents selon le filtre sélectionné
    let agentsFiltres = tousLesAgents.filter(agent => {
        const statut = normaliserTexte(agent.statut);
        const equipe = normaliserTexte(agent.equipe);

        if (filtreNorm === 'TOUT') return true;
        if (filtreNorm === 'ENCADREMENT') return estAgentEncadrement(agent);
        if (filtreNorm === 'SPP') return statut.includes('SPP');
        if (filtreNorm === 'SPV') return statut.includes('SPV');

        // Comparaison souple pour les équipes (ex: "EQUIPE A", "ÉQUIPE A", "A")
        const termeFiltre = filtreNorm.replace("EQUIPE", "").trim();
        const termeEquipe = equipe.replace("EQUIPE", "").trim();

        return equipe === filtreNorm || termeEquipe === termeFiltre;
    });

    // 2. Organisation des colonnes d'affichage
    let listeColonnes = [];

    if (filtreNorm === 'ENCADREMENT') {
        listeColonnes = [{ titre: "Encadrement & Direction", identifiant: "ENCADREMENT" }];
    } else if (filtreNorm !== 'TOUT' && filtreNorm !== 'SPP' && filtreNorm !== 'SPV') {
        // Filtre sur une équipe spécifique
        listeColonnes = [{ titre: filtreActuel, identifiant: filtreNorm }];
    } else {
        // Mode "TOUT", "SPP" ou "SPV" -> On regroupe les agents
        // A. Colonne Encadrement en premier (si des agents d'encadrement existent dans la sélection)
        const aDesCadres = agentsFiltres.some(a => estAgentEncadrement(a));
        if (aDesCadres) {
            listeColonnes.push({ titre: "Encadrement", identifiant: "ENCADREMENT" });
        }

        // B. Extraction des autres équipes uniques (hors encadrement)
        let equipesUniques = [...new Set(
            agentsFiltres
                .filter(a => !estAgentEncadrement(a))
                .map(a => a.equipe ? a.equipe.trim() : "NON AFFECTÉ")
        )];

        // Tri alphabétique des colonnes d'équipes (A, B, C, G12...)
        equipesUniques.sort((a, b) => a.localeCompare(b));

        equipesUniques.forEach(eq => {
            listeColonnes.push({ titre: eq, identifiant: normaliserTexte(eq) });
        });
    }

    // 3. Rendu HTML des colonnes
    listeColonnes.forEach(colInfo => {
        let membres = [];

        if (colInfo.identifiant === "ENCADREMENT") {
            membres = agentsFiltres.filter(a => estAgentEncadrement(a));
        } else {
            const idNorm = colInfo.identifiant;
            membres = agentsFiltres.filter(a => {
                if (filtreNorm === 'TOUT' && estAgentEncadrement(a)) return false; // Évite les doublons dans TOUT
                
                const eq = normaliserTexte(a.equipe);
                const termeCol = idNorm.replace("EQUIPE", "").trim();
                const termeEq = eq.replace("EQUIPE", "").trim();

                return eq === idNorm || termeEq === termeCol;
            });
        }

        if (membres.length === 0) return;

        // Tri des agents dans la colonne
        membres.sort(trierAgentsHierarchie);

        const col = document.createElement("div");
        col.className = "colonne-equipe";

        let html = `
            <div class="colonne-titre">
                <span>${colInfo.titre}</span>
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
                    
                    ${genererBadgesHTML(agent.specialites, 'specialite')}
                    ${genererBadgesHTML(agent.competences, 'competence')}
                </div>
            `;
        });

        html += `</div>`;
        col.innerHTML = html;
        conteneur.appendChild(col);
    });
}

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

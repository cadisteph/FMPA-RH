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
    chargerFichierExcel();
});

/**
 * Charge directement le fichier FMPA-RH.xlsx à la racine sans passer par localStorage
 */
async function chargerFichierExcel() {
    const cheminFichier = "FMPA-RH.xlsx";

    try {
        const response = await fetch(cheminFichier);
        if (!response.ok) {
            throw new Error(`Statut HTTP : ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });

        const premierNomFeuille = workbook.SheetNames[0];
        const feuille = workbook.Sheets[premierNomFeuille];

        const donneesBrutes = XLSX.utils.sheet_to_json(feuille, { defval: "" });

        // Normalisation et correspondance des en-têtes Excel vers la structure agent
        tousLesAgents = donneesBrutes.map(item => ({
            nom: item["NOM"] || item["Nom"] || "",
            prenom: item["PRENOM"] || item["Prénom"] || item["Prenom"] || "",
            grade: item["GRADE"] || item["Grade"] || "",
            fonction: item["FONCTION"] || item["Fonction"] || "",
            equipe: item["EQUIPE"] || item["Équipe"] || item["Equipe"] || "",
            statut: item["STATUT"] || item["Statut"] || "",
            departement: item["DEPARTEMENT"] || item["Département"] || item["Departement"] || "",
            specialites: item["SPECIALITE"] || item["Spécialité"] || item["SPECIALITES"] || item["Spécialités"] || "",
            competences: item["COMPETENCE"] || item["Compétence"] || item["COMPETENCES"] || item["Compétences"] || ""
        }));

        afficherColonnes();

    } catch (erreur) {
        console.error("Erreur lors de la lecture du fichier Excel :", erreur);
        alert("⚠️ Impossible de charger l'organigramme depuis FMPA-RH.xlsx. Vérifiez la présence du fichier Excel.");
    }
}

function filtrerEffectifs(filtre, bouton) {
    filtreActuel = filtre;
    
    document.querySelectorAll('.filtre-btn').forEach(btn => btn.classList.remove('active'));
    if (bouton) bouton.classList.add('active');

    afficherColonnes();
}

// Nettoyage complet pour la comparaison
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
    const eq = normaliserTexte(agent.equipe);
    const statut = normaliserTexte(agent.statut);

    // EXCEPTION : Les SPV restent rattachés à leur équipe/statut, pas à la colonne Encadrement générale
    if (statut.includes('SPV')) {
        return false;
    }

    const fonctionsEncadrement = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF'];
    
    return fonctionsEncadrement.includes(fn) || 
           fn.includes('CHEF') || 
           fn.includes('RESPONSABLE') || 
           eq.includes('ENCADREMENT');
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

    // Détermine si on est sur le filtre SPP Garde
    const estFiltreSPPGarde = (filtreNorm === 'SPP_GARDE' || filtreNorm === 'SPP GARDE' || filtreNorm === 'SPP');

    // 1. Filtrage des agents selon le bouton actif
    let agentsFiltres = tousLesAgents.filter(agent => {
        const statut = normaliserTexte(agent.statut);
        const equipe = normaliserTexte(agent.equipe);
        const fn = normaliserTexte(agent.fonction);

        if (filtreNorm === 'TOUT') return true;
        
        if (filtreNorm === 'ENCADREMENT') {
            const fonctionsEncadrement = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF'];
            return estAgentEncadrement(agent) || fonctionsEncadrement.includes(fn);
        }
        
        if (estFiltreSPPGarde) {
            return statut.includes('SPP') && !estAgentEncadrement(agent);
        }

        if (filtreNorm === 'SPV') return statut.includes('SPV');

        const termeFiltre = filtreNorm.replace("EQUIPE", "").trim();
        const termeEquipe = equipe.replace("EQUIPE", "").trim();

        return equipe === filtreNorm || termeEquipe === termeFiltre;
    });

    // 2. Organisation unique des colonnes
    let listeColonnes = [];

    if (filtreNorm === 'ENCADREMENT') {
        listeColonnes = [{ titre: "Encadrement", identifiant: "ENCADREMENT" }];
    } else if (filtreNorm !== 'TOUT' && !estFiltreSPPGarde && filtreNorm !== 'SPV') {
        listeColonnes = [{ titre: filtreActuel, identifiant: filtreNorm }];
    } else {
        const aDesCadres = agentsFiltres.some(a => estAgentEncadrement(a));
        if (aDesCadres && !estFiltreSPPGarde) {
            listeColonnes.push({ titre: "Encadrement", identifiant: "ENCADREMENT" });
        }

        let equipesUniques = [...new Set(
            agentsFiltres
                .filter(a => !estAgentEncadrement(a))
                .map(a => a.equipe ? a.equipe.trim() : "NON AFFECTÉ")
        )].filter(eq => normaliserTexte(eq) !== 'ENCADREMENT');

        equipesUniques.sort((a, b) => a.localeCompare(b));

        equipesUniques.forEach(eq => {
            listeColonnes.push({ titre: eq, identifiant: normaliserTexte(eq) });
        });
    }

    // 3. Rendu HTML ULTRA-COMPACT
    listeColonnes.forEach(colInfo => {
        let membres = [];

        if (colInfo.identifiant === "ENCADREMENT") {
            membres = agentsFiltres.filter(a => estAgentEncadrement(a));
        } else {
            const idNorm = colInfo.identifiant;

            membres = agentsFiltres.filter(a => {
                if (estAgentEncadrement(a)) return false;
                
                const eq = normaliserTexte(a.equipe);
                const termeCol = idNorm.replace("EQUIPE", "").trim();
                const termeEq = eq.replace("EQUIPE", "").trim();

                return eq === idNorm || termeEq === termeCol;
            });
        }

        if (membres.length === 0) return;

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
            const statutNorm = normaliserTexte(agent.statut);
            
            let classeStatut = 'spp';
            if (statutNorm.includes('SPV')) {
                classeStatut = 'spv';
            } else if (statutNorm.includes('PATS')) {
                classeStatut = 'pats';
            }

            // Éléments de la Ligne 1
            const grade = agent.grade ? `<span class="grade-tag">${agent.grade}</span>` : '';
            const fonction = agent.fonction ? `<span class="fonction-tag">${agent.fonction}</span>` : '';
            const nomPrenom = `<strong>${(agent.nom || '').toUpperCase()}</strong> ${agent.prenom || ''}`;

            // Éléments de la Ligne 2 (Département + Compétences/Spécialités)
            const dep = agent.departement ? `<span class="dep-tag">Dép:${agent.departement}</span>` : '';
            
            let compList = [];
            if (agent.specialites) compList.push(agent.specialites);
            if (agent.competences) compList.push(agent.competences);
            
            let listeTexte = compList.join(', ').split(',').map(s => s.trim()).filter(s => s.length > 0);
            const spes = listeTexte.length > 0 ? `<span class="spes-tag">[${listeTexte.join(', ')}]</span>` : '';

            // Rendu : Ligne 1 (Grade Nom Prénom Fonction) / Ligne 2 (Spécialités)
            html += `
                <div class="carte-agent ${classeStatut}">
                    <div class="carte-nom">
                        ${grade} ${nomPrenom} ${fonction}
                    </div>
                    ${(dep || spes) ? `
                    <div class="carte-details">
                        ${dep}
                        ${spes}
                    </div>` : ''}
                </div>
            `;
        });

        html += `</div>`;
        col.innerHTML = html;
        conteneur.appendChild(col);
    });
}

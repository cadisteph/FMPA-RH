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

/**
 * Fonction appelée uniquement quand l'utilisateur choisit son fichier Excel
 */
function importerFichierExcelManuel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        traiterDonneesExcel(arrayBuffer);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Traitement du fichier Excel en mémoire vive (RAM uniquement)
 */
function traiterDonneesExcel(arrayBuffer) {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const premierNomFeuille = workbook.SheetNames[0];
        const feuille = workbook.Sheets[premierNomFeuille];

        const donneesBrutes = XLSX.utils.sheet_to_json(feuille, { defval: "" });

        // Passage du bouton en style bleu fixe après le chargement réussi
        const btnExcel = document.getElementById("btn-reseau-clignotant");
        if (btnExcel) {
            btnExcel.classList.add("connecte");

        const btn = document.getElementById("btn-connect-file");
        if (btn) {
            btn.classList.add("connecte");
            btn.innerHTML = "🌐 Réseau connecté";


            
        }

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
    } catch (err) {
        alert("⚠️ Erreur lors de la lecture du fichier Excel.");
        console.error(err);
    }
}

function filtrerEffectifs(filtre, bouton) {
    filtreActuel = filtre;
    
    document.querySelectorAll('.filtre-btn').forEach(btn => btn.classList.remove('active'));
    if (bouton) bouton.classList.add('active');

    afficherColonnes();
}

function normaliserTexte(txt) {
    if (!txt) return "";
    return txt.toString()
              .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
              .toUpperCase()
              .trim();
}

function estAgentEncadrement(agent) {
    const fn = normaliserTexte(agent.fonction);
    const eq = normaliserTexte(agent.equipe);
    const statut = normaliserTexte(agent.statut);

    if (statut.includes('SPV')) {
        return false;
    }

    const fonctionsEncadrement = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'SOFPAO', 'SOFTECH', 'ASSISTANTE', 'SECRETARIAT', 'ADMINISTRATIF'];
    
    return fonctionsEncadrement.includes(fn) || 
           fn.includes('CHEF') || 
           fn.includes('RESPONSABLE') || 
           eq.includes('ENCADREMENT');
}

function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);

    let idxFA = ORDRE_FONCTIONS.indexOf(fA);
    let idxFB = ORDRE_FONCTIONS.indexOf(fB);
    if (idxFA === -1) idxFA = 999;
    if (idxFB === -1) idxFB = 999;

    if (idxFA !== idxFB) return idxFA - idxFB;

    const gA = normaliserTexte(a.grade);
    const gB = normaliserTexte(b.grade);

    let idxGA = ORDRE_GRADES.indexOf(gA);
    let idxGB = ORDRE_GRADES.indexOf(gB);
    if (idxGA === -1) idxGA = 999;
    if (idxGB === -1) idxGB = 999;

    if (idxGA !== idxGB) return idxGA - idxGB;

    const nomA = normaliserTexte(a.nom);
    const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB);

    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom));
}

function afficherColonnes() {
    const conteneur = document.getElementById("grille-equipes");
    conteneur.innerHTML = "";

    if (tousLesAgents.length === 0) {
        conteneur.innerHTML = `<div style="padding: 20px; color: #cbd5e1; font-style: italic;">Veuillez charger le fichier Excel FMPA-RH.xlsx à l'aide du bouton ci-dessus.</div>`;
        return;
    }

    const filtreNorm = normaliserTexte(filtreActuel);
    const estFiltreSPPGarde = (filtreNorm === 'SPP_GARDE' || filtreNorm === 'SPP GARDE' || filtreNorm === 'SPP');

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

            const grade = agent.grade ? `<span class="grade-tag">${agent.grade}</span>` : '';
            const fonction = agent.fonction ? `<span class="fonction-tag">${agent.fonction}</span>` : '';
            const nomPrenom = `<strong>${(agent.nom || '').toUpperCase()}</strong> ${agent.prenom || ''}`;

            const dep = agent.departement ? `<span class="dep-tag">Dép:${agent.departement}</span>` : '';
            
            let compList = [];
            if (agent.specialites) compList.push(agent.specialites);
            if (agent.competences) compList.push(agent.competences);
            
            let listeTexte = compList.join(', ').split(',').map(s => s.trim()).filter(s => s.length > 0);
            const spes = listeTexte.length > 0 ? `<span class="spes-tag">[${listeTexte.join(', ')}]</span>` : '';

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

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

let fileHandle = null;

/**
 * Sélection du fichier via l'API File System Access
 */
async function lierFichierReseau() {
    try {
        [fileHandle] = await window.showOpenFilePicker({
            types: [{
                description: 'Fichier Excel FMPA-RH',
                accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
            }],
            multiple: false
        });

        const file = await fileHandle.getFile();
        const arrayBuffer = await file.arrayBuffer();
        traiterDonneesExcel(arrayBuffer);

    } catch (err) {
        if (err.name !== 'AbortError') {
            console.error("Erreur de sélection :", err);
            alert("L'accès au fichier Excel a échoué.");
        }
    }
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

        // Modification du texte et passage du bouton en bleu fixe
        const btnExcel = document.getElementById("btn-reseau-clignotant");
        if (btnExcel) {
            btnExcel.innerText = "🌐 Réseau Connecté";
            btnExcel.classList.add("connecte");          
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

calculerBesoins();
    

}








/**
 * Calcule les besoins avec glissement de fonctions :
 * Ne consomme l'excédent QUE pour combler un manque sous-jacent.
 */
function calculerBesoins() {
    const fonctionsCibles = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];
    const compts = { CDG: 0, ACDG1: 0, ACDG2: 0, CATE: 0, CA1E: 0, CEQU: 0, EQU: 0 };

    // 1. Comptage des agents dans les colonnes de garde (A, B, C, G12)
    const colonnes = document.querySelectorAll('.colonne-equipe');

    colonnes.forEach(col => {
        const titreEl = col.querySelector('.colonne-titre');
        const titreText = titreEl ? titreEl.innerText.toUpperCase() : '';

        if (titreText.includes('ENCADREMENT') || titreText.includes('SPV')) return;

        const cartes = col.querySelectorAll('.carte-agent');

        cartes.forEach(carte => {
            if (carte.classList.contains('spv') || carte.classList.contains('pats')) return;

            const elFonction = carte.querySelector('.fonction-tag');
            if (!elFonction) return;

            const fn = elFonction.innerText.trim().toUpperCase();

            if (fn === 'CDG' || fn === 'CDC') compts.CDG++;
            else if (fn === 'ACDG1' || fn === 'ACDG 1') compts.ACDG1++;
            else if (fn === 'ACDG2' || fn === 'ACDG 2') compts.ACDG2++;
            else if (fn === 'CATE') compts.CATE++;
            else if (fn === 'CA1E') compts.CA1E++;
            else if (fn === 'CEQU') compts.CEQU++;
            else if (fn === 'EQU') compts.EQU++;
        });
    });

    // 2. Traitement hors cascade (CDG, ACDG1, ACDG2)
    let manqueTotalGlobal = 0;

    ['CDG', 'ACDG1', 'ACDG2'].forEach(code => {
        const dispo = compts[code] || 0;
        const elDisp = document.getElementById(`disp-${code}`);
        if (elDisp) elDisp.innerText = dispo;

        const inputCible = document.getElementById(`cible-${code}`);
        if (inputCible) {
            localStorage.setItem(`cible_${code}`, inputCible.value);
            const cible = parseInt(inputCible.value, 10) || 0;
            const delta = dispo - cible;

            if (delta < 0) manqueTotalGlobal += Math.abs(delta);
            afficherResultatCase(code, { status: delta < 0 ? 'manque' : (delta === 0 ? 'ok' : 'surplus'), val: delta });
        }
    });

    // 3. Calcul de la cascade CATE -> CA1E -> CEQU -> EQU
    const ordreCascade = ['CATE', 'CA1E', 'CEQU', 'EQU'];
    const etats = {};

    // Étape A : Calcul des deltas bruts
    ordreCascade.forEach(code => {
        const dispo = compts[code] || 0;
        const elDisp = document.getElementById(`disp-${code}`);
        if (elDisp) elDisp.innerText = dispo;

        const inputCible = document.getElementById(`cible-${code}`);
        let cible = 0;
        if (inputCible) {
            localStorage.setItem(`cible_${code}`, inputCible.value);
            cible = parseInt(inputCible.value, 10) || 0;
        }

        etats[code] = {
            dispo: dispo,
            cible: cible,
            deltaBrut: dispo - cible,
            comblePar: null,
            transfereVers: null
        };
    });

    // Étape B : Application des transferts de haut en bas
    for (let i = 0; i < ordreCascade.length; i++) {
        const srcCode = ordreCascade[i];
        
        // S'il y a un surplus sur cette fonction
        if (etats[srcCode].deltaBrut > 0) {
            let surplusDisponible = etats[srcCode].deltaBrut;

            // Chercher une fonction en dessous qui a besoin de renfort
            for (let j = i + 1; j < ordreCascade.length; j++) {
                const destCode = ordreCascade[j];
                const besDest = etats[destCode].cible - etats[destCode].dispo;

                if (besDest > 0 && !etats[destCode].comblePar) {
                    // On comble le besoin au maximum du surplus disponible
                    etats[destCode].comblePar = srcCode;
                    etats[srcCode].transfereVers = destCode;
                    
                    // Ajustement du surplus disponible si consommé
                    if (surplusDisponible >= besDest) {
                        surplusDisponible -= besDest;
                        break; // Le besoin de la cible est totalement couvert
                    } else {
                        break;
                    }
                }
            }
        }
    }

    // Étape C : Affichage dynamique des résultats
    ordreCascade.forEach(code => {
        const item = etats[code];
        const deltaBrut = item.deltaBrut;

        if (deltaBrut < 0) {
            if (item.comblePar) {
                // Le déficit local est couvert par un rang supérieur
                afficherResultatCase(code, { status: 'comble', source: item.comblePar });
            } else {
                // Il manque toujours des agents
                manqueTotalGlobal += Math.abs(deltaBrut);
                afficherResultatCase(code, { status: 'manque', val: Math.abs(deltaBrut) });
            }
        } else if (deltaBrut === 0) {
            afficherResultatCase(code, { status: 'ok' });
        } else { // deltaBrut > 0
            if (item.transfereVers) {
                afficherResultatCase(code, { status: 'transfere', val: deltaBrut, dest: item.transfereVers });
            } else {
                afficherResultatCase(code, { status: 'surplus', val: deltaBrut });
            }
        }
    });

    // 4. Récapitulatif global
    const elRecap = document.getElementById("recap-besoins-global");
    if (elRecap) {
        if (manqueTotalGlobal > 0) {
            elRecap.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Déficit SPP Garde : ${manqueTotalGlobal} agent(s) manquant(s)</span>`;
        } else {
            elRecap.innerHTML = `<span style="color:#22c55e; font-weight:bold;">Toutes les cibles sont couvertes</span>`;
        }
    }
}

/**
 * Gestion précise des libellés d'affichage
 */
function afficherResultatCase(code, res) {
    const elRes = document.getElementById(`res-${code}`);
    if (!elRes) return;

    switch (res.status) {
        case 'manque':
            elRes.innerHTML = `<span style="color:#ef4444; font-weight:bold;">Manque ${res.val}</span>`;
            break;
        case 'ok':
            elRes.innerHTML = `<span style="color:#38bdf8; font-weight:bold;">OK (Complet)</span>`;
            break;
        case 'comble':
            elRes.innerHTML = `<span style="color:#38bdf8; font-weight:bold;">OK (comblé par ${res.source})</span>`;
            break;
        case 'transfere':
            elRes.innerHTML = `<span style="color:#22c55e; font-weight:bold;">+${res.val} (transfert vers ${res.dest})</span>`;
            break;
        case 'surplus':
            elRes.innerHTML = `<span style="color:#22c55e; font-weight:bold;">+${res.val} en rabe</span>`;
            break;
    }
}

let agentsLocaux = [];
let propositionsEnAttente = [];

// ORDRE HIÉRARCHIQUE DES FONCTIONS EXACT : CDG -> ACDG1 -> ACDG2 -> CATE -> CA1E -> CEQU -> EQU
const ORDRE_FONCTIONS = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEqu', 'Equ'];

document.addEventListener("DOMContentLoaded", () => {
    const data = localStorage.getItem("baseAgents");
    
    if (!data) {
        console.warn("⚠️ Aucune donnée 'baseAgents' trouvée dans le localStorage.");
        alert("Attention : Aucune donnée d'agent n'a été trouvée. Veuille réimporter ton fichier CSV depuis la page principale.");
        return;
    }

    try {
        const tousLesAgents = JSON.parse(data);
        
        agentsLocaux = tousLesAgents.filter(a => {
            if (!a) return false;
            const eq = normaliserTexte(a.equipe);
            const fn = normaliserTexte(a.fonction);
            const st = normaliserTexte(a.statut);
            const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
            return st.includes('SPP') && !estCadre;
        });

        agentsLocaux.forEach((a, index) => {
            if (!a.idUnique) a.idUnique = a.matricule || `agent_${index}`;
            if (a.verrouille === undefined) a.verrouille = false;
        });

        genererControlesDynamiques();
        rendreEquipes();
    } catch (e) {
        console.error("Erreur de lecture des données :", e);
        alert("Erreur lors de la lecture des données d'agents. Réimportation du CSV requise.");
    }
});

function estFemme(agent) {
    if (!agent || !agent.sexe) return false;
    // Vérifie si le champ contient "Femme" ou "F" (sans se soucier des majuscules/minuscules)
    const val = String(agent.sexe).trim().toLowerCase();
    return val === 'femme' || val === 'f';
}

// Permet de nettoyer ou regrouper les spécialités/compétences
function traiterNomItem(itemStr, conserverNiveau = true) {
    if (!itemStr) return '';
    const nettoye = itemStr.trim().toUpperCase();
    if (conserverNiveau) return nettoye; 
    // Si conserverNiveau est false, enlève les chiffres à la fin (ex: RAD2 -> RAD, RCH1 -> RCH)
    return nettoye.replace(/\d+$/, ''); 
}


function normaliserTexte(txt) {
    if (!txt) return "";
    return txt.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
}

function extraireLettreEquipe(nomEquipe) {
    const norm = normaliserTexte(nomEquipe);
    if (norm.includes('A')) return 'A';
    if (norm.includes('B')) return 'B';
    if (norm.includes('C')) return 'C';
    return '';
}

function calculerAge(dateNaissance) {
    if (!dateNaissance) return 35;
    const d = new Date(dateNaissance);
    if (isNaN(d.getTime())) return 35;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function extraireDepartement(agent) {
    const texte = `${agent.codePostal || ''} ${agent.commune || ''} ${agent.domiciliation || ''} ${agent.adresse || ''}`;
    const match = texte.match(/\b(2[AB]|\d{2})\d{3}\b/);
    if (match) return match[1];
    if (agent.departement) return agent.departement.toString().trim();
    return "ND";
}

function extraireItems(chaine) {
    if (!chaine) return [];
    return chaine.split(/[,;\/-]+/).map(s => normaliserTexte(s)).filter(s => s.length > 1);
}

/**
 * Génère automatiquement une barre de pondération pour CHAQUE spécialité 
 * et CHAQUE compétence présente dans les données des agents.
 */
function genererControlesDynamiques() {
    const ensembleSpecs = new Set();
    const ensembleComps = new Set();

    agentsLocaux.forEach(a => {
        extraireItems(a.specialites).forEach(s => ensembleSpecs.add(s));
        extraireItems(a.competences).forEach(c => ensembleComps.add(c));
    });

    const containerSpecs = document.getElementById("container-reglages-specs");
    const containerComps = document.getElementById("container-reglages-comps");

    containerSpecs.innerHTML = "";
    Array.from(ensembleSpecs).sort().forEach(spec => {
        const id = `poids-spec-${spec}`;
        containerSpecs.innerHTML += `
            <div class="reglage-group">
                <label><span>${spec}</span> : <span id="val-${id}">3</span></label>
                <input type="range" id="${id}" data-item="${spec}" class="input-poids-spec" min="0" max="5" value="3" oninput="document.getElementById('val-${id}').innerText=this.value">
            </div>
        `;
    });

    containerComps.innerHTML = "";
    Array.from(ensembleComps).sort().forEach(comp => {
        const id = `poids-comp-${comp}`;
        containerComps.innerHTML += `
            <div class="reglage-group">
                <label><span>${comp}</span> : <span id="val-${id}">3</span></label>
                <input type="range" id="${id}" data-item="${comp}" class="input-poids-comp" min="0" max="5" value="3" oninput="document.getElementById('val-${id}').innerText=this.value">
            </div>
        `;
    });
}

function trierAgentsHierarchie(a, b) {
    const fA = normaliserTexte(a.fonction);
    const fB = normaliserTexte(b.fonction);
     idxFA = ORDRE_FONCTIONS.indexOf(fA);
     idxFB = ORDRE_FONCTIONS.indexOf(fB);
    
    if (idxFA === -1) idxFA = 999;
    if (idxFB === -1) idxFB = 999;
    
    if (idxFA !== idxFB) return idxFA - idxFB;

    const nomA = normaliserTexte(a.nom);
    const nomB = normaliserTexte(b.nom);
    if (nomA !== nomB) return nomA.localeCompare(nomB, 'fr', { sensitivity: 'base' });
    
    return normaliserTexte(a.prenom).localeCompare(normaliserTexte(b.prenom), 'fr', { sensitivity: 'base' });
}

function calculerStatsEquipe(membres, conserverNiveaux = true) {
    const nb = membres.length;
    
    // 1. Détection robuste des Femmes (prise en compte de 'Homme' / 'Femme')
    const nbF = membres.filter(a => {
        const val = String(a?.sexe || a?.genre || '').trim().toLowerCase();
        return val.startsWith('f');
    }).length;

    const pctF = nb > 0 ? Math.round((nbF / nb) * 100) : 0;
    
    // 2. Calcul de l'âge moyen
    const ageMoy = nb > 0 ? Math.round(membres.reduce((s, a) => {
        const dateN = a.dateNaissance || a.naissanceDate;
        return s + (dateN ? calculerAge(dateN) : 0);
    }, 0) / nb) : 0;
    
    // 3. Comptage des fonctions
    const compteFn = (fn) => membres.filter(a => {
    const f = String(a?.fonction || '').toLowerCase();
    const g = String(a?.grade || '').toLowerCase();
    const cible = fn.toLowerCase();
    return f.includes(cible) || g.includes(cible);
}).length;

    // 4. Régimes de travail
    const nbG24 = membres.filter(a => normaliserTexte(a.regime).includes('g24')).length;
    const nbMixte = membres.filter(a => normaliserTexte(a.regime).includes('mixte')).length;

    // 5. Dictionnaires (Spécialités, Compétences, Départements)
    const dicSpecs = {};
    const dicComps = {};
    const dicDept = {};

    membres.forEach(a => {
        // Spécialités (option de regroupement des niveaux)
        extraireItems(a.specialites).forEach(s => {
            const cle = traiterNomItem(s, conserverNiveaux);
            if (cle) dicSpecs[cle] = (dicSpecs[cle] || 0) + 1;
        });
        
        // Compétences (option de regroupement des niveaux)
        extraireItems(a.competences).forEach(c => {
            const cle = traiterNomItem(c, conserverNiveaux);
            if (cle) dicComps[cle] = (dicComps[cle] || 0) + 1;
        });
        
        // Département
        const dep = extraireDepartement(a);
        if (dep) dicDept[dep] = (dicDept[dep] || 0) + 1;
    });

    return { 
        nb, nbF, pctF, ageMoy,
        nbG24, nbMixte,
        cdg: compteFn('CDG'),
        acdg1: compteFn('ACDG1'),
        acdg2: compteFn('ACDG2'),
        cate: compteFn('CATE'), 
        ca1e: compteFn('CA1E'),
        cequ: compteFn('CEqu'), 
        equ: compteFn('Equ'),
        dicSpecs, dicComps, dicDept
    };
}

// Calcule la pénalité d'écart entre les 3 équipes selon tes priorités de 1 à 10
function calculerScorePenalite(equipes, conserverNiveaux = true) {
    const stats = equipes.map(e => calculerStatsEquipe(e, conserverNiveaux));
    
    // Calcule la variance (l'écart par rapport à la moyenne des 3 équipes)
    const evaluerEcart = (getValeur) => {
        const vals = stats.map(getValeur);
        const moy = vals.reduce((a, b) => a + b, 0) / 3;
        return vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0);
    };

    // Récupération des poids depuis les curseurs de l'IHM (échelle 1-10)
    const p1 = parseInt(document.getElementById("poids-effectif")?.value || 10, 10);
    const p2 = parseInt(document.getElementById("poids-genre")?.value || 9, 10);
    const p3 = parseInt(document.getElementById("poids-cmd")?.value || 8, 10);
    const p4 = parseInt(document.getElementById("poids-cate")?.value || 7, 10);
    const p5 = parseInt(document.getElementById("poids-equ")?.value || 6, 10);
    const p6 = parseInt(document.getElementById("poids-specs")?.value || 5, 10);
    const p7 = parseInt(document.getElementById("poids-comps")?.value || 4, 10);
    const p8 = parseInt(document.getElementById("poids-regimes")?.value || 3, 10);
    const p9 = parseInt(document.getElementById("poids-age")?.value || 2, 10);
    const p10 = parseInt(document.getElementById("poids-dept")?.value || 1, 10);

    let scorePena = 0;

    // P1: Effectif brut
    scorePena += evaluerEcart(s => s.nb) * (p1 * 10);
    
    // P2: Femmes
    scorePena += evaluerEcart(s => s.nbF) * (p2 * 10);
    
    // P3: Chefs de Garde & Adjoints (CDG + ACDG1 + ACDG2)
    scorePena += evaluerEcart(s => s.cdg + s.acdg1 + s.acdg2) * (p3 * 10);
    
    // P4: CATE / CA1E
    scorePena += evaluerEcart(s => s.cate + s.ca1e) * (p4 * 10);
    
    // P5: CEQU / EQU
    scorePena += evaluerEcart(s => s.cequ + s.equ) * (p5 * 10);
    
    // P6: Spécialités
    const toutesSpecs = new Set(stats.flatMap(s => Object.keys(s.dicSpecs)));
    toutesSpecs.forEach(spec => {
        scorePena += evaluerEcart(s => s.dicSpecs[spec] || 0) * (p6 * 10);
    });

    // P7: Compétences
    const toutesComps = new Set(stats.flatMap(s => Object.keys(s.dicComps)));
    toutesComps.forEach(comp => {
        scorePena += evaluerEcart(s => s.dicComps[comp] || 0) * (p7 * 10);
    });

    // P8: Régimes de travail (G24)
    scorePena += evaluerEcart(s => s.nbG24) * (p8 * 10);
    
    // P9: Âge moyen
    scorePena += evaluerEcart(s => parseFloat(s.ageMoy)) * (p9 * 10);

    // P10: Domiciles (Départements)
    const tousDepts = new Set(stats.flatMap(s => Object.keys(s.dicDept)));
    tousDepts.forEach(dep => {
        scorePena += evaluerEcart(s => s.dicDept[dep] || 0) * (p10 * 10);
    });

    return scorePena;
}


// Si conserverNiveau est false : "RAD2" devient "RAD"
// Si conserverNiveau est true  : "RAD2" reste "RAD2"
function traiterNomItem(itemStr, conserverNiveau = true) {
    if (!itemStr) return '';
    const nettoye = itemStr.trim().toUpperCase();
    if (conserverNiveau) return nettoye;
    return nettoye.replace(/\d+$/, ''); // Retire les chiffres en fin de chaîne
}

function genererBadgesHTML(dictionnaire, couleurHex) {
    if (!dictionnaire || Object.keys(dictionnaire).length === 0) {
        return '<span style="color:#6b7280; font-size:0.8em;">Aucun</span>';
    }

    // 1. Trier les clés par ordre alphabétique et numérique (ex: RAD1 avant RAD2)
    const clefsTriees = Object.keys(dictionnaire).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    // 2. Générer les badges avec le style visuel complet
    return clefsTriees.map(cle => {
        const val = dictionnaire[cle];
        return `<span style="
            display: inline-block;
            padding: 2px 6px;
            margin: 2px;
            border-radius: 4px;
            font-size: 0.6rem;
            border: 1px solid ${couleurHex};
            background-color: ${couleurHex}20;
            color: #ffffff;
        ">${cle}:<strong style="color:${couleurHex}; margin-left:2px;">${val}</strong></span>`;
    }).join('');
}

function rendreEquipes() {
    const lettresEquipes = ['A', 'B', 'C'];

    lettresEquipes.forEach(lettre => {
        // Filtrage des membres de l'équipe courante
        const membres = agentsLocaux.filter(a => a && a.equipe && extraireLettreEquipe(a.equipe) === lettre);
        membres.sort(trierAgentsHierarchie);

        const s = calculerStatsEquipe(membres);
        
        const countEl = document.getElementById(`count-${lettre}`);
        if (countEl) countEl.innerText = s.nb;

        const statsEl = document.getElementById(`stats-${lettre}`);
        if (statsEl) {
statsEl.innerHTML = `
    <div class="stat-badge full-width"><span class="stat-label">Agents:</span> <span class="stat-value">${s.nb}</span></div>
    <div class="stat-badge"><span class="stat-label">Femmes:</span> <span class="stat-value">${s.nbF} (${s.pctF}%)</span></div>
    <div class="stat-badge"><span class="stat-label">Âge moy:</span> <span class="stat-value">${s.ageMoy} ans</span></div>
    <div class="stat-badge"><span class="stat-label">CDG/ACDG:</span> <span class="stat-value">${s.cdg + s.acdg1 + s.acdg2}</span></div>
    <div class="stat-badge"><span class="stat-label">CATE:</span> <span class="stat-value">${s.cate}</span></div>
    <div class="stat-badge"><span class="stat-label">CA1E:</span> <span class="stat-value">${s.ca1e}</span></div>
    <div class="stat-badge"><span class="stat-label">CEqu:</span> <span class="stat-value">${s.cequ}</span></div>
    <div class="stat-badge"><span class="stat-label">Equ:</span> <span class="stat-value">${s.equ}</span></div>

    <div class="stat-badge"><span class="stat-label">G24:</span> <span class="stat-value" style="color:#60a5fa;">${s.nbG24}</span></div>
    <div class="stat-badge"><span class="stat-label">Mixte:</span> <span class="stat-value" style="color:#f59e0b;">${s.nbMixte}</span></div>

    <div class="stat-section-title">Spécialités :</div>
    <div class="stat-badge-container">${genererBadgesHTML(s.dicSpecs, '#60a5fa')}</div>

    <div class="stat-section-title">Compétences :</div>
    <div class="stat-badge-container">${genererBadgesHTML(s.dicComps, '#34d399')}</div>

    <div class="stat-section-title">Départements Domicile :</div>
    <div class="stat-badge-container">${genererBadgesHTML(s.dicDept, '#f59e0b')}</div> `;
    }

        const container = document.getElementById(`container-${lettre}`);
        if (container) {
            container.innerHTML = "";
            membres.forEach(agent => {
                const specs = agent.specialites ? `<span class="agent-spec">[${agent.specialites}]</span>` : '';
                const dep = extraireDepartement(agent);
                
                // Génération des options du select (évite l'erreur de portée de 'lettre')
                const optionsDeplacement = lettresEquipes
                    .filter(l => l !== lettre)
                    .map(l => `<option value="Équipe ${l}">Vers ${l}</option>`)
                    .join('');

                container.innerHTML += `
                    <div class="carte-agent-simu ${agent.verrouille ? 'locked' : ''}">
                        <div class="agent-info-compact">
                            <span class="agent-nom">${(agent.nom || '').toUpperCase()} ${agent.prenom || ''}</span>
                            <div class="agent-details">
                                <span>${agent.fonction || 'Agent'}</span>
                                <span>${agent.grade || '-'}</span>
                                <span style="color:#f59e0b;">Dép:${dep}</span>
                                ${specs}
                            </div>
                        </div>
                        <div style="display:flex; align-items:center; gap:4px;">
                            <input type="checkbox" title="Verrouiller" ${agent.verrouille ? 'checked' : ''} onchange="basculerVerrou('${agent.idUnique}')">
                            <select class="select-equipe-deplacement" onchange="deplacerAgent('${agent.idUnique}', this.value)">
                                <option value="">Déplacer...</option>
                                ${optionsDeplacement}
                            </select>
                        </div>
                    </div>
                `;
            });
        }
    });
}

// ALGORITHME FONDÉ SUR CHAQUE BARRE DE PONDÉRATION INDIVIDUELLE
// Fonction d'évaluation de l'écart global selon l'échelle de 10 priorités
function calculerScorePenalite(equipes) {
    const stats = equipes.map(e => calculerStatsEquipe(e));
    
    const evaluerEcart = (getValeur) => {
        const vals = stats.map(getValeur);
        const moy = vals.reduce((a, b) => a + b, 0) / 3;
        return vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0);
    };

    let scorePena = 0;

    scorePena += evaluerEcart(s => s.nb) * 100;                    // P1: Effectif
    scorePena += evaluerEcart(s => s.nbF) * 90;                    // P2: Femmes
    scorePena += evaluerEcart(s => s.cdg + s.acdg1 + s.acdg2) * 80; // P3: CDG / ACDG
    scorePena += evaluerEcart(s => s.cate + s.ca1e) * 70;          // P4: CATE / CA1E
    scorePena += evaluerEcart(s => s.cequ + s.equ) * 60;           // P5: CEQU / EQU
    
    // P6: Spécialités
    const toutesSpecs = new Set(stats.flatMap(s => Object.keys(s.dicSpecs)));
    toutesSpecs.forEach(spec => {
        scorePena += evaluerEcart(s => s.dicSpecs[spec] || 0) * 50;
    });

    // P7: Compétences
    const toutesComps = new Set(stats.flatMap(s => Object.keys(s.dicComps)));
    toutesComps.forEach(comp => {
        scorePena += evaluerEcart(s => s.dicComps[comp] || 0) * 40;
    });

    scorePena += evaluerEcart(s => s.nbG24) * 30;                  // P8: Régime G24
    scorePena += evaluerEcart(s => parseFloat(s.ageMoy)) * 20;     // P9: Âge Moyen

    // P10: Départements
    const tousDepts = new Set(stats.flatMap(s => Object.keys(s.dicDept)));
    tousDepts.forEach(dep => {
        scorePena += evaluerEcart(s => s.dicDept[dep] || 0) * 10;
    });

    return scorePena;
}

function suggererReequilibrage() {
    propositionsEnAttente = [];

    // Vérifie la case à cocher pour conserver ou non les niveaux de spécialité/compétence
    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    // Équipes actuelles
    let eqA = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'A');
    let eqB = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'B');
    let eqC = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'C');

    const scoreInitial = calculerScorePenalite([eqA, eqB, eqC], conserverNiveaux);
    let meilleurScore = scoreInitial;
    let meilleureProp = null;

    // Extraction des agents non verrouillés
    const mobA = eqA.filter(a => !a.verrouille);
    const mobB = eqB.filter(a => !a.verrouille);
    const mobC = eqC.filter(a => !a.verrouille);

    // Fonction de simulation d'un échange d'agents 1 contre 1
    const testerEchange = (list1, list2, nomEq1, nomEq2) => {
        list1.forEach(a1 => {
            list2.forEach(a2 => {
                const simA = eqA.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                const simB = eqB.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                const simC = eqC.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));

                const testScore = calculerScorePenalite([simA, simB, simC], conserverNiveaux);

                if (testScore < meilleurScore) {
                    meilleurScore = testScore;
                    meilleureProp = {
                        a1: a1,
                        eq1: nomEq1,
                        a2: a2,
                        eq2: nomEq2,
                        gainPct: Math.round(((scoreInitial - testScore) / scoreInitial) * 100)
                    };
                }
            });
        });
    };

    // Test de toutes les combinaisons d'échanges possibles
    testerEchange(mobA, mobB, 'A', 'B');
    testerEchange(mobB, mobC, 'B', 'C');
    testerEchange(mobA, mobC, 'A', 'C');

    if (meilleureProp && meilleureProp.gainPct > 0) {
        propositionsEnAttente.push({
            type: 'ECHANGE',
            a1: meilleureProp.a1,
            a2: meilleureProp.a2,
            motif: `Amélioration de l'équilibre général de +${meilleureProp.gainPct}% (Échange entre Équipe ${meilleureProp.eq1} et Équipe ${meilleureProp.eq2})`
        });
    }

    afficherPropositions();
}


function afficherPropositions() {
    if (propositionsEnAttente.length === 0) {
        alert("✅ Aucun mouvement nécessaire selon les critères et pondérations actuels.");
        return;
    }
    const listeUI = document.getElementById("liste-propositions");
    listeUI.innerHTML = propositionsEnAttente.map(p => {
        if (p.type === 'TRANSFERT') {
            return `<li style="margin-bottom:10px;">➡️ Transférer <b>${p.a1.nom}</b> vers l'<b>Équipe ${p.eqCible}</b><br><span style="font-size:0.75rem; color:#94a3b8;">Motif: ${p.motif}</span></li>`;
        } else {
            return `<li style="margin-bottom:10px;">🔄 Échanger <b>${p.a1.nom}</b> (${extraireLettreEquipe(p.a1.equipe)}) <br>&nbsp;&nbsp;&nbsp;&nbsp;avec <b>${p.a2.nom}</b> (${extraireLettreEquipe(p.a2.equipe)})<br><span style="font-size:0.75rem; color:#94a3b8;">Motif: ${p.motif}</span></li>`;
        }
    }).join("");
    document.getElementById("modal-transferts").style.display = "flex";
}

function fermerModal() { document.getElementById("modal-transferts").style.display = "none"; }

function appliquerPropositions() {
    propositionsEnAttente.forEach(p => {
        if (p.type === 'TRANSFERT') {
            agentsLocaux.find(a => a.idUnique === p.a1.idUnique).equipe = `Équipe ${p.eqCible}`;
        } else if (p.type === 'ECHANGE') {
            const eq1 = p.a1.equipe;
            agentsLocaux.find(a => a.idUnique === p.a1.idUnique).equipe = p.a2.equipe;
            agentsLocaux.find(a => a.idUnique === p.a2.idUnique).equipe = eq1;
        }
    });
    
    const baseComplete = JSON.parse(localStorage.getItem("baseAgents") || "[]");
    agentsLocaux.forEach(modifie => {
        const idxBase = baseComplete.findIndex(a => a.matricule === modifie.matricule || (a.nom === modifie.nom && a.prenom === modifie.prenom));
        if (idxBase !== -1) baseComplete[idxBase].equipe = modifie.equipe;
    });
    localStorage.setItem("baseAgents", JSON.stringify(baseComplete));

    fermerModal();
    rendreEquipes();
}

function basculerVerrou(idUnique) {
    agentsLocaux.find(a => a.idUnique === idUnique).verrouille ^= true;
    rendreEquipes();
}

function deplacerAgent(idUnique, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    agentsLocaux.find(a => a.idUnique === idUnique).equipe = nouvelleEquipe;
    rendreEquipes();
}

// Synchronisation automatique en temps réel entre onglets/pages
window.addEventListener("storage", (event) => {
    if (event.key === "baseAgents") {
        const data = event.newValue;
        if (data) {
            // Recharger la variable locale et rafraîchir l'affichage
            agentsLocaux = JSON.parse(data).filter(a => {
                if (!a) return false;
                const eq = normaliserTexte(a.equipe);
                const fn = normaliserTexte(a.fonction);
                const st = normaliserTexte(a.statut);
                const estCadre = ['CDC', 'ACDC', 'OFPAO', 'OFTECH', 'ADMINISTRATIF'].includes(fn) || eq.includes('ENCADREMENT');
                return st.includes('SPP') && !estCadre;
            });

            genererControlesDynamiques();
            rendreEquipes();
        }
    }
});

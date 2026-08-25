let agentsLocaux = [];
let propositionsEnAttente = [];

// ORDRE HIÉRARCHIQUE DES FONCTIONS EXACT : CDG -> ACDG1 -> ACDG2 -> CATE -> CA1E -> CEQU -> EQU
const ORDRE_FONCTIONS = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];

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
    const val = String(agent.sexe).trim().toLowerCase();
    return val === 'femme' || val === 'f';
}

function traiterNomItem(itemStr, conserverNiveau = true) {
    if (!itemStr) return '';
    const nettoye = itemStr.trim().toUpperCase();
    if (conserverNiveau) return nettoye; 
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

function genererControlesDynamiques() {
    const ensembleSpecs = new Set();
    const ensembleComps = new Set();

    agentsLocaux.forEach(a => {
        extraireItems(a.specialites).forEach(s => ensembleSpecs.add(s));
        extraireItems(a.competences).forEach(c => ensembleComps.add(c));
    });

    const containerSpecs = document.getElementById("container-reglages-specs");
    const containerComps = document.getElementById("container-reglages-comps");

    if (containerSpecs) {
        containerSpecs.innerHTML = "";
        Array.from(ensembleSpecs).sort().forEach(spec => {
            const id = `poids-spec-${spec}`;
            containerSpecs.innerHTML += `
                <div class="reglage-group">
                    <label><span>${spec}</span> : <span id="val-${id}">5</span></label>
                    <input type="range" id="${id}" data-item="${spec}" class="input-poids-spec" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value">
                </div>
            `;
        });
    }

    if (containerComps) {
        containerComps.innerHTML = "";
        Array.from(ensembleComps).sort().forEach(comp => {
            const id = `poids-comp-${comp}`;
            containerComps.innerHTML += `
                <div class="reglage-group">
                    <label><span>${comp}</span> : <span id="val-${id}">5</span></label>
                    <input type="range" id="${id}" data-item="${comp}" class="input-poids-comp" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value">
                </div>
            `;
        });
    }
}

function trierAgentsHierarchie(a, b) {
    // 1. Ordre d'importance des Fonctions
    const ordreFonctions = {
        'CDG': 1, 'ACDG1': 2, 'ACDG2': 3, 
        'CATE': 4, 'CA1E': 5, 'CEQU': 6, 'EQU': 7
    };

    // 2. Ordre d'importance des Grades (mis à jour selon tes sigles)
    const ordreGrades = {
        'CDT': 1, 'CNE': 2, 'LTN': 3, 'ADC': 4, 'ADJ': 5, 'SCH': 6, 'SGT': 7,
        'CCH': 8, 'CPL': 9, 'SAP': 10
    };
    
    const fA = String(a?.fonction || '').trim().toUpperCase();
    const fB = String(b?.fonction || '').trim().toUpperCase();

    const rankFnA = ordreFonctions[fA] || 99;
    const rankFnB = ordreFonctions[fB] || 99;

    // A. Tri par Fonction
    if (rankFnA !== rankFnB) {
        return rankFnA - rankFnB; 
    }

    // B. Tri par Grade (si la fonction est identique)
    const gA = String(a?.grade || '').trim().toUpperCase();
    const gB = String(b?.grade || '').trim().toUpperCase();

    const rankGdaA = ordreGrades[gA] || 99;
    const rankGdaB = ordreGrades[gB] || 99;

    if (rankGdaA !== rankGdaB) {
        return rankGdaA - rankGdaB;
    }

    // C. Tri alphabétique par Nom puis Prénom (si fonction et grade sont identiques)
    const nomA = String(a?.nom || '').localeCompare(String(b?.nom || ''));
    if (nomA !== 0) return nomA;

    return String(a?.prenom || '').localeCompare(String(b?.prenom || ''));
}
function calculerStatsEquipe(membres, conserverNiveaux = true) {
    const nb = membres.length;
    
    // 1. Détection des Femmes
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
    
    // 3. Comptage strict des fonctions
    const compteFnStricte = (fn) => membres.filter(a => String(a?.fonction || '').trim().toUpperCase() === fn.toUpperCase()).length;

    const cdg = compteFnStricte('CDG');
    const acdg = compteFnStricte('ACDG1') + compteFnStricte('ACDG2');
    const cate = compteFnStricte('CATE');
    const ca1e = compteFnStricte('CA1E');
    const cequ = compteFnStricte('CEqu');
    const equ = compteFnStricte('Equ');

    // 4. Régimes de travail
    const getRegime = (a) => String(a?.regime || a?.regimeTravail || '').toLowerCase();
    const nbG24 = membres.filter(a => getRegime(a).includes('g24')).length;
    const nbMixte = membres.filter(a => getRegime(a).includes('mixte')).length;

    // 5. Dictionnaires (Spécialités, Compétences, Départements)
    const dicSpecs = {};
    const dicComps = {};
    const dicDept = {};

    membres.forEach(a => {
        extraireItems(a.specialites).forEach(s => {
            const cle = traiterNomItem(s, conserverNiveaux);
            if (cle) dicSpecs[cle] = (dicSpecs[cle] || 0) + 1;
        });
        
        extraireItems(a.competences).forEach(c => {
            const cle = traiterNomItem(c, conserverNiveaux);
            if (cle) dicComps[cle] = (dicComps[cle] || 0) + 1;
        });
        
        const dep = extraireDepartement(a);
        if (dep) dicDept[dep] = (dicDept[dep] || 0) + 1;
    });

    return { 
        nb, nbF, pctF, ageMoy,
        nbG24, nbMixte,
        cdg,
        acdgCate: acdg + cate,
        ca1e, cequ, equ,
        dicSpecs, dicComps, dicDept
    };
}

function genererBadgesHTML(dictionnaire, couleurHex) {
    if (!dictionnaire || Object.keys(dictionnaire).length === 0) {
        return '<span style="color:#6b7280; font-size:0.8em;">Aucun</span>';
    }

    const clefsTriees = Object.keys(dictionnaire).sort((a, b) => 
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

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
    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    lettresEquipes.forEach(lettre => {
        const membres = agentsLocaux.filter(a => a && a.equipe && extraireLettreEquipe(a.equipe) === lettre);
        membres.sort(trierAgentsHierarchie);

        const s = calculerStatsEquipe(membres, conserverNiveaux);
        
        const countEl = document.getElementById(`count-${lettre}`);
        if (countEl) countEl.innerText = s.nb;

        const statsEl = document.getElementById(`stats-${lettre}`);
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-badge"><span class="stat-label">Femmes:</span> <span class="stat-value">${s.nbF}</span></div>
                <div class="stat-badge"><span class="stat-label">Âge moy:</span> <span class="stat-value">${s.ageMoy} ans</span></div>
                <div class="stat-badge"><span class="stat-label">CDG:</span> <span class="stat-value">${s.cdg}</span></div>
                <div class="stat-badge"><span class="stat-label">ACDG/CATE:</span> <span class="stat-value">${s.acdgCate}</span></div>
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
                <div class="stat-badge-container">${genererBadgesHTML(s.dicDept, '#f59e0b')}</div>`;
        }

        const container = document.getElementById(`container-${lettre}`);
        if (container) {
            container.innerHTML = "";
            membres.forEach(agent => {
                const specs = agent.specialites ? `<span class="agent-spec">[${agent.specialites}]</span>` : '';
                const dep = extraireDepartement(agent);
                
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

function calculerScorePenalite(equipes, conserverNiveaux = true) {
    const stats = equipes.map(e => calculerStatsEquipe(e, conserverNiveaux));
    
    const evaluerEcart = (getValeur) => {
        const vals = stats.map(getValeur);
        const moy = vals.reduce((a, b) => a + b, 0) / 3;
        return vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0);
    };

    const p1 = parseInt(document.getElementById("poids-effectif")?.value || 10, 10);
    const p2 = parseInt(document.getElementById("poids-genre")?.value || 9, 10);
    const p3 = parseInt(document.getElementById("poids-cdg")?.value || 8, 10);
    const p4 = parseInt(document.getElementById("poids-cate")?.value || 7, 10);
    const p5 = parseInt(document.getElementById("poids-equ")?.value || 6, 10);
    const p6 = parseInt(document.getElementById("poids-specs")?.value || 5, 10);
    const p7 = parseInt(document.getElementById("poids-comps")?.value || 4, 10);
    const p8 = parseInt(document.getElementById("poids-regimes")?.value || 3, 10);
    const p9 = parseInt(document.getElementById("poids-age")?.value || 2, 10);
    const p10 = parseInt(document.getElementById("poids-dept")?.value || 1, 10);

    let scorePena = 0;

    scorePena += evaluerEcart(s => s.nb) * (p1 * 10);
    scorePena += evaluerEcart(s => s.nbF) * (p2 * 10);
    scorePena += evaluerEcart(s => s.cdg) * (p3 * 10);
    scorePena += evaluerEcart(s => s.acdgCate) * (p4 * 10);
    scorePena += evaluerEcart(s => s.cequ + s.equ) * (p5 * 10);
    
    const toutesSpecs = new Set(stats.flatMap(s => Object.keys(s.dicSpecs)));
    toutesSpecs.forEach(spec => {
        scorePena += evaluerEcart(s => s.dicSpecs[spec] || 0) * (p6 * 10);
    });

    const toutesComps = new Set(stats.flatMap(s => Object.keys(s.dicComps)));
    toutesComps.forEach(comp => {
        scorePena += evaluerEcart(s => s.dicComps[comp] || 0) * (p7 * 10);
    });

    scorePena += evaluerEcart(s => s.nbG24) * (p8 * 10);
    scorePena += evaluerEcart(s => parseFloat(s.ageMoy)) * (p9 * 10);

    const tousDepts = new Set(stats.flatMap(s => Object.keys(s.dicDept)));
    tousDepts.forEach(dep => {
        scorePena += evaluerEcart(s => s.dicDept[dep] || 0) * (p10 * 10);
    });

    return scorePena;
}

function suggererReequilibrage() {
    propositionsEnAttente = [];

    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    let eqA = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'A');
    let eqB = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'B');
    let eqC = agentsLocaux.filter(a => extraireLettreEquipe(a.equipe) === 'C');

    const scoreInitial = calculerScorePenalite([eqA, eqB, eqC], conserverNiveaux);
    let meilleurScore = scoreInitial;
    let meilleureProp = null;

    const mobA = eqA.filter(a => !a.verrouille);
    const mobB = eqB.filter(a => !a.verrouille);
    const mobC = eqC.filter(a => !a.verrouille);

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
    const ag = agentsLocaux.find(a => a.idUnique === idUnique);
    if (ag) ag.verrouille = !ag.verrouille;
    rendreEquipes();
}

function deplacerAgent(idUnique, nouvelleEquipe) {
    if (!nouvelleEquipe) return;
    const ag = agentsLocaux.find(a => a.idUnique === idUnique);
    if (ag) ag.equipe = nouvelleEquipe;
    rendreEquipes();
}

window.addEventListener("storage", (event) => {
    if (event.key === "baseAgents") {
        const data = event.newValue;
        if (data) {
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

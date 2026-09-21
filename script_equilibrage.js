let agentsLocaux = [];
let propositionsEnAttente = [];

const ORDRE_FONCTIONS = ['CDG', 'ACDG1', 'ACDG2', 'CATE', 'CA1E', 'CEQU', 'EQU'];

/**
 * Importation manuelle Excel
 */
function importerFichierExcelManuel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const arrayBuffer = e.target.result;
        traiterDonneesExcel(arrayBuffer, file.name);
    };
    reader.readAsArrayBuffer(file);
}

/**
 * Recherche dynamique d'une clé dans un objet (tolérant à la casse et aux espaces)
 */
function obtenirValeurChamp(item, clesPossibles) {
    const clesObjet = Object.keys(item);
    for (const cle of clesObjet) {
        const cleNormalisee = normaliserTexte(cle);
        for (const possible of clesPossibles) {
            if (cleNormalisee === normaliserTexte(possible)) {
                return item[cle];
            }
        }
    }
    return "";
}

/**
 * Traitement Excel avec détection complète des entêtes
 */
function traiterDonneesExcel(arrayBuffer, nomFichier = "") {
    try {
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const premierNomFeuille = workbook.SheetNames[0];
        const feuille = workbook.Sheets[premierNomFeuille];

        const donneesBrutes = XLSX.utils.sheet_to_json(feuille, { defval: "" });

        const tousLesAgents = donneesBrutes.map(item => {
            const spec = obtenirValeurChamp(item, [
                "SPECIALITE", "SPECIALITES", "SPÉCIALITÉ", "SPÉCIALITÉS", 
                "FOR_SPECIALITE", "FOR_SPECIALITES", "SPEC", "SPECS"
            ]);

            const comp = obtenirValeurChamp(item, [
                "COMPETENCE", "COMPETENCES", "COMPÉTENCE", "COMPÉTENCES", 
                "FOR_COMPETENCE", "FOR_COMPETENCES", "COMP", "COMPS"
            ]);

            const dateNaiss = obtenirValeurChamp(item, [
                "DATENAISSANCE", "DATE NAISSANCE", "DATE_NAISSANCE", "DATE_NAISS", 
                "DATE NAISS", "DATENAISS", "NAISSANCE", "DT_NAISS", "DDN", "BIRTHDATE"
            ]);

            return {
                matricule: String(obtenirValeurChamp(item, ["MATRICULE", "MATRICULES"])),
                nom: String(obtenirValeurChamp(item, ["NOM"])),
                prenom: String(obtenirValeurChamp(item, ["PRENOM", "PRÉNOM"])),
                grade: String(obtenirValeurChamp(item, ["GRADE"])),
                fonction: String(obtenirValeurChamp(item, ["FONCTION"])),
                equipe: String(obtenirValeurChamp(item, ["EQUIPE", "ÉQUIPE"])),
                statut: String(obtenirValeurChamp(item, ["STATUT"])),
                sexe: String(obtenirValeurChamp(item, ["SEXE", "GENRE"])),
                dateNaissance: dateNaiss,
                regime: String(obtenirValeurChamp(item, ["REGIME", "RÉGIME", "REGIME_TRAVAIL"])),
                codePostal: String(obtenirValeurChamp(item, ["CP", "CODE POSTAL"])),
                commune: String(obtenirValeurChamp(item, ["COMMUNE"])),
                domiciliation: String(obtenirValeurChamp(item, ["DOMICILIATION"])),
                adresse: String(obtenirValeurChamp(item, ["ADRESSE"])),
                departement: String(obtenirValeurChamp(item, ["DEPARTEMENT", "DÉPARTEMENT"])),
                specialites: String(spec || ""),
                competences: String(comp || "")
            };
        });

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

        // Mettre à jour l'état du bouton une fois le fichier chargé
        const btnExcel = document.getElementById("btn-charger-excel");
        if (btnExcel) {
            btnExcel.classList.remove("btn-reseau-deconnecte");
            btnExcel.classList.add("btn-reseau-connecte");
            btnExcel.innerHTML = `🌐 Réseau connecté<input type="file" id="input-excel" accept=".xlsx, .xls" style="display: none;" onchange="importerFichierExcelManuel(event)">`;
        }

    } catch (err) {
        alert("⚠️ Erreur lors de la lecture du fichier Excel.");
        console.error(err);
    }
}

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

/**
 * Convertit n'importe quel format de date Excel en objet Date JS
 */
function parserDateExcel(valeur) {
    if (!valeur) return null;

    if (typeof valeur === 'number') {
        return new Date(Math.round((valeur - 25569) * 86400 * 1000));
    }

    const str = String(valeur).trim();

    const matchFR = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (matchFR) {
        return new Date(parseInt(matchFR[3], 10), parseInt(matchFR[2], 10) - 1, parseInt(matchFR[1], 10));
    }

    const matchISO = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (matchISO) {
        return new Date(parseInt(matchISO[1], 10), parseInt(matchISO[2], 10) - 1, parseInt(matchISO[3], 10));
    }

    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Calcul précis de l'âge en années
 */
function calculerAge(dateNaissance) {
    const d = parserDateExcel(dateNaissance);
    if (!d) return 0;

    const aujourdhui = new Date();
    let age = aujourdhui.getFullYear() - d.getFullYear();
    const m = aujourdhui.getMonth() - d.getMonth();

    if (m < 0 || (m === 0 && aujourdhui.getDate() < d.getDate())) {
        age--;
    }

    return age > 0 ? age : 0;
}

/**
 * Calcul des statistiques d'équipe (CORRIGÉ POUR COMPTER TOUTES LES SPÉCIALITÉS ET COMPÉTENCES)
 */
function calculerStatsEquipe(equipe, conserverNiveaux = true) {
    const stats = {
        nb: equipe.length,
        nbF: 0,
        cdg: 0,
        acdgCate: 0,
        ca1e: 0,
        cequ: 0,
        equ: 0,
        dicSpecs: {},
        dicComps: {},
        nbG24: 0,
        nbMixte: 0,
        ageMoy: 0,
        dicDept: {}
    };

    if (equipe.length === 0) return stats;

    let sommeAges = 0;

    equipe.forEach(agent => {
        // Genre
        if (agent.sexe === 'F' || agent.genre === 'F' || estFemme(agent)) stats.nbF++;

        // Fonctions / Grades (Dissociation CDG, ACDG/CATE, CEQU et EQU)
        const fonction = normaliserTexte(agent.fonction || agent.grade || '');
        if (fonction.includes('ACDG') || fonction.includes('CATE')) {
        stats.acdgCate++;
        } else if (fonction.includes('CDG')) {
        stats.cdg++;
        } else if (fonction.includes('CA1E')) { 
        stats.ca1e++;
        } else if (fonction.includes('CEQU')) {
        stats.cequ++;
        } else if (fonction.includes('EQU')) {
        stats.equ++;
        }

        // Spécialités (Extraction propre depuis tableau ou chaîne séparée)
        const listeSpecs = Array.isArray(agent.specialites) 
            ? agent.specialites 
            : extraireItems(agent.specialites);
            
        listeSpecs.forEach(spec => {
            const nomSpec = traiterNomItem(spec, conserverNiveaux);
            if (nomSpec) stats.dicSpecs[nomSpec] = (stats.dicSpecs[nomSpec] || 0) + 1;
        });

        // Compétences / Permis (Extraction propre depuis tableau ou chaîne séparée)
        const listeComps = Array.isArray(agent.competences) 
            ? agent.competences 
            : extraireItems(agent.competences);
            
        listeComps.forEach(comp => {
            const nomComp = traiterNomItem(comp, conserverNiveaux);
            if (nomComp) stats.dicComps[nomComp] = (stats.dicComps[nomComp] || 0) + 1;
        });

        // Régimes
        const regimeNorm = normaliserTexte(agent.regime);
        if (regimeNorm.includes('24') || regimeNorm.includes('G24')) {
        stats.nbG24++;
        } else if (regimeNorm.includes('MIXTE')) {
        stats.nbMixte++;
        }

        // Âge
        const ageAgent = agent.age || calculerAge(agent.dateNaissance);
        if (ageAgent) sommeAges += parseInt(ageAgent, 10);

        // Département de résidence
        const dep = extraireDepartement(agent);
        if (dep) {
            stats.dicDept[dep] = (stats.dicDept[dep] || 0) + 1;
        }
    });

    stats.ageMoy = (sommeAges / equipe.length).toFixed(1);
    return stats;
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
    return chaine.split(/[,;\/-]+/).map(s => normaliserTexte(s)).filter(s => s.length > 0);
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
                    <input type="range" id="${id}" data-item="${spec}" class="input-poids-spec" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value; rendreEquipes();">
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
                    <input type="range" id="${id}" data-item="${comp}" class="input-poids-comp" min="0" max="5" value="5" oninput="document.getElementById('val-${id}').innerText=this.value; rendreEquipes();">
                </div>
            `;
        });
    }
}

function trierAgentsHierarchie(a, b) {
    const ordreFonctions = {
        'CDG': 1, 'ACDG1': 2, 'ACDG2': 3, 
        'CATE': 4, 'CA1E': 5, 'CEQU': 6, 'EQU': 7
    };

    const ordreGrades = {
        'CDT': 1, 'CNE': 2, 'LTN': 3, 'ADC': 4, 'ADJ': 5, 'SCH': 6, 'SGT': 7,
        'CCH': 8, 'CPL': 9, 'SAP': 10
    };
    
    const fA = String(a?.fonction || '').trim().toUpperCase();
    const fB = String(b?.fonction || '').trim().toUpperCase();

    const rankFnA = ordreFonctions[fA] || 99;
    const rankFnB = ordreFonctions[fB] || 99;

    if (rankFnA !== rankFnB) return rankFnA - rankFnB;

    const gA = String(a?.grade || '').trim().toUpperCase();
    const gB = String(b?.grade || '').trim().toUpperCase();

    const rankGdaA = ordreGrades[gA] || 99;
    const rankGdaB = ordreGrades[gB] || 99;

    if (rankGdaA !== rankGdaB) return rankGdaA - rankGdaB;

    const nomA = String(a?.nom || '').localeCompare(String(b?.nom || ''));
    if (nomA !== 0) return nomA;

    return String(a?.prenom || '').localeCompare(String(b?.prenom || ''));
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
            font-size: 0.7rem;
            border: 1px solid ${couleurHex};
            background-color: ${couleurHex}20;
            color: #ffffff;
        ">${cle}:<strong style="color:${couleurHex}; margin-left:3px;">${val}</strong></span>`;
    }).join('');
}

/**
 * Génération du rendu HTML complet avec affichage détaillé des en-têtes (Grades, Spécialités, Compétences)
 */
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
        
        <!-- Section Encadrement -->
        <div class="stat-section-title" style="font-weight:bold; color:#94a3b8; font-size:0.75rem; margin-top:6px; margin-bottom:3px;">ENCADREMENT & GRADES :</div>
        <div style="display:flex; flex-wrap:wrap; gap:3px; margin-bottom:8px;">
            <span class="stat-badge" style="padding: 2px 4px; font-size: 0.7rem;"><span class="stat-label">CDG : </span> <span class="stat-value" style="color:#ffe500; margin-left: 2px;">${s.cdg}</span></span>
            <span class="stat-badge" style="padding: 2px 4px; font-size: 0.7rem;"><span class="stat-label">CATE : </span> <span class="stat-value" style="color:#0ce205; margin-left: 2px;">${s.acdgCate}</span></span>
            <span class="stat-badge" style="padding: 2px 4px; font-size: 0.7rem;"><span class="stat-label">CA1E : </span> <span class="stat-value" style="color:#079302; margin-left: 2px;">${s.ca1e}</span></span>
            <span class="stat-badge" style="padding: 2px 4px; font-size: 0.7rem;"><span class="stat-label">CEqu : </span> <span class="stat-value" style="color:#058cf8; margin-left: 2px;">${s.cequ}</span></span>
            <span class="stat-badge" style="padding: 2px 4px; font-size: 0.7rem;"><span class="stat-label">Equ : </span> <span class="stat-value" style="color:#0568b8; margin-left: 2px;">${s.equ}</span></span>
        </div>

        <!-- Section Spé / Compétences -->
            <div class="stat-section-title" style="font-weight:bold; color:#94a3b8; font-size:0.75rem; margin-top:6px;">Spécialités : </div>
            <div class="stat-badge-container">${genererBadgesHTML(s.dicSpecs, '#60a5fa')}</div>
            <div class="stat-section-title" style="font-weight:bold; color:#94a3b8; font-size:0.75rem; margin-top:6px;">Compétences / Permis : </div>
            <div class="stat-badge-container">${genererBadgesHTML(s.dicComps, '#34d399')}</div>

        <!-- Section Infos Générales & Régimes -->
        <div class="stat-section-title" style="font-weight:bold; color:#94a3b8; font-size:0.75rem; margin-top:6px;">Profils / Régimes : </div>
        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px;">
            <span class="stat-badge"><span class="stat-label">Moy. Âge : </span> <span class="stat-value" style="color:#ffffff; margin-left: 2px;">${s.ageMoy} ans</span></span>
            <span class="stat-badge"><span class="stat-label"> Nbre Femmes : </span> <span class="stat-value" style="color:#f400ff; margin-left: 2px;">${s.nbF}</span></span>
            <span class="stat-badge"><span class="stat-label">G24 : </span> <span class="stat-value" style="color:#60a5fa; margin-left: 2px;">${s.nbG24}</span></span>
            <span class="stat-badge"><span class="stat-label">Mixte : </span> <span class="stat-value" style="color:#60a5fa; margin-left: 2px;">${s.nbMixte}</span></span>
        </div>

        <!-- Section CoVoit' -->
            <div class="stat-section-title" style="font-weight:bold; color:#94a3b8; font-size:0.75rem; margin-top:6px;">Départements Domicile : </div>
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
    
    // Variance des écarts
    const evaluerEcart = (getValeur) => {
        const vals = stats.map(getValeur);
        const moy = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        return vals.reduce((sum, v) => sum + Math.pow(v - moy, 2), 0);
    };

    // Récupération des 11 curseurs P1 à P11
    const p1 = parseInt(document.getElementById("poids-effectif")?.value || 10, 10);
    const p2 = parseInt(document.getElementById("poids-genre")?.value || 10, 10);
    const p3 = parseInt(document.getElementById("poids-cdg")?.value || 10, 10);
    const p4 = parseInt(document.getElementById("poids-cate")?.value || 10, 10);
    const p5 = parseInt(document.getElementById("poids-cequ")?.value || 10, 10);
    const p6 = parseInt(document.getElementById("poids-equ")?.value || 10, 10);
    const p7 = parseInt(document.getElementById("poids-specs")?.value || 10, 10);
    const p8 = parseInt(document.getElementById("poids-comps")?.value || 10, 10);
    const p9 = parseInt(document.getElementById("poids-regimes")?.value || 10, 10);
    const p10 = parseInt(document.getElementById("poids-age")?.value || 10, 10);
    const p11 = parseInt(document.getElementById("poids-dept")?.value || 10, 10);

    let scorePena = 0;

    // Coefficients internes adoucis pour vous laisser le contrôle via les curseurs
    scorePena += evaluerEcart(s => s.nb) * (p1 * 15);
    scorePena += evaluerEcart(s => s.nbF) * (p2 * 9);
    scorePena += evaluerEcart(s => s.cdg) * (p3 * 8);
    scorePena += evaluerEcart(s => s.acdgCate) * (p4 * 7);
    scorePena += evaluerEcart(s => s.ca1e) * (p5 * 6);
    scorePena += evaluerEcart(s => s.cequ) * (p5 * 5);
    scorePena += evaluerEcart(s => s.equ) * (p6 * 4);
    
    // Spécialités
    const toutesSpecs = new Set(stats.flatMap(s => Object.keys(s.dicSpecs)));
    toutesSpecs.forEach(spec => {
        const el = document.getElementById(`poids-spec-${spec}`);
        const pDyn = el ? parseInt(el.value, 10) : 1;
        scorePena += evaluerEcart(s => s.dicSpecs[spec] || 0) * (p7 * pDyn * 3);
    });

    // Compétences & Permis
    const toutesComps = new Set(stats.flatMap(s => Object.keys(s.dicComps)));
    toutesComps.forEach(comp => {
        const el = document.getElementById(`poids-comp-${comp}`);
        const pDyn = el ? parseInt(el.value, 10) : 1;
        scorePena += evaluerEcart(s => s.dicComps[comp] || 0) * (p8 * pDyn * 3);
    });

    // Profils secondaires (Régimes, Âge, Domiciliation)
    scorePena += evaluerEcart(s => s.nbG24) * (p9 * 2);
    scorePena += evaluerEcart(s => s.nbMixte) * (p9 * 2);
    scorePena += evaluerEcart(s => parseFloat(s.ageMoy)) * (p10 * 1);

    const tousDepts = new Set(stats.flatMap(s => Object.keys(s.dicDept)));
    tousDepts.forEach(dep => {
        scorePena += evaluerEcart(s => s.dicDept[dep] || 0) * (p11 * 1);
    });

    return scorePena;
    }

    
function suggererReequilibrage() {
    if (agentsLocaux.length === 0) {
        alert("⚠️ Veuillez d'abord charger votre fichier Excel.");
        return;
    }

    propositionsEnAttente = [];

    const chkNiveaux = document.getElementById("chk-conserver-niveaux");
    const conserverNiveaux = chkNiveaux ? chkNiveaux.checked : true;

    let etatSimule = JSON.parse(JSON.stringify(agentsLocaux));

    const lettres = ['A', 'B', 'C'];
    const maxIterations = 20;

    for (let iter = 0; iter < maxIterations; iter++) {
        let eqA = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'A');
        let eqB = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'B');
        let eqC = etatSimule.filter(a => extraireLettreEquipe(a.equipe) === 'C');

        let scoreActuel = calculerScorePenalite([eqA, eqB, eqC], conserverNiveaux);
        let meilleurScore = scoreActuel;
        let meilleurMouvement = null;

        const dics = { 'A': eqA, 'B': eqB, 'C': eqC };

        // TESTER LES TRANSFERTS DIRECTS
        lettres.forEach(source => {
            lettres.forEach(cible => {
                if (source !== cible) {
                    const candidats = dics[source].filter(a => !a.verrouille);
                    candidats.forEach(agent => {
                        const simA = eqA.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);
                        const simB = eqB.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);
                        const simC = eqC.map(a => a.idUnique === agent.idUnique ? { ...a, equipe: `Équipe ${cible}` } : a);

                        const testA = source === 'A' ? simA.filter(a => a.idUnique !== agent.idUnique) : (cible === 'A' ? [...simA, { ...agent, equipe: 'Équipe A' }] : simA);
                        const testB = source === 'B' ? simB.filter(a => a.idUnique !== agent.idUnique) : (cible === 'B' ? [...simB, { ...agent, equipe: 'Équipe B' }] : simB);
                        const testC = source === 'C' ? simC.filter(a => a.idUnique !== agent.idUnique) : (cible === 'C' ? [...simC, { ...agent, equipe: 'Équipe C' }] : simC);

                        const testScore = calculerScorePenalite([testA, testB, testC], conserverNiveaux);

                        if (testScore < meilleurScore - 0.05) {
                            meilleurScore = testScore;
                            meilleurMouvement = {
                                type: 'TRANSFERT',
                                agent: agent,
                                eqSource: source,
                                eqCible: cible,
                                gain: scoreActuel - testScore
                            };
                        }
                    });
                }
            });
        });

        // TESTER LES ÉCHANGES 1 CONTRE 1
        if (!meilleurMouvement) {
            const testerPaireEchange = (eq1, eq2, nom1, nom2) => {
                const mob1 = eq1.filter(a => !a.verrouille);
                const mob2 = eq2.filter(a => !a.verrouille);

                mob1.forEach(a1 => {
                    mob2.forEach(a2 => {
                        const simA = eqA.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                        const simB = eqB.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));
                        const simC = eqC.map(a => a.idUnique === a1.idUnique ? a2 : (a.idUnique === a2.idUnique ? a1 : a));

                        const testScore = calculerScorePenalite([simA, simB, simC], conserverNiveaux);

                        if (testScore < meilleurScore - 0.05) {
                            meilleurScore = testScore;
                            meilleurMouvement = {
                                type: 'ECHANGE',
                                a1: a1,
                                a2: a2,
                                eq1: nom1,
                                eq2: nom2,
                                gain: scoreActuel - testScore
                            };
                        }
                    });
                });
            };

            testerPaireEchange(eqA, eqB, 'A', 'B');
            testerPaireEchange(eqB, eqC, 'B', 'C');
            testerPaireEchange(eqA, eqC, 'A', 'C');
        }

        if (meilleurMouvement) {
            if (meilleurMouvement.type === 'TRANSFERT') {
                const target = etatSimule.find(a => a.idUnique === meilleurMouvement.agent.idUnique);
                if (target) target.equipe = `Équipe ${meilleurMouvement.eqCible}`;

                propositionsEnAttente.push({
                    type: 'TRANSFERT',
                    a1: meilleurMouvement.agent,
                    eqCible: meilleurMouvement.eqCible,
                    motif: `Transfert Équipe ${meilleurMouvement.eqSource} ➡️ Équipe ${meilleurMouvement.eqCible}`
                });
            } else if (meilleurMouvement.type === 'ECHANGE') {
                const target1 = etatSimule.find(a => a.idUnique === meilleurMouvement.a1.idUnique);
                const target2 = etatSimule.find(a => a.idUnique === meilleurMouvement.a2.idUnique);
                if (target1 && target2) {
                    const temp = target1.equipe;
                    target1.equipe = target2.equipe;
                    target2.equipe = temp;
                }

                propositionsEnAttente.push({
                    type: 'ECHANGE',
                    a1: meilleurMouvement.a1,
                    a2: meilleurMouvement.a2,
                    motif: `Échange Équipe ${meilleurMouvement.eq1} 🔄 Équipe ${meilleurMouvement.eq2}`
                });
            }
        } else {
            break;
        }
    }

    afficherPropositions();
}

function afficherPropositions() {
    if (propositionsEnAttente.length === 0) {
        alert("✅ Équilibre maximal atteint ! Aucun autre mouvement pertinent à proposer.");
        return;
    }

    const listeUI = document.getElementById("liste-propositions");
    if (!listeUI) return;

    listeUI.innerHTML = propositionsEnAttente.map((p, index) => {
        if (p.type === 'TRANSFERT') {
            return `<li style="margin-bottom:10px;"><b>#${index + 1}</b> ➡️ Transférer <b>${p.a1.nom} ${p.a1.prenom}</b> vers l'<b>Équipe ${p.eqCible}</b><br><span style="font-size:0.75rem; color:#94a3b8;">${p.motif}</span></li>`;
        } else {
            return `<li style="margin-bottom:10px;"><b>#${index + 1}</b> 🔄 Échanger <b>${p.a1.nom} ${p.a1.prenom}</b> avec <b>${p.a2.nom} ${p.a2.prenom}</b><br><span style="font-size:0.75rem; color:#94a3b8;">${p.motif}</span></li>`;
        }
    }).join("");

    const modal = document.getElementById("modal-transferts");
    if (modal) {
        modal.style.display = "flex";
        document.body.classList.add("modal-ouverte");
    }
}

function imprimerRecommandations() {
    window.print();
}

function fermerModal() {
    const modal = document.getElementById("modal-transferts");
    if (modal) modal.style.display = "none";
    document.body.classList.remove("modal-ouverte");
}

function appliquerPropositions() {
    propositionsEnAttente.forEach(p => {
        if (p.type === 'TRANSFERT') {
            const ag = agentsLocaux.find(a => a.idUnique === p.a1.idUnique);
            if (ag) ag.equipe = `Équipe ${p.eqCible}`;
        } else if (p.type === 'ECHANGE') {
            const ag1 = agentsLocaux.find(a => a.idUnique === p.a1.idUnique);
            const ag2 = agentsLocaux.find(a => a.idUnique === p.a2.idUnique);
            if (ag1 && ag2) {
                const eqTemp = ag1.equipe;
                ag1.equipe = ag2.equipe;
                ag2.equipe = eqTemp;
            }
        }
    });

    propositionsEnAttente = [];
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
